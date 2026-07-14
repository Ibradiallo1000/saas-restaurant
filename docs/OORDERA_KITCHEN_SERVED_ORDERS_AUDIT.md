# Audit - Commandes servies disparaissant de la cuisine

## 1. Resume executif

La disparition observee des commandes Livraison et A emporter de la colonne Cuisine "Servies" vient du fait que la vue cuisine est encore fortement liee au statut courant de production (`kitchenStatus`). Quand une commande Livraison/A emporter quitte `ready`, la cuisine la fait passer a `picked_up` via `nextOrderStatus(...)`. Dans certains flux ou etats legacy, elle peut aussi etre consideree `completed`. Ces valeurs sortent du listener principal de la cuisine, qui ne charge que `pending`, `preparing`, `ready`, `served`.

Condition responsable principale :

```ts
where("kitchenStatus", "in", ["pending", "preparing", "ready", "served"])
```

Fichier : `src/modules/orders/OrdersProvider.tsx`.

Le code actuel contient deja plusieurs requetes de rattrapage pour re-integrer les commandes servies du jour (`picked_up`, `completed`, `servedAt`, `pickedUpAt`, `updatedAt`, `createdAt`). Cela reduit fortement le bug, mais ce n'est pas encore le modele canonique le plus propre : la colonne "Servies" doit representer un fait metier historique ("la cuisine a servi/remis cette commande aujourd'hui"), pas seulement un statut courant.

Strategie recommandee : construire la colonne "Servies aujourd'hui" depuis les timestamps de service existants, principalement `timestamps.servedAt` et `timestamps.pickedUpAt`, avec filtre de jour local du restaurant, puis fusionner avec les commandes actives non finales.

Conclusion : correction possible sans migration obligatoire pour les nouvelles commandes, car la cuisine ecrit deja `timestamps.servedAt` et `timestamps.pickedUpAt`. Un backfill n'est utile que pour anciennes commandes servies avant l'introduction de ces timestamps.

## 2. Cause racine exacte

La commande disparait au moment ou elle cesse d'appartenir au flux actif de la cuisine.

Flux incrimine :

1. `KitchenOrderCard` calcule l'action suivante avec `nextOrderStatus(orderStatus, order.orderType)`.
2. Pour `pickup` et `delivery`, `nextOrderStatus("ready", type)` retourne `picked_up`.
3. `KitchenBoard.updateStatus(...)` ecrit :
   - `kitchenStatus: "picked_up"` ;
   - `timestamps.pickedUpAt: serverTimestamp()` ;
   - `statusHistory` avec statut normalise en evenement servi.
4. `OrdersProvider.activeOrdersQuery` n'ecoute que `["pending", "preparing", "ready", "served"]`.
5. La commande n'est donc plus dans le listener actif immediatement apres passage a `picked_up`.

Le POS a un comportement different mais coherent : il classe visuellement dans "Terminées" les commandes terminales deja payees :

```ts
isTerminalProductionStatus && isOrderPaid(order)
  ? ORDER_OPERATION_STATUS.COMPLETED
  : isTerminalProductionStatus
    ? ORDER_OPERATION_STATUS.SERVED
    : orderStatus
```

Fichier : `src/app/(dashboard)/pos/components/POSClient.tsx`.

La cause n'est donc pas le paiement lui-meme. Le paiement peut accelerer la classification POS en "Terminées", mais le fait cuisine pertinent est le passage a `picked_up` ou `served`, puis la sortie du flux actif base sur le statut courant.

## 3. Architecture actuelle

### Page cuisine

| Role | Fichier | Responsabilite |
|---|---|---|
| Route `/dashboard/kitchen` | `src/app/(dashboard)/kitchen/page.tsx` | Charge `KitchenLazy`. |
| Client cuisine | `src/app/(dashboard)/kitchen/components/KitchenClient.tsx` | Enveloppe avec `OrdersProvider`, lit `useOrders`, rend `KitchenBoard`. |
| Provider commandes cuisine | `src/modules/orders/OrdersProvider.tsx` | Charge commandes actives et tentatives de rattrapage servies du jour. |
| Tableau cuisine | `src/modules/kitchen/KitchenBoard.tsx` | Regroupe en colonnes, change le statut, ecrit timestamps et historique. |
| Carte commande cuisine | `src/modules/kitchen/KitchenOrderCard.tsx` | Affiche commande, calcule action suivante via `nextOrderStatus`. |

### POS / caisse

| Role | Fichier | Responsabilite |
|---|---|---|
| Onglet Commandes POS | `src/app/(dashboard)/pos/components/POSClient.tsx` | Regroupe les commandes en En attente, En preparation, Pretes, Servies, Terminées. |
| Paiement atomique | `src/services/pos-security.service.ts` | Valide paiement, ecrit paiement, ledger, audit, ferme table si applicable. |
| Creation POS | `src/services/order.service.ts` | Cree les commandes POS avec `kitchenStatus`, `orderStatus`, `statusHistory`. |
| Validation manager/caisse | `src/app/(manager)/manager/caisse/page.tsx` | Valide paiements de sessions table via ledger. |
| Donnees live operationnelles | `src/modules/restaurant-live/RestaurantLiveDataProvider.tsx` | Alimente POS/manager/owner/mobile, pas la page cuisine actuelle. |

### Services et helpers de statut

| Fichier | Fonctions importantes |
|---|---|
| `src/lib/order-lifecycle.ts` | `ORDER_OPERATION_STATUS`, `normalizeOrderType`, `nextOrderStatus`, `orderStatusFromKitchenStatus`, `toKitchenServedEventStatus`, `isOrderServed`, `isOrderPaid`. |
| `src/services/orderService.ts` | Service legacy de creation/ecoute/update commandes. |
| `src/utils/preparation-logic.ts` | Determine si une commande a des items cuisine. |

## 4. Cycle des trois modes de commande

### Sur place

| Etape | Declencheur | Champs modifies | Impact cuisine | Impact POS/caisse |
|---|---|---|---|---|
| Creation | POS ou QR table | `kitchenStatus: pending`, `orderStatus: pending`, `statusHistory` | Colonne En attente | Session table active si dine-in. |
| En preparation | Cuisine | `kitchenStatus: preparing`, `timestamps.preparingAt`, items `preparing`, `statusHistory` | Colonne En preparation | POS voit progression. |
| Prete | Cuisine | `kitchenStatus: ready`, `timestamps.readyAt`, items `ready`, `statusHistory` | Colonne Pretes | POS voit progression. |
| Servie | Cuisine | `kitchenStatus: served`, `timestamps.servedAt`, items `served`, `statusHistory` | Colonne Servies | POS garde en Servies si non payee. |
| Paiement caisse | POS/manager caisse | `paymentStatus: paid`, `paidAt`, `cashSessionId`, ledger, event audit, session/table fermees si toutes payees | La commande doit rester visible dans Servies aujourd'hui | POS la classe Terminées. |

