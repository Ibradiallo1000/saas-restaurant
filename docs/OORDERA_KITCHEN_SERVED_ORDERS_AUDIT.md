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