### A emporter

| Etape | Declencheur | Champs modifies | Impact cuisine | Impact POS/caisse |
|---|---|---|---|---|
| Creation | POS ou public checkout | `kitchenStatus: pending`, `orderStatus: pending`, `paymentStatus` selon flux | En attente | Souvent deja payee ou paiement initie. |
| En preparation | Cuisine | `kitchenStatus: preparing`, `timestamps.preparingAt` | En preparation | Statut visible. |
| Prete | Cuisine | `kitchenStatus: ready`, `timestamps.readyAt` | Pretes | Statut visible. |
| Recuperee | Cuisine | `kitchenStatus: picked_up`, `timestamps.pickedUpAt`, `statusHistory` servi | Doit rester dans Servies aujourd'hui | POS peut la classer Terminées si payee. |

### Livraison

| Etape | Declencheur | Champs modifies | Impact cuisine | Impact POS/caisse |
|---|---|---|---|---|
| Creation | Public checkout / POS | `kitchenStatus: pending`, `orderStatus: pending`, `orderType: delivery` | En attente | Paiement souvent initie avant remise. |
| En preparation | Cuisine | `kitchenStatus: preparing`, `timestamps.preparingAt` | En preparation | Statut visible. |
| Prete | Cuisine | `kitchenStatus: ready`, `timestamps.readyAt` | Pretes | Statut visible. |
| Remise/livraison | Cuisine | `kitchenStatus: picked_up`, `timestamps.pickedUpAt` | Doit rester dans Servies aujourd'hui | POS peut la classer Terminées si payee. |

## 5. Champs et statuts reels

| Domaine | Champ | Valeurs constatees | Fichiers consommateurs |
|---|---|---|---|
| Operation cuisine canonique | `kitchenStatus` | `pending`, `preparing`, `ready`, `served`, `picked_up`, `completed`; legacy `servie`, `servies`, `terminee`, `recuperee`, `pretes`, `en_preparation` | `OrdersProvider.tsx`, `KitchenBoard.tsx`, `KitchenOrderCard.tsx`, `POSClient.tsx`, `order-lifecycle.ts` |
| Operation commande | `orderStatus` | `pending`, `preparing`, `ready`, `served`, `picked_up`, `completed` | `order.service.ts`, `orderService.ts`, `POSClient.tsx` |
| Legacy statut | `status` | `nouvelle`, `preparation`, `prete`, `servie`, `payee`; aussi valeurs operationnelles | `constants.ts`, `order-lifecycle.ts`, anciens services |
| Paiement | `paymentStatus` | `unpaid`, `non_paye`, `pending`, `pending_cash`, `pending_mobile`, `pending_verification`, `verified`, `paid`, `paye`, `validated`, `failed` | `order-lifecycle.ts`, `POSClient.tsx`, `pos-security.service.ts`, caisse manager |
| Type commande canonique | `orderType` | `dine_in`, `pickup`, `delivery`, legacy `takeaway` | `order-lifecycle.ts`, `POSClient.tsx`, `OrderService` |
| Type legacy/source UI | `type`, `mode`, `source` | `table`, `takeaway`, `delivery`, `sur_place`, `a_emporter`, `qr`, `qr_table`, `pos`, `client`, `delivery` | checkouts publics, POS, suivi commande |
| Service temps | `timestamps.servedAt` | `serverTimestamp()` quand `newOrderStatus === served` | `KitchenBoard.tsx`, `OrdersProvider.tsx`, `RestaurantLiveDataProvider.tsx` |
| Retrait/remise temps | `timestamps.pickedUpAt` | `serverTimestamp()` quand `newOrderStatus === picked_up` | `KitchenBoard.tsx`, `OrdersProvider.tsx`, `RestaurantLiveDataProvider.tsx` |
| Legacy temps | `servedAt`, `pickedUpAt` | Lu par les providers, ecriture non canonique dans code actuel | `OrdersProvider.tsx`, `RestaurantLiveDataProvider.tsx`, `KitchenBoard.tsx` |
| Historique | `statusHistory[]` | `{ status, at, source }`, avec `toKitchenServedEventStatus` normalisant `served`, `picked_up`, `completed` en evenement `served` | `order-lifecycle.ts`, `KitchenBoard.tsx`, `order.service.ts`, `orderService.ts` |
| Session table | `tableSessionId`, `sessionId`, `sessionActive` | id session, false apres paiement/cloture | POS, suivi commande, caisse manager |
| Session caisse | `cashSessionId` | id session active ayant encaisse | POS, ledger, caisse manager |

Duplications importantes :

- `status`, `orderStatus`, `kitchenStatus` coexistent.
- `type`, `orderType`, `mode`, `source` coexistent.
- `servedAt/pickedUpAt` legacy et `timestamps.servedAt/timestamps.pickedUpAt` coexistent.
- POS peut afficher "Terminées" sans que `kitchenStatus` devienne `completed`.

## 6. Requete actuelle de la colonne Servies

La page cuisine actuelle consomme `OrdersProvider`.

Requetes dans `src/modules/orders/OrdersProvider.tsx` :

1. Actives :

```ts
where("kitchenStatus", "in", ["pending", "preparing", "ready", "served"])
orderBy("createdAt", "desc")
limit(150)
```

2. Servies du jour par statut et creation :

```ts
where("createdAt", ">=", Timestamp.fromDate(todayStart))
where("kitchenStatus", "in", ["served", "servie", "servies", "completed", "picked_up", "terminee"])
orderBy("createdAt", "desc")
limit(100)
```

3. Servies recentes par `updatedAt`.

4. Servies par `timestamps.servedAt`.

5. Servies legacy par `servedAt`.

6. Retirees/remises par `timestamps.pickedUpAt`.

7. Retirees/remises legacy par `pickedUpAt`.

8. Recentes par `createdAt` et `updatedAt`.

Puis le provider fusionne tout par `id`, filtre les commandes ayant des items cuisine, mappe les statuts legacy vers `served`, et expose `orders`.

Dans `KitchenBoard`, la colonne est alimentee par :

```ts
const kitchenStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? status ?? orderStatus)
const columnStatus = kitchenStatus === "picked_up" ? "served" : kitchenStatus
```

Observation : `orderStatusFromKitchenStatus(...)` ne retourne jamais `completed`; `completed` est normalise en `served`. Donc le tableau sait afficher un `completed` en Servies si la commande est presente dans `orders`.

Condition responsable de la disparition initiale :

- `activeOrdersQuery` exclut `picked_up` et `completed`.
- Une commande A emporter/Livraison passe a `picked_up` au dernier clic cuisine.
- Elle sort donc immediatement du flux actif.
- Elle ne reste visible que si une requete secondaire la recharge correctement.

Limites des requetes de rattrapage actuelles :

- elles multiplient les listeners ;
- certaines utilisent `createdAt` au lieu de la date de service ;
- `todayRecentServedOrdersQuery` n'a pas de borne de jour et se base sur `updatedAt` + `limit(100)` ;
- `startOfToday()` utilise le fuseau du navigateur, pas explicitement le fuseau du restaurant ;
- il n'y a pas de borne haute `< demain`, donc le comportement repose sur une date de debut et des limites ;
- les anciennes commandes sans timestamp de service ne sont fiables que via `createdAt`, `updatedAt` ou `statusHistory`.

## 7. Relation avec POS, paiement et sessions

Le POS ne doit pas etre casse.

Dans `POSClient.tsx`, les commandes sont regroupees ainsi :

- si statut terminal (`served` ou `picked_up`) et payee, afficher en `completed` ;
- si terminale mais non payee, afficher en `served` ;
- sinon afficher le statut operationnel.

Cela respecte le metier :

- Sur place : reste en Servies jusqu'au paiement, puis Terminées.
- A emporter/Livraison : peut passer tres vite en Terminées si deja payee.

Paiement :

- `processOrderPaymentTransaction` et `validateMobilePaymentTransaction` ecrivent paiement, ledger, audit, `paidAt`, `cashSessionId`, et ferment table/session pour le sur place servi.
- Ces fonctions ne doivent pas etre utilisees pour definir l'historique cuisine.
- `validateTableSessionPayment` ferme la session table et marque les commandes payees.

Sessions :

- La cuisine ne depend pas directement de `cashSessionId` ou de la session caisse.
- La fermeture d'une session caisse ne devrait pas supprimer une commande de "Servies aujourd'hui".
- La vue cuisine doit dependre d'un fait cuisine (`servedAt` / `pickedUpAt`), pas de `paymentStatus`, `sessionActive` ou `cashSessionId`.

## 8. Donnees temporelles disponibles

Donnees fiables pour les commandes traitees par la cuisine actuelle :

| Champ | Ecrit ou lu | Fiabilite |
|---|---|---|
| `timestamps.preparingAt` | ecrit par `KitchenBoard.updateStatus` | utile progression, pas pour Servies. |
| `timestamps.readyAt` | ecrit par `KitchenBoard.updateStatus` | utile progression, pas final. |
| `timestamps.servedAt` | ecrit si `newOrderStatus === served` | fiable pour Sur place. |
| `timestamps.pickedUpAt` | ecrit si `newOrderStatus === picked_up` | fiable pour A emporter/Livraison. |
| `servedAt` | lu comme legacy | peut aider anciennes donnees si present. |
| `pickedUpAt` | lu comme legacy | peut aider anciennes donnees si present. |
| `completedAt` | ecrit par `markOrderCompleted`, sans lien garanti avec service cuisine | ne doit pas etre la source principale. |
| `updatedAt` | ecrit partout | non fiable comme date de service. |
| `createdAt` | date de commande | non fiable pour "servies aujourd'hui". |
| `statusHistory.at` | ecrit avec `new Date()` cote client | utile fallback, moins robuste que serverTimestamp. |

Le meilleur signal disponible est :

- `timestamps.servedAt` pour `dine_in` servi ;
- `timestamps.pickedUpAt` pour `pickup` et `delivery`.

## 9. Date metier locale

Aujourd'hui, `startOfToday()` fait :

```ts
const date = new Date()
date.setHours(0, 0, 0, 0)
```

Cela utilise le fuseau du navigateur. Au Mali, le fuseau est UTC+0, donc le risque est faible si les postes sont bien configures localement. Mais pour un SaaS, la date metier devrait venir du restaurant (`countryCode`, futur timezone explicite, ou fallback `Africa/Bamako` pour ML).

Filtre recommande :

```ts
servedAt >= debutDuJourLocalRestaurant
servedAt < debutDuJourSuivantLocalRestaurant
```

Important : il ne faut pas remettre a zero ou modifier des donnees a minuit. Le compteur repart a zero naturellement par le filtre de date.

Cas a proteger : une commande En preparation a 23h59 et terminee apres minuit doit rester active apres minuit, puis apparaitre dans Servies du nouveau jour au moment du service/retrait.

## 10. Comparaison des strategies

### A. Conserver les commandes dans le statut Servie

Non recommande.

Avantage : simple pour la cuisine.

Problemes :

- casse la separation entre etat cuisine et etat commercial ;
- empeche le POS de classer naturellement les commandes deja payees ;
- complexifie A emporter/Livraison qui doivent pouvoir etre commercialement terminees.

### B. Afficher `served` ou `completed`

Partiellement correct, mais insuffisant.

Avantage : facile.

Problemes :

- toutes les commandes `completed` ne sont pas forcement servies aujourd'hui ;
- une commande terminee hier peut reapparaitre si le filtre est mauvais ;
- le statut courant ne dit pas quand la cuisine a servi.

### C. Construire depuis un timestamp de service existant

Recommande.

Principe :

- commandes actives : charger `pending`, `preparing`, `ready`, eventuellement `served` non payees ;
- historique Servies aujourd'hui : charger `timestamps.servedAt` et `timestamps.pickedUpAt` dans la journee locale ;
- fusionner par `id` ;
- la colonne Servies affiche toutes les commandes dont la cuisine a effectivement termine la production/remise aujourd'hui, quel que soit le statut commercial actuel.

Avantages :

- preserve le POS ;
- preserve le paiement apres consommation Sur place ;
- preserve le paiement prealable Livraison/A emporter ;
- ne depend pas de la session caisse ;
- gere naturellement minuit ;
- evite de charger tout l'historique.

### D. Utiliser `statusHistory`

Possible en fallback, non recommande comme source principale.

Avantages :

- peut aider anciennes commandes.

Problemes :

- tableau dans le document, difficile a requeter efficacement ;
- timestamp `Date` cote client ;
- necessite charger des lots plus larges puis filtrer cote client ;
- cout et complexite plus eleves.

## 11. Strategie recommandee

Strategie principale : C.

Modele cible :

1. Garder le workflow POS actuel.
2. Ne pas empecher `picked_up` ou `completed`.
3. Construire `Servies aujourd'hui` avec deux requetes canoniques :
   - `where("timestamps.servedAt", ">=", startOfDay)` et `< nextStartOfDay` ;
   - `where("timestamps.pickedUpAt", ">=", startOfDay)` et `< nextStartOfDay`.
4. Fusionner les resultats avec les commandes actives.
5. Dans `KitchenBoard`, router toute commande ayant un timestamp de service du jour vers la colonne `served`, meme si son statut courant est `picked_up` ou `completed`.
6. Garder `statusHistory` uniquement comme fallback temporaire pour anciennes donnees.

Ne pas utiliser `createdAt` comme source de verite pour Servies aujourd'hui.

## 12. Fichiers a modifier lors de l'implementation

Fichiers probables :

- `src/modules/orders/OrdersProvider.tsx`
  - simplifier les requetes de rattrapage ;
  - ajouter borne haute `< nextStartOfDay` ;
  - utiliser prioritairement `timestamps.servedAt` / `timestamps.pickedUpAt`.

- `src/modules/kitchen/KitchenBoard.tsx`
  - conserver `updateStatus` ;
  - rendre explicite le groupement "served today" independant du statut courant ;
  - eviter que `shouldShowInTodayKitchen` s'appuie sur `createdAt` si aucun timestamp fiable.

- `src/lib/order-lifecycle.ts`
  - eventuellement exposer un helper pur `isKitchenServedTodayCandidate` ou `getKitchenServiceTimestamp`, si reutilisable.

- `firestore.indexes.json`
  - ajouter indexes si necessaire, sans les creer pendant cet audit.

Fichiers a ne pas modifier sauf besoin avere :

- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/services/pos-security.service.ts`
- `src/services/order.service.ts`
- `src/app/(manager)/manager/caisse/page.tsx`

Le POS est correct cote metier.

## 13. Indexes Firestore

Indexes existants pertinents dans `firestore.indexes.json` :

- `kitchenStatus ASC, createdAt ASC`
- `kitchenStatus ASC, createdAt DESC`
- `tableSessionId ASC, createdAt ASC`
- `sessionId ASC, createdAt ASC`

Indexes recommandes si la solution utilise des bornes date sur timestamps imbriques :

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "timestamps.servedAt", "order": "ASCENDING" }
  ]
}
```

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "timestamps.pickedUpAt", "order": "ASCENDING" }
  ]
}
```

Si les requetes ajoutent `orderBy(..., "desc")`, prevoir les variantes `DESCENDING`. Si elles restent sur collection `restaurants/{id}/orders` avec un seul range/order field, Firestore peut parfois proposer l'index automatiquement au premier echec. Ne pas filtrer une annee cote client.

## 14. Risques de regression

| Risque | Impact | Mitigation |
|---|---|---|
| Reutiliser `completedAt` comme date cuisine | faux positifs, paiements tardifs comptes comme service | utiliser `servedAt/pickedUpAt`. |
| Supprimer le filtre actif a minuit | commandes non terminees disparaissent | garder listener actif independant du jour. |
| Utiliser `createdAt` pour Servies aujourd'hui | commande creee hier servie aujourd'hui absente | filtrer par timestamp de service. |
| Utiliser `updatedAt` | paiement ou impression change le jour de service | ne l'utiliser qu'en fallback temporaire. |
| Dependre de la session caisse | fermeture caisse masque historique cuisine | ne pas filtrer par `cashSessionId`. |
| Backfill sauvage | corruption historique | aucun backfill sans validation. |
| Multiplication de listeners | cout lecture | deux requetes canoniques + actives suffisent. |

## 15. Matrice de tests

| Cas | Attendu |
|---|---|
| 1. Sur place servie a 22h, payee a 23h | reste en Servies cuisine jusqu'a minuit ; POS passe Terminées apres paiement. |
| 2. Livraison servie/remise puis immediatement terminee | reste visible en Servies cuisine du jour via `pickedUpAt`; POS peut etre Terminées. |
| 3. A emporter recuperee puis terminee | reste visible en Servies cuisine du jour via `pickedUpAt`. |
| 4. En preparation a 23h59, terminee apres minuit | reste active apres minuit ; compte dans Servies du nouveau jour au service/retrait. |
| 5. Servie a 23h58, consultation a 00h01 | n'apparait plus dans Servies du nouveau jour ; reste dans historique si page historique existe. |
| 6. Ancienne Terminee hier | n'apparait pas aujourd'hui. |
| 7. Rechargement cuisine | Servies du jour rechargees via timestamps, pas via etat local. |
| 8. Changement session caisse | aucun effet sur Servies cuisine. |
| 9. Fermeture/reouverture navigateur | identique au rechargement. |
| 10. Plusieurs postes/caissiers | fusion par `id`, pas de doublons. |
| 11. Commande annulee apres preparation | ne doit pas etre comptee servie sans `servedAt/pickedUpAt`. |
| 12. Commande sans timestamp de service | fallback legacy possible ; sinon ne pas compter sans certitude. |

## 16. Plan d'implementation minimal

1. Ajouter un helper pur de date locale :
   - `getRestaurantBusinessDayRange(restaurant)` ou equivalent ;
   - fallback `Africa/Bamako` / navigateur si aucune timezone.

2. Dans `OrdersProvider`, remplacer les multiples requetes de rattrapage par :
   - active orders : `pending`, `preparing`, `ready`, `served` ;
   - served today : `timestamps.servedAt` dans `[start, nextStart)` ;
   - picked up today : `timestamps.pickedUpAt` dans `[start, nextStart)`.

3. Fusionner par `id`.

4. Marquer cote UI les commandes issues de `servedAt/pickedUpAt` comme candidates colonne `served`, sans modifier Firestore.

5. Conserver temporairement une petite compatibilite legacy :
   - `servedAt`, `pickedUpAt` legacy ;
   - eventuellement `statusHistory` seulement sur un lot recent, si besoin.

6. Tester les 12 cas limites.

7. Ajouter les indexes Firestore demandes par l'emulateur/console si necessaire.

## 17. Statut final

Cause racine : le listener actif de la cuisine exclut `picked_up` et `completed`, alors que les commandes A emporter/Livraison passent a `picked_up` au dernier traitement cuisine et peuvent etre considerees Terminées cote POS lorsqu'elles sont payees.

Meilleure strategie : construire la colonne "Servies aujourd'hui" depuis `timestamps.servedAt` et `timestamps.pickedUpAt`, avec filtre de jour local restaurant, independamment du statut commercial courant.

Donnees manquantes eventuelles : seulement pour anciennes commandes sans `timestamps.servedAt` / `timestamps.pickedUpAt`. Les nouvelles commandes traitees par `KitchenBoard.updateStatus` disposent deja de ces champs.

Statut : PRET POUR IMPLEMENTATION.

## 18. Modele metier final : journal de production du jour

La colonne "Servies aujourd'hui" ne doit pas etre interpretee comme un statut courant unique. Elle doit etre interpretee comme un journal de production du jour.

Definition finale :

- Une commande "active cuisine" est une commande encore a produire ou a remettre : `pending`, `preparing`, `ready`.
- Une commande "servie aujourd'hui" est une commande qui possede un evenement de production final date dans la journee restaurant :
  - `timestamps.servedAt` pour le sur place ;
  - `timestamps.pickedUpAt` pour l'a emporter et la livraison.
- Le statut commercial courant peut ensuite devenir paye, termine, ferme, recupere ou archive sans retirer la commande du journal cuisine du jour.

Conclusion metier : le tableau Cuisine doit afficher a la fois le flux actif et le journal de production du jour. La colonne "Servies" n'est pas la source de verite d'un workflow commercial ; elle est une vue de production basee sur les timestamps canoniques.

## 19. Architecture a deux sources

Architecture recommandee :

| Source | Role | Filtre canonique | Usage UI |
|---|---|---|---|
| Source active | Commandes en production | `kitchenStatus in ["pending", "preparing", "ready"]` | Colonnes En attente, En preparation, Pretes. |
| Source journal | Commandes finalisees en cuisine aujourd'hui | `timestamps.servedAt` ou `timestamps.pickedUpAt` dans `[debutJour, debutJourSuivant)` | Colonne Servies. |

Regles de fusion :

1. Charger les commandes actives.
2. Charger les commandes servies aujourd'hui via `timestamps.servedAt`.
3. Charger les commandes recuperees/remises aujourd'hui via `timestamps.pickedUpAt`.
4. Fusionner par `order.id`.
5. Si une commande existe dans le journal du jour, elle doit alimenter la colonne "Servies", meme si `kitchenStatus` vaut deja `picked_up`, `completed` ou un autre statut terminal.
6. Si une commande n'a pas de timestamp final de production, elle ne doit pas etre classee "Servies aujourd'hui" uniquement parce que `updatedAt`, `completedAt` ou `paymentStatus` ont change.

Compatibilite temporaire possible :

- conserver `servedAt` et `pickedUpAt` racine comme fallback legacy ;
- conserver un fallback limite via `statusHistory` si besoin ;
- eviter `updatedAt` comme source stable, sauf diagnostic ponctuel.

## 20. Cartographie complete des ecrivains de statut

| Fichier | Fonction / zone | Champs ecrits | Nature | Risque pour "Servies aujourd'hui" |
|---|---|---|---|---|
| `src/modules/kitchen/KitchenBoard.tsx` | `updateStatus` | `kitchenStatus`, `timestamps.preparingAt`, `timestamps.readyAt`, `timestamps.servedAt`, `timestamps.pickedUpAt`, `statusHistory`, `items[].status`, `items[].servedAt`, `updatedAt` | Ecrivain principal cuisine | Source la plus fiable pour les timestamps de production. |
| `src/modules/kitchen/KitchenOrderCard.tsx` | `nextOrderStatus(...)` via action UI | Aucun write direct | Decide le prochain statut transmis a `KitchenBoard` | Pour pickup/livraison, `ready` devient `picked_up`, ce qui fait sortir la commande du listener actif actuel. |
| `src/lib/order-lifecycle.ts` | `nextOrderStatus`, `orderStatusFromKitchenStatus`, `normalizeKitchenStatus` | Aucun write direct | Source de normalisation | `picked_up` est normalise comme final cuisine ; doit rester pris en compte par timestamp. |
| `src/modules/orders/OrdersProvider.tsx` | listeners commandes cuisine | Aucun write metier intentionnel dans le flux normal | Source de lecture Cuisine / Commandes dashboard | Doit devenir l'endroit principal de fusion active + journal du jour. |
| `src/modules/restaurant-live/RestaurantLiveDataProvider.tsx` | effet migration `kitchenStatus` manquant | `kitchenStatus` | Ecrivain correctif client | Peut reintroduire un statut derive sans timestamp final ; a ne pas utiliser comme source journal. |
| `src/services/order.service.ts` | `OrderService.createOrder` | `kitchenStatus`, `orderStatus`, `statusHistory`, `paymentStatus`, `createdAt`, `updatedAt` | Creation commande moderne | Initialise correctement, mais ne cree pas d'evenement final. |
| `src/services/order.service.ts` | `OrderService.updateOrderStatus` | `kitchenStatus`, `statusHistory`, `updatedAt` | Ecrivain statut service | N'ecrit pas `timestamps.servedAt/pickedUpAt` ; risque si utilise pour finaliser une commande hors Cuisine. |
| `src/services/orderService.ts` | `createOrder` legacy | `kitchenStatus`, `orderStatus`, `statusHistory`, `createdAt` | Creation publique legacy | Initialise correctement, mais pas de timestamp final. |
| `src/services/orderService.ts` | `updateOrderStatus` legacy | `kitchenStatus`, `statusHistory` | Ecrivain statut legacy | N'ecrit pas de timestamp final ni `updatedAt`. |
| `src/app/(dashboard)/pos/components/POSClient.tsx` | creation POS | `kitchenStatus`, `orderStatus`, `paymentStatus` via `OrderService.createOrder` | Creation POS | OK pour initialisation. |
| `src/app/(dashboard)/pos/components/POSClient.tsx` | `markOrderPaid`, paiement commande | champs paiement via `processOrderPaymentTransaction` ou `validateMobilePaymentTransaction` | Paiement | Ne doit pas influencer le journal cuisine. |
| `src/app/(dashboard)/pos/components/POSClient.tsx` | `markOrderCompleted` | `sessionActive`, `completedAt`, `updatedAt` | Cloture POS/session | `completedAt` est commercial/session, pas production cuisine. |
| `src/services/pos-security.service.ts` | `processOrderPaymentTransaction` | `paymentStatus`, `paymentMethod`, `paymentType`, `paidAt`, `closedAt`, `sessionActive`, `updatedAt`, verification paiement, audit | Paiement securise | Ne modifie pas `kitchenStatus`; ne doit pas servir a "Servies". |
| `src/services/pos-security.service.ts` | `validateMobilePaymentTransaction` | paiement confirme, fermeture table/session, `updatedAt` | Paiement securise | Ne modifie pas `kitchenStatus`; ne doit pas servir a "Servies". |
| `src/services/pos-security.service.ts` | `cancelOrderTransaction` | `cancelled`, `cancelledAt`, `cancelledBy`, `cancelReason`, `updatedAt` | Annulation | Ne doit pas creer de service cuisine. |
| `src/services/payment-ledger.service.ts` | `createPaymentInTransaction`, `confirmPaymentInTransaction` | applique `orderUpdate` fourni par les appelants | Infrastructure paiement | Indirect ; depend du payload, actuellement paiement/session. |
| `src/app/(manager)/manager/caisse/page.tsx` | `validateTableSessionPayment` | champs paiement, `sessionActive`, `paidAt`, `updatedAt` via ledger | Caisse manager | Paiement uniquement. |
| `src/app/(dashboard)/orders/components/OrdersClient.tsx` | `completeOrder`, `validateMobilePayment` | `paymentStatus`, `paymentMethod`, `paymentType`, `paidAt`, `updatedAt` | Gestion commandes/caisse | Paiement uniquement. |
| `src/modules/public/components/CheckoutQRModal.tsx` | creation QR table | `kitchenStatus`, `orderStatus`, `paymentStatus`, session/table refs, `createdAt`, `updatedAt` | Creation publique QR | OK pour initialisation. |
| `src/modules/public/components/CheckoutPublicModal.tsx` | creation publique | `kitchenStatus`, `orderStatus`, `paymentStatus`, `createdAt`, `updatedAt` | Creation publique | OK pour initialisation. |
| `src/app/(public)/checkout/page.tsx` | creation checkout legacy | `kitchenStatus`, `orderStatus`, `paymentStatus` via service legacy | Creation publique legacy | OK pour initialisation. |
| `src/app/r/[slug]/checkout/page.tsx` | `addDoc` commande | `kitchenStatus`, `orderStatus`, `paymentStatus`, `createdAt`, `updatedAt` | Creation checkout route slug | OK pour initialisation. |
| `src/modules/public/components/QRPaymentModal.tsx` | demande paiement client | `paymentStatus`, `paymentMethod`, `paymentType`, `paymentIntentStatus`, `updatedAt` | Paiement client | Ne doit pas influencer le journal cuisine. |
| `src/app/order/[restaurantId]/[orderId]/page.tsx` | paiement/session table | `tableSessions.paymentRequest`, statut session, batch de paiement selon flux | Suivi client / paiement table | Ne doit pas influencer le journal cuisine. |

Constat final : il existe plusieurs ecrivains de `kitchenStatus`, mais un seul chemin ecrit actuellement les timestamps canoniques `timestamps.servedAt` et `timestamps.pickedUpAt` au moment de l'action cuisine : `KitchenBoard.updateStatus`.

## 21. Source de verite canonique par domaine

| Domaine | Source canonique | Champs secondaires / derives | Decision |
|---|---|---|---|
| Production cuisine courante | `kitchenStatus` | `orderStatus`, `status`, `items[].status` | Lire `kitchenStatus`, normaliser avec `order-lifecycle`. |
| Evenement final cuisine | `timestamps.servedAt`, `timestamps.pickedUpAt` | `servedAt`, `pickedUpAt`, `statusHistory` | Utiliser les timestamps imbriques comme source principale. |
| Journal "Servies aujourd'hui" | timestamps finaux dans la journee restaurant | `kitchenStatus` terminal uniquement comme contexte | Ne pas baser le journal sur `paymentStatus`, `completedAt` ou `updatedAt`. |
| Etat commercial POS | derive de `kitchenStatus` + `paymentStatus` | `completedAt`, `sessionActive` | Ne pas modifier dans cette correction. |
| Paiement | `paymentStatus` + documents `payments` | `paidAt`, `paymentIntentStatus`, ledger session | Domaine separe de la production. |
| Sessions table/caisse | `tableSessions`, `cashSessions` | `sessionActive`, `closedAt` | Ne pas utiliser pour determiner le service cuisine. |
| Suivi client | `kitchenStatus` normalise + paiement effectif | stockage local de suivi | Doit rester une lecture de l'etat courant, pas le journal cuisine. |

Conclusion : la source de verite des statuts courants reste `kitchenStatus`. La source de verite du modele "Servies aujourd'hui" doit etre le timestamp d'evenement final cuisine.

## 22. Risques de concurrence entre ecritures

Risques identifies :

1. `KitchenBoard.updateStatus` peut finaliser une commande avec timestamp, puis un flux paiement POS peut mettre a jour `paymentStatus`, `closedAt`, `sessionActive` et `updatedAt`. Si la cuisine lit `updatedAt`, la date de service devient fausse.
2. `OrderService.updateOrderStatus` et `services/orderService.updateOrderStatus` peuvent changer `kitchenStatus` sans ecrire `timestamps.servedAt/pickedUpAt`. Ces chemins peuvent creer des commandes terminales sans date de production exploitable.
3. `RestaurantLiveDataProvider` peut ecrire un `kitchenStatus` derive lorsqu'il manque. C'est utile pour compatibilite, mais ce n'est pas un evenement cuisine.
4. `orderStatus` et `kitchenStatus` peuvent diverger : les creations ecrivent les deux, mais les transitions mettent surtout a jour `kitchenStatus`.
5. `statusHistory` utilise `new Date()` cote client dans certains chemins. Ce champ est utile en fallback, mais moins canonique que `serverTimestamp()`.
6. `completedAt` est ecrit par le POS pour cloture/session. Il ne represente pas necessairement le moment ou la cuisine a servi/remis la commande.
7. Les flux de paiement peuvent etre valides apres le service. Un filtre base sur paiement ferait glisser des commandes d'un jour a l'autre.

Mitigation finale :

- ne pas utiliser `updatedAt`, `completedAt`, `paymentStatus`, `closedAt` ou `sessionActive` pour "Servies aujourd'hui" ;
- utiliser uniquement les timestamps finaux de production ;
- ajouter si necessaire les timestamps finaux aux chemins de statut non-cuisine seulement si ces chemins sont réellement utilises pour finaliser la production, et seulement apres validation metier.

## 23. Impact sur suivi client, POS et sessions

### Suivi client

Le suivi client lit le statut courant de la commande (`kitchenStatus`, `orderStatus` ou equivalent normalise). Le passage au modele "journal du jour" ne doit pas changer ce comportement.

Impact attendu : aucun, si la correction reste dans `OrdersProvider` / `KitchenBoard` pour la vue Cuisine.

### POS

Le POS classe visuellement les commandes via une combinaison de statut production et paiement :

- `served` ou `picked_up` non paye : encore visible comme a encaisser / servi selon la vue POS ;
- `served` ou `picked_up` paye : peut apparaitre comme termine ;
- `markOrderCompleted` cloture la session commerciale avec `completedAt`, sans changer la production.

Impact attendu : aucun changement requis dans le POS pour corriger "Servies aujourd'hui". Le POS ne doit pas devenir la source de verite du journal cuisine.

### Sessions table

Les sessions table/caisse servent a gerer occupation, paiement, fermeture et recapitulatif. Elles peuvent se fermer apres paiement, mais cette fermeture ne doit pas retirer une commande de la colonne "Servies" du jour.

Impact attendu : aucun changement dans `tableSessions`, `cashSessions`, `PaymentLedgerService` ou les ecritures de caisse.

## 24. Decision finale d'implementation

Decision : corriger la disparition des commandes servies en introduisant dans la lecture Cuisine une architecture active + journal, sans modifier les workflows POS, paiement, session ou checkout.

Decision detaillee :

1. Conserver `kitchenStatus` comme source de verite du statut courant.
2. Utiliser `timestamps.servedAt` et `timestamps.pickedUpAt` comme source de verite des evenements finaux cuisine.
3. Construire "Servies aujourd'hui" depuis ces timestamps, pas depuis le statut terminal seul.
4. Garder les ecritures existantes de `KitchenBoard.updateStatus`, qui posent deja les timestamps necessaires.
5. Ne pas faire de migration de donnees dans cette correction.
6. Ne pas modifier les flux POS et paiement.
7. Ajouter les indexes Firestore seulement si les requetes finales les exigent.

Reponse aux questions structurantes :

- Faut-il utiliser le statut ou un journal ? Un journal de production du jour.
- Quels timestamps sont canoniques ? `timestamps.servedAt` et `timestamps.pickedUpAt`.
- Existe-t-il plusieurs ecrivains concurrents ? Oui, plusieurs ecrivains de statut existent ; un seul ecrit actuellement les timestamps de production de maniere fiable.
- Peut-on corriger sans changer le POS ? Oui.
- Faut-il migrer les anciennes donnees ? Non pour la correction minimale ; les anciennes commandes sans timestamp peuvent rester hors journal ou etre traitees par fallback limite.

## 25. Liste exacte des fichiers a modifier

Correction minimale recommandee :

1. `src/modules/orders/OrdersProvider.tsx`
   - remplacer les requetes de rattrapage heterogenes par deux lectures journal :
     - `timestamps.servedAt` dans la journee restaurant ;
     - `timestamps.pickedUpAt` dans la journee restaurant ;
   - conserver une lecture active pour `pending`, `preparing`, `ready` ;
   - fusionner par `id` ;
   - exposer a la Cuisine les commandes du journal comme "Servies" sans reecrire Firestore.

2. `src/modules/kitchen/KitchenBoard.tsx`
   - ajuster uniquement la logique de repartition UI si necessaire pour que les commandes issues du journal restent dans la colonne "Servies" meme si leur `kitchenStatus` brut vaut `picked_up` ou `completed` ;
   - conserver les ecritures actuelles de `updateStatus`, notamment `timestamps.servedAt` et `timestamps.pickedUpAt`.

3. `firestore.indexes.json`
   - ajouter uniquement les indexes demandes par les nouvelles requetes si Firestore les exige.

Fichier optionnel selon implementation :

4. `src/lib/order-lifecycle.ts`
   - uniquement si un helper pur est necessaire pour identifier un statut terminal de production ou pour exposer une normalisation deja existante.
   - ne pas changer les transitions metier.

## 26. Liste exacte des fichiers a ne pas modifier

Ne pas modifier pour cette correction :

- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/services/pos-security.service.ts`
- `src/services/payment-ledger.service.ts`
- `src/services/cashier.service.ts`
- `src/services/order.service.ts`
- `src/services/orderService.ts`
- `src/app/(manager)/manager/caisse/page.tsx`
- `src/app/(dashboard)/orders/components/OrdersClient.tsx`
- `src/modules/public/components/CheckoutQRModal.tsx`
- `src/modules/public/components/CheckoutPublicModal.tsx`
- `src/modules/public/components/QRPaymentModal.tsx`
- `src/app/(public)/checkout/page.tsx`
- `src/app/r/[slug]/checkout/page.tsx`
- `src/app/order/[restaurantId]/[orderId]/page.tsx`
- `src/services/table-session.service.ts`
- `firestore.rules`
- donnees Firestore existantes
- routes publiques, checkout, suivi client, paiement, QR Code, PWA

Exception : si une verification future prouve qu'un chemin non-cuisine finalise réellement la production, il faudra alors ajouter les timestamps canoniques dans ce chemin. Ce n'est pas necessaire pour la correction minimale identifiee.

## 27. Indexes necessaires

Indexes actuellement presents :

- `kitchenStatus + createdAt ASC`
- `kitchenStatus + createdAt DESC`
- plusieurs indexes `restaurantId`, `status`, `createdAt`
- aucun index explicite sur `timestamps.servedAt`
- aucun index explicite sur `timestamps.pickedUpAt`

Indexes a prevoir si les requetes restent sur la sous-collection `restaurants/{restaurantId}/orders` avec un seul champ range/order :

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "timestamps.servedAt", "order": "ASCENDING" }
  ]
}
```

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "timestamps.pickedUpAt", "order": "ASCENDING" }
  ]
}
```

Si le code utilise `orderBy(..., "desc")`, ajouter les variantes `DESCENDING`.

Si une requete `collectionGroup("orders")` avec filtre `restaurantId` est introduite, prevoir plutot :

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "restaurantId", "order": "ASCENDING" },
    { "fieldPath": "timestamps.servedAt", "order": "DESCENDING" }
  ]
}
```

```json
{
  "collectionGroup": "orders",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "restaurantId", "order": "ASCENDING" },
    { "fieldPath": "timestamps.pickedUpAt", "order": "DESCENDING" }
  ]
}
```

Recommandation : rester sur la sous-collection restaurant pour eviter d'introduire un nouveau modele d'indexation.

## 28. Plan d'implementation final et minimal

1. Dans `OrdersProvider`, definir le debut et la fin de jour restaurant :
   - `startOfDay`;
   - `nextStartOfDay`;
   - timezone restaurant si disponible, fallback actuel sinon.

2. Remplacer la strategie de rattrapage par trois sources :
   - actives : `pending`, `preparing`, `ready` ;
   - servies aujourd'hui : `timestamps.servedAt >= start` et `< nextStart` ;
   - remises/recuperees aujourd'hui : `timestamps.pickedUpAt >= start` et `< nextStart`.

3. Fusionner les snapshots dans une map par `order.id`.

4. Marquer en memoire les commandes issues des timestamps finaux comme candidates a la colonne "Servies" sans modifier le document Firestore.

5. Dans `KitchenBoard`, faire primer l'evenement final du jour pour la repartition de la colonne "Servies".

6. Conserver les ecritures de `KitchenBoard.updateStatus` telles quelles, sauf correction strictement necessaire pour garantir `serverTimestamp()` sur `servedAt/pickedUpAt`.

7. Ne modifier aucun flux POS, paiement, caisse, checkout, suivi client ou session.

8. Lancer les validations :
   - `npx tsc --noEmit` ;
   - `git diff --check` ;
   - test manuel cuisine : sur place servi, a emporter recupere, livraison remise, paiement apres service, changement de session caisse.

### Statut complementaire final

Le modele cible est valide : "Servies aujourd'hui" doit etre une vue de journal de production, pas une colonne uniquement basee sur le statut courant.

La correction minimale peut etre implementee sans modifier le POS, sans migration de donnees et sans changement de workflow. Les seuls fichiers applicatifs a toucher devraient etre `OrdersProvider` et eventuellement `KitchenBoard`, avec indexes Firestore seulement si les nouvelles requetes les demandent.

Statut : AUDIT COMPLEMENTAIRE FINALISE - PRET POUR IMPLEMENTATION CIBLEE.

## 29. Preuve runtime de la disparition

### Statut du test runtime

Statut final : CAUSE NON PROUVÉE — TEST INCOMPLET.

La verification runtime demandee n'a pas pu etre executee completement dans cette session, car elle exige une reproduction interactive dans une session navigateur authentifiee Cuisine, avec une commande reelle ou locale deja prete en mode Livraison / A emporter / Sur place.

Le projet ne contient pas de configuration e2e exploitable pour automatiser ce scenario :

- pas de script Playwright/Cypress declare dans `package.json` ;
- pas de suite `tests` disponible pour simuler le drag/clic Cuisine ;
- pas d'acces navigateur authentifie disponible depuis cette session.

Aucun log temporaire n'a donc ete laisse dans le code applicatif.

### Chronologie prouvee par lecture statique

La lecture statique du code prouve la chronologie probable suivante pour une commande Livraison ou A emporter :

1. `KitchenOrderCard` calcule l'action suivante avec `nextOrderStatus(orderStatus, order.orderType)`.
2. Dans `src/lib/order-lifecycle.ts`, une commande `ready` de type `pickup` ou `delivery` passe a `picked_up`.
3. `KitchenBoard.updateStatus` execute `updateDoc` avec :
   - `kitchenStatus: "picked_up"` ;
   - `timestamps.pickedUpAt: serverTimestamp()` ;
   - `statusHistory` ;
   - `items` mis a jour ;
   - `updatedAt: serverTimestamp()`.
4. `activeOrdersQuery` dans `OrdersProvider` ne lit que :
   - `pending` ;
   - `preparing` ;
   - `ready` ;
   - `served`.
5. La commande `picked_up` sort donc mecaniquement de `activeOrdersQuery`.
6. Elle devrait ensuite etre recuperee par `todayPickedUpAtOrdersQuery`, qui lit `timestamps.pickedUpAt >= todayStart`.

Cette chronologie indique fortement un probleme de lecture ou de fenetre de synchronisation, mais elle ne remplace pas une preuve runtime.

### Valeurs Firestore observees

Non observees en runtime dans cette session.

Valeurs attendues apres clic final Livraison / A emporter, si l'ecriture `KitchenBoard.updateStatus` reussit :

| Champ | Valeur attendue |
|---|---|
| `kitchenStatus` | `picked_up` |
| `orderStatus` | inchange par `KitchenBoard.updateStatus` |
| `paymentStatus` | inchange par `KitchenBoard.updateStatus` |
| `timestamps.servedAt` | absent ou inchange |
| `timestamps.pickedUpAt` | present, ecrit via `serverTimestamp()` |
| `updatedAt` | present, ecrit via `serverTimestamp()` |

Valeurs attendues apres clic final Sur place :

| Champ | Valeur attendue |
|---|---|
| `kitchenStatus` | `served` |
| `orderStatus` | inchange par `KitchenBoard.updateStatus` |
| `paymentStatus` | inchange par `KitchenBoard.updateStatus` |
| `timestamps.servedAt` | present, ecrit via `serverTimestamp()` |
| `timestamps.pickedUpAt` | absent ou inchange |
| `updatedAt` | present, ecrit via `serverTimestamp()` |

### Requetes a observer pendant reproduction

| Requete | Role | Observation attendue |
|---|---|---|
| `activeOrdersQuery` | commandes Cuisine actives | l'ID sort des que `kitchenStatus` devient `picked_up`, car ce statut n'est pas dans `ACTIVE_KITCHEN_STATUSES`. |
| `todayPickedUpAtOrdersQuery` | journal A emporter / Livraison du jour | l'ID doit entrer apres resolution de `timestamps.pickedUpAt`. |
| `todayServedAtOrdersQuery` | journal Sur place du jour | l'ID Sur place doit entrer apres resolution de `timestamps.servedAt`. |

### Erreurs de requete / index

Non observees en runtime dans cette session.

Point a verifier dans la console navigateur pendant reproduction :

- erreur Firestore `failed-precondition` ;
- lien de creation d'index ;
- absence de snapshot sur `timestamps.pickedUpAt`.

Si une erreur d'index apparait sur `timestamps.pickedUpAt`, la cause runtime devient : requete journal invalide tant que l'index manque.

### Ecritures concurrentes

Non observees en runtime dans cette session.

La recherche statique n'a pas trouve de Cloud Function locale ni de composant evident qui reecrit automatiquement `kitchenStatus` juste apres le clic Cuisine.

Les ecrivains POS/paiement identifies modifient principalement :

- `paymentStatus` ;
- `paymentMethod` ;
- `paymentType` ;
- `paidAt` ;
- `closedAt` ;
- `sessionActive` ;
- `updatedAt`.

Ils ne prouvent pas une reecriture concurrente de `kitchenStatus` apres `KitchenBoard.updateStatus`.

### Tableau de resultat runtime

| Cas | Write reussi | pickedUpAt/servedAt present | Sortie active | Entree journal | Delai | Erreur |
|-----|--------------|-----------------------------|---------------|----------------|-------|--------|
| A. A emporter | Non teste | Non observe | Non observe | Non observe | Non mesure | Non observe |
| B. Livraison | Non teste | Non observe | Non observe | Non observe | Non mesure | Non observe |
| C. Sur place | Non teste | Non observe | Non observe | Non observe | Non mesure | Non observe |

### Instrumentation recommandee pour obtenir la preuve

Pour prouver la cause runtime, ajouter temporairement des logs dans :

1. `src/modules/kitchen/KitchenBoard.tsx`
   - avant `updateDoc` ;
   - apres `updateDoc` ;
   - `getDoc(orderRef)` immediat apres l'ecriture ;
   - `onSnapshot(orderRef)` pendant 3 a 5 secondes pour detecter une ecriture concurrente.

2. `src/modules/orders/OrdersProvider.tsx`
   - snapshot de `activeOrdersQuery` ;
   - snapshot de `todayPickedUpAtOrdersQuery` ;
   - snapshot de `todayServedAtOrdersQuery` ;
   - log des erreurs Firestore de chaque listener.

3. Console navigateur
   - conserver l'horodatage ;
   - copier toute erreur d'index Firestore ;
   - mesurer le delai entre succes `updateDoc`, sortie active, entree journal.

### Decision selon preuve a obtenir

| Preuve runtime | Decision |
|---|---|
| `pickedUpAt` present, document encore existant, aucune ecriture concurrente, mais requete journal ne recoit pas la commande | Corriger la requete, les bornes de date, l'index ou le listener. |
| `pickedUpAt` absent apres ecriture | Corriger `KitchenBoard.updateStatus` ou le payload Firestore. |
| `pickedUpAt` present puis supprime/ecrase | Corriger l'ecriture concurrente. |
| La commande reapparait apres un delai visible | Corriger la fenetre de synchronisation UI avec une architecture active + journal sans trou visuel. |

### Cause prouvee

Cause runtime non prouvee dans cette session.

Cause statique la plus probable : la commande Livraison / A emporter sort de `activeOrdersQuery` quand `kitchenStatus` devient `picked_up`, puis depend de la requete `timestamps.pickedUpAt` pour reapparaitre dans le journal Cuisine.

### Correction a appliquer ensuite

Ne pas appliquer de correction tant que la preuve runtime n'est pas obtenue.

Si la preuve confirme que `timestamps.pickedUpAt` est bien present et qu'aucune ecriture concurrente ne l'efface, appliquer la correction minimale deja recommandee :

- stabiliser `OrdersProvider` autour de deux sources explicites :
  - commandes actives ;
  - journal du jour via `timestamps.servedAt` et `timestamps.pickedUpAt` ;
- eviter toute disparition visuelle entre sortie active et entree journal ;
- ajouter les indexes Firestore requis si la console les demande.
