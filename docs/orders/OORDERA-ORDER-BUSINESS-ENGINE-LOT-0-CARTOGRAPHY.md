# LOT 0 — Cartographie et garde-fous du moteur de commandes Ordera

## 1. Statut du document

| Élément | Valeur |
|---|---|
| Nature | Audit statique de l'existant |
| Date | 29 juillet 2026 |
| Périmètre | POS, QR à table, commande publique, Cuisine, Manager, paiement, stock et Firestore Rules |
| Références | Spécification métier, registre des décisions et roadmap du moteur de commandes |
| Modification fonctionnelle | Aucune |
| Modification Firestore | Aucune |

Ce document répond au LOT 0 de la roadmap. Il décrit le code réellement présent,
pas l'architecture cible. Les termes « canonique » et « cible » désignent les
invariants déjà validés dans les documents métier.

## 2. Verdict exécutif

Le moteur actuel n'est pas encore unique. Il existe au moins cinq chemins de
création de commande, plusieurs écrivains directs du document parent et deux
représentations concurrentes des lignes :

- `orders/{orderId}.items[]`, encore lue par la quasi-totalité des interfaces ;
- `orders/{orderId}/orderItems/{orderItemId}`, utilisée par le parcours POS
  récent et par le moteur de service/déduction de stock.

Le parcours POS est le plus proche de la cible, mais sa création du parent et
des lignes n'est pas atomique. Les parcours QR et commande publique créent
uniquement `items[]`. Ils ne peuvent donc pas appeler correctement le moteur
central de service, qui exige un document `orderItems/{orderItemId}`.

Il n'existe pas d'agrégateur central des commandes. Les états globaux sont
calculés ou écrits localement par le créateur, la Cuisine, le POS, le paiement
ou des composants de compatibilité. Deux acteurs exécutant la même intention
métier peuvent donc produire des états différents.

Le LOT 0 est **terminé pour la cartographie**. Le LOT 1 est **NO-GO pour une
implémentation naïve** tant que les quatre garde-fous bloquants suivants ne sont
pas intégrés à sa conception :

1. création atomique du parent et des `orderItems` ;
2. stratégie serveur sécurisée pour les créateurs publics ;
3. identifiant de ligne stable et identique dans toutes les représentations ;
4. maintien explicite de `items[]` comme projection de compatibilité jusqu'au
   LOT 8, sans en faire l'autorité métier.

## 3. Topologie réelle

```text
POSClient
  └─ OrderService.createOrder()
       ├─ addDoc orders/{orderId} avec items[]
       └─ setDoc orderItems/{orderItemId}, un par un

CheckoutQRModal
  └─ transaction.set orders/{orderId} avec items[] uniquement

CheckoutPublicModal
  └─ batch.set orders/{orderId} avec items[] uniquement

/r/[slug]/checkout
  ├─ addDoc orders/{orderId} avec items[]
  └─ addDoc orderItems/{id aléatoire}, un par un

/(public)/checkout
  └─ ancien orderService.createOrder()
       └─ addDoc orders/{orderId} avec items[] uniquement

Cuisine ───────────────┐
                       ├─ mutations directes du parent
POS ───────────────────┘
                       └─ markOrderItemAsServedAndDeductStock()
                            ├─ orderItems
                            ├─ stockBalancesV2
                            ├─ stockOperationsV2
                            ├─ stockServingProgressV2
                            ├─ stockIdempotencyV2
                            └─ projection orders.items[]
```

## 4. Registre des créations de commande

| Canal | Point d'entrée réel | Écriture | `orderItems` | Atomicité | État sans Cuisine | Conformité |
|---|---|---|---|---|---|---|
| POS comptoir, table, emporté, livraison | `POSClient.handleCheckout()` → `OrderService.createOrder()` | parent puis sous-documents | Oui, IDs stables | Non : `addDoc`, puis plusieurs `setDoc` | `ready` | Partielle |
| QR à table actif | `CheckoutQRModal` via `CartDrawer` | transaction sur le parent | Non | Parent seul atomique | `completed` | Non |
| Commande publique emporté/livraison | `CheckoutPublicModal` via `CartDrawer` | batch sur le parent et documents annexes | Non | Parent seul dans le modèle commande | `completed` | Non |
| Ancienne route `/r/[slug]/checkout` | page de checkout | parent puis lignes | Oui, mais IDs aléatoires | Non | `completed` | Non |
| Ancienne route `/(public)/checkout` | ancien `orderService.createOrder()` | parent | Non | Parent seul | `completed` | Non |

### 4.1 POS

Preuves :

- `src/app/(dashboard)/pos/components/POSClient.tsx:872` construit la commande ;
- `src/app/(dashboard)/pos/components/POSClient.tsx:983` appelle
  `OrderService.createOrder()` ;
- `src/services/order.service.ts:174` crée le parent ;
- `src/services/order.service.ts:190` à `203` crée ensuite les sous-documents.

Le même `orderItemId` est conservé dans `items[]` et dans le chemin du
sous-document. C'est le seul créateur actuel compatible avec le moteur central
de service. L'absence de batch/transaction englobant le parent et toutes les
lignes permet toutefois une commande partielle en cas d'interruption.

### 4.2 QR à table

`src/modules/public/components/CheckoutQRModal.tsx:186` écrit directement le
parent dans une transaction, avec `items[]`, mais sans `orderItems`. Pour une
commande sans ligne Cuisine, les champs globaux sont initialisés à `completed`
aux lignes 142–143. Une ligne directe peut donc être déclarée terminée sans
événement de service.

### 4.3 Emporté et livraison publics

`src/modules/public/components/CheckoutPublicModal.tsx:347` écrit le parent par
batch, sans sous-collection de lignes. Les lignes 304–305 initialisent également
une commande sans Cuisine à `completed`.

### 4.4 Routes anciennes toujours présentes

- `src/app/r/[slug]/checkout/page.tsx:117` crée le parent, puis la ligne 137
  utilise `addDoc` pour chaque ligne. L'ID Firestore de la ligne est donc
  différent de l'ID embarqué éventuel et la création n'est pas atomique.
- `src/app/(public)/checkout/page.tsx:155` utilise
  `src/services/orderService.ts`, service parent-only distinct de
  `src/services/order.service.ts`.

Le nom presque identique des deux services constitue un risque opérationnel :
un import peut réintroduire silencieusement l'ancien contrat.

## 5. Autorité des lignes

### 5.1 État réel

`orderItems` n'est pas encore l'autorité de lecture de l'application. Son usage
est principalement limité à :

- la création POS récente ;
- la transaction de service et déduction de stock ;
- quelques vérifications Firestore Rules.

Les interfaces et agrégats lisent encore `order.items`, notamment :

- POS : `src/app/(dashboard)/pos/components/POSClient.tsx` ;
- Cuisine : `src/modules/kitchen/KitchenBoard.tsx` ;
- fournisseur temps réel : `src/modules/orders/OrdersProvider.tsx` ;
- Manager : `OrdersClient.tsx`, `ManagerOrdersView.tsx`, `ManagerClient.tsx` ;
- Caisse Manager ;
- Owner ;
- suivi client public ;
- `OrderCard` et `OrderDetails` ;
- analytics et avis plats ;
- impression ;
- fonctions de normalisation dans `src/lib/order-lifecycle.ts`.

### 5.2 Écrivains de `items[]`

| Écrivain | Motif |
|---|---|
| Tous les créateurs listés en section 4 | Projection initiale ou seule représentation |
| `KitchenBoard.updateStatus()` | Mise à jour groupée des lignes de production |
| `markOrderItemAsServedAndDeductStock()` | Projection du service après transaction |
| POS | Déduction de l'état global à partir de la projection locale |

Le moteur de stock met bien à jour le document `orderItems`, puis synchronise
également `orders.items[]` à
`src/modules/stock/automatic-simple/infrastructure/mark-order-item-served.ts:405`.
Cette double écriture est aujourd'hui nécessaire à la compatibilité, mais elle
ne doit pas devenir deux autorités métier indépendantes.

### 5.3 Risque de divergence

Un document parent peut exister :

- sans aucun `orderItems` ;
- avec une partie seulement de ses `orderItems` ;
- avec des IDs de lignes différents ;
- avec un état de ligne dans `items[]` différent du sous-document.

Les Rules ne vérifient pas l'équivalence complète des deux représentations.

## 6. Registre des mutations de statut

| Acteur | Fichier / fonction | Mutation réelle | Problème |
|---|---|---|---|
| Cuisine | `KitchenBoard.updateStatus()` | Modifie les lignes embarquées et les états globaux | Action groupée par colonne, pas par ligne canonique |
| Cuisine | même fonction | Appelle le moteur central au passage terminal | La Cuisine peut servir, alors que la cible l'arrête à `ready` |
| POS | `markOrderItemServed()` | Appelle le moteur central, puis peut écrire le parent `served` | Agrégation locale, non centralisée |
| POS | `markOrderCompleted()` | Écrit `sessionActive` et `completedAt` | Ne garantit ni `orderStatus=completed`, ni payé + toutes lignes servies |
| Service récent | `OrderService.updateOrderStatus()` | Écrit directement le parent | Contournement possible des lignes |
| Service ancien | `orderService.updateOrderStatus()` | Écrit directement le parent | Contrat legacy encore appelable |
| Live provider | effet de compatibilité | Ajoute `kitchenStatus` manquant | Réparation automatique à la lecture |
| Manager commandes | actions de paiement | Modifie directement les champs de paiement | Contourne le service/ledger central dans certains parcours |
| Paiement public | `PaymentModal`, `QRPaymentModal` | `updateDoc` direct sur le parent | Plusieurs contrats de paiement concurrents |
| Sécurité POS | `cancelOrderTransaction()` | Pose notamment un booléen `cancelled` | Ne pilote pas les quantités annulées par ligne |
| Sécurité POS | `refundOrderTransaction()` | Pose `refunded` et `refundTotal` | Axe de remboursement incomplet par rapport à la cible |

### 6.1 Cuisine

`src/modules/kitchen/KitchenBoard.tsx:267` calcule un prochain état global et
transforme toutes les lignes Cuisine correspondant à l'état courant. Lors du
passage terminal, les lignes sont servies via
`markOrderItemAsServedAndDeductStock()` à la ligne 306. Le parent est ensuite
mis à jour à partir de la ligne 326.

Conséquences :

- deux pizzas de la même commande ne disposent pas réellement d'un cycle
  indépendant dans cette interface ;
- la Cuisine dépasse la responsabilité cible `pending → preparing → ready` ;
- pour certains types de commande, `ready` peut évoluer vers `picked_up`, ce
  qui mélange production et remise.

### 6.2 POS

`src/app/(dashboard)/pos/components/POSClient.tsx:1504` sert une ligne directe
ou Bar via le moteur central. Après résultat, le composant vérifie localement
si toutes les entrées de `items[]` sont servies et écrit alors les champs
globaux autour des lignes 1553–1571.

Le déclencheur de stock est correct : l'événement de service de ligne, jamais
le paiement. Mais le calcul global reste dupliqué dans l'interface.

### 6.3 Réparation automatique

`src/modules/restaurant-live/RestaurantLiveDataProvider.tsx:177` à `190`
complète automatiquement `kitchenStatus` lorsqu'il manque. Ce comportement
modifie une commande pendant sa lecture et empêche de distinguer nettement
l'historique legacy d'une commande canonique. La cible prévoit une lecture
compatible, pas une réparation silencieuse.

## 7. Statuts réellement coexistants

### 7.1 Parent

Les champs suivants coexistent :

- `orderStatus` ;
- `kitchenStatus` ;
- ancien `status` ;
- `sessionActive` ;
- `completedAt` ;
- booléen `cancelled`.

`src/lib/order-lifecycle.ts:182` résout l'état avec la priorité :

```text
kitchenStatus ?? status ?? orderStatus
```

Une valeur `orderStatus` plus récente peut donc être masquée par un ancien
`kitchenStatus`. Les fonctions de normalisation convertissent en outre
`picked_up` et `completed` vers des représentations « servies » selon le
contexte. Cette compatibilité est utile à l'affichage, mais impropre comme
source d'une décision d'écriture.

### 7.2 Lignes

Les états rencontrés ou autorisés incluent :

- `pending` ;
- `preparing` / variantes normalisées ;
- `ready` ;
- `served` ;
- `picked_up` ;
- `cancelled` ;
- `completed`.

Lorsqu'une ligne embarquée ne porte pas de statut, `getOrderItemStatuses()`
retombe sur l'état du parent (`src/lib/order-lifecycle.ts:186`). Une commande
globale peut donc donner artificiellement le même état à toutes ses lignes.

### 7.3 Absence d'état global dérivé unique

Aucune fonction de type `recalculateOrderAggregate()` n'existe dans le code.
Les règles suivantes ne sont donc pas garanties universellement :

```text
toutes les quantités actives servies
  => orderStatus = served

toutes les quantités actives servies ET paiement confirmé
  => orderStatus = completed
```

Les créateurs publics contredisent directement la seconde règle en initialisant
des commandes directes à `completed`.

## 8. Paiement, service et clôture

### 8.1 Alignement déjà obtenu

Le parcours POS récent appelle
`processOrderPaymentTransaction()` depuis `POSClient`. Il ne déduit pas le
stock au paiement. La déduction automatique est déclenchée uniquement par
`markOrderItemAsServedAndDeductStock()`.

### 8.2 Divergences

- `src/components/orders/PaymentModal.tsx:143` vérifie un paiement espèces par
  `updateDoc` direct ;
- `src/modules/public/components/QRPaymentModal.tsx:97` et `114` écrivent
  directement les demandes espèces/mobile ;
- le Manager possède aussi des mises à jour directes de paiement ;
- annulation et remboursement sont portés par des champs partiellement
  indépendants, sans machine d'état commerciale unifiée ;
- la clôture de table et `completed` ne sont pas régies par un agrégateur
  commun.

Le paiement n'est donc pas encore un axe uniforme même si le parcours POS
principal respecte désormais l'absence de déduction au paiement.

## 9. Stock : points de contact

### 9.1 Moteur central de service

`markOrderItemAsServedAndDeductStock()` est la seule fonction active trouvée
qui relie le service d'une ligne au stock V2. Elle est appelée par :

- le POS ;
- la Cuisine.

Sa transaction lit la ligne canonique, l'association produit/article et la
balance, puis met à jour/crée :

- `stockBalancesV2` ;
- `stockOperationsV2` ;
- `stockServingProgressV2` ;
- `stockIdempotencyV2` ;
- `orderItems/{orderItemId}` ;
- la projection `orders.items[]`.

Elle porte donc déjà le bon invariant : stock au service réel et idempotence
par ligne.

### 9.2 Autres services stock

- `supply-expense.service.ts` modifie le stock pour les approvisionnements ;
- le repository Controlled Stock traite contrôles, pertes et corrections ;
- `inventory.service.ts` conserve des traitements V1 basés sur `items[]`.

Les deux premiers appartiennent à d'autres événements métier légitimes.
`inventory.service.ts` ne doit en revanche jamais redevenir un chemin de
déduction de vente : il constitue un moteur legacy encore appelable.

Le fichier Functions de déduction automatique subsiste également comme code
historique. Il ne doit pas être réexporté ou réactivé en parallèle du moteur
client transactionnel actuel.

## 10. Firestore Rules

### 10.1 Commande parent

Les Rules valident à la création la présence de `items[]`, un total et certains
statuts. Elles autorisent plusieurs sources publiques et POS. Elles n'exigent
pas :

- la création simultanée de `orderItems` ;
- l'identité des IDs parent/sous-collection ;
- l'équivalence des quantités et états ;
- le recalcul `paid + served = completed`.

### 10.2 Sous-collection `orderItems`

À partir de `firestore.rules:1885` :

- lecture : `canUseRestaurant(restaurantId)` ;
- création : `canUseRestaurant(restaurantId)` ;
- mise à jour de service : contraintes spécifiques.

Une session publique QR non membre du restaurant ne peut donc ni créer ni lire
les lignes canoniques. Ce n'est pas un simple oubli du composant : le contrat
de sécurité actuel rend impossible une création canonique publique directe.

### 10.3 Mutation Cuisine

`isKitchenProductionUpdate()` autour de `firestore.rules:677` autorise encore
la mutation de la projection `items[]` et des champs globaux. Les Rules
entérinent donc le modèle actuel par commande globale au lieu de limiter la
Cuisine aux sous-documents de ses lignes.

### 10.4 Garde-fou recommandé

Ne pas résoudre le blocage public par un `allow create: if true` sur
`orderItems`. La création canonique publique doit passer par une frontière
authentifiée et validée côté serveur, ou par un protocole Rules strict dont
l'intégrité parent/lignes est prouvée atomiquement.

## 11. Responsabilités réellement implémentées

| Rôle / poste | Responsabilité actuelle | Écart cible |
|---|---|---|
| Caissier POS | crée, paie, sert direct et Bar, agrège localement | L'agrégation doit sortir de l'UI |
| Cuisine | prépare et peut servir les lignes Cuisine | Doit s'arrêter à `ready` |
| Manager | supervise et peut modifier certains paiements | Les mutations doivent passer par les moteurs dédiés |
| Client QR/public | crée le parent et initie le paiement | Ne crée pas les lignes canoniques |
| Serveur | libellé de rôle visible dans certains types/UI | Pas de home/route dédiée dans `guards.ts` |
| Bar | `preparationMode=bar`, géré par le POS | Conforme à la décision actuelle, pas de poste autonome |
| Livreur | aucun rôle dédié | Conforme à la décision actuelle |

`src/lib/guards.ts` ne définit un home opérationnel que pour Owner, Manager,
Caissier et Cuisine. Il ne fournit aucun parcours Serveur. Créer maintenant un
nouveau portail Serveur ou Bar serait donc hors des décisions produit.

## 12. Matrice par canal

| Canal | Création canonique | Préparation | Service | Paiement | Clôture |
|---|---|---|---|---|---|
| POS comptoir | Partielle | Direct prêt immédiatement ; Cuisine via KitchenBoard | Direct/Bar au POS ; Cuisine encore en Cuisine | Service POS central | Locale et non uniforme |
| Salle / table POS | Partielle | Même mécanisme | POS, sans rôle Serveur dédié | Avant ou après selon action | Table fermée selon plusieurs conditions |
| QR à table | Non | Parent lu par Cuisine via `items[]` | Pas de ligne canonique garantie | Demande cash/mobile directe | Non centralisée |
| À emporter POS | Partielle | Cuisine si nécessaire | POS/Cuisine selon ligne | Généralement encaissé au POS | `picked_up` et `served` se chevauchent |
| À emporter public | Non | Préparation conditionnée par paiement dans l'UX Cuisine | Aucun moteur de ligne garanti | Pending cash/mobile | Direct sans Cuisine initialisé `completed` |
| Livraison POS | Partielle | Cuisine si nécessaire | Pas d'axe de remise/livraison dédié | POS | `picked_up` surchargé |
| Livraison publique | Non | Même limite que l'emporté public | Aucun suivi coursier canonique | Paiement préalable demandé | Pas de `handed_to_courier` / `delivered` distinct |

## 13. Commandes mixtes

Le modèle cible exige des cycles indépendants, par exemple :

```text
Coca Cola : pending → ready → served
Pizza     : pending → preparing → ready → served
Jus       : pending → ready → served
```

L'existant ne le garantit pas :

- la Cuisine fait progresser en groupe les lignes partageant le même état ;
- les interfaces lisent essentiellement la projection parent ;
- le parent peut être marqué `served` par un calcul local POS ;
- une ligne QR/publique peut ne pas avoir de sous-document ;
- aucune fonction centrale ne recalcule la commande après chaque mutation.

Le moteur de stock, lui, est déjà par ligne et idempotent. Il ne faut pas le
remplacer ; il faut faire converger les producteurs d'événements de service
vers lui.

## 14. Incohérences classées

### Bloquantes

1. **Créateurs publics parent-only** : le moteur central ne peut pas servir ces
   lignes.
2. **Rules incompatibles avec la création publique de `orderItems`**.
3. **Création POS non atomique** : parent ou ensemble de lignes partiel
   possible.
4. **Absence d'agrégateur** : aucun invariant global universel.
5. **Deux autorités apparentes** : projection parent et sous-collection.

### Élevées

6. La Cuisine sert encore les lignes et modifie le parent.
7. Des commandes sans Cuisine naissent directement `completed`.
8. Deux services de commande presque homonymes portent des contrats différents.
9. Le paiement possède plusieurs écrivains directs.
10. Les anciennes routes créent encore des formats incompatibles.
11. La résolution `kitchenStatus ?? status ?? orderStatus` peut masquer l'état
    commercial réel.

### Moyennes

12. Réparation automatique de `kitchenStatus` pendant la lecture temps réel.
13. `picked_up` mélange production, remise et livraison.
14. Annulation et remboursement sont surtout portés par des booléens globaux.
15. Des commentaires du service récent mentionnent encore une déduction au
    paiement, alors que le comportement réel a été corrigé.

## 15. Garde-fous pour les lots suivants

### 15.1 Garde-fous de code à introduire au LOT 1

- un seul service exporté pour créer une commande ;
- interdiction des `addDoc(collection(..., "orders"))` hors de ce service ;
- création atomique parent + toutes les lignes ;
- `orderItemId` généré avant l'écriture et réutilisé partout ;
- aucun statut global `completed` décidé par le créateur ;
- aucun appel au stock depuis la création ou le paiement ;
- projection `items[]` construite uniquement à partir des mêmes entrées
  canoniques ;
- échec total si une ligne ne peut pas être créée.

### 15.2 Garde-fous d'architecture

- définir une frontière serveur pour QR/public avant de toucher aux Rules ;
- centraliser les commandes de ligne avant de retirer les écritures directes ;
- introduire l'agrégateur seulement après le contrat canonique ;
- conserver la lecture legacy pour l'historique, sans réparation automatique ;
- retirer progressivement les lecteurs `items[]` au LOT 8, pas au LOT 1 ;
- ne pas créer de rôle Serveur, Livreur ou poste Bar.

### 15.3 Garde-fous de tests

Le LOT 1 devra échouer si :

- un canal crée un parent sans toutes ses lignes ;
- un ID de projection diffère de l'ID du sous-document ;
- une création interrompue laisse un parent exploitable ;
- une commande publique contourne la validation serveur ;
- une création modifie une balance de stock ;
- le paiement modifie `servedQuantity` ;
- une commande directe naît `completed`.

Des tests de règles devront couvrir séparément :

- création POS authentifiée ;
- création QR/publique via la frontière retenue ;
- refus de création isolée d'une ligne ;
- refus de modification des champs immuables ;
- refus d'une mutation Cuisine au-delà de `ready`.

## 16. Registre des fichiers prioritaires

### Création

- `src/services/order.service.ts`
- `src/services/orderService.ts`
- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/modules/public/components/CheckoutQRModal.tsx`
- `src/modules/public/components/CheckoutPublicModal.tsx`
- `src/app/r/[slug]/checkout/page.tsx`
- `src/app/(public)/checkout/page.tsx`

### États et lectures

- `src/lib/order-lifecycle.ts`
- `src/modules/orders/OrdersProvider.tsx`
- `src/modules/kitchen/KitchenBoard.tsx`
- `src/modules/restaurant-live/RestaurantLiveDataProvider.tsx`
- `src/app/(dashboard)/orders/components/OrdersClient.tsx`

### Paiement et clôture

- `src/services/pos-security.service.ts`
- `src/components/orders/PaymentModal.tsx`
- `src/modules/public/components/QRPaymentModal.tsx`
- `src/services/table-session.service.ts`

### Stock

- `src/modules/stock/automatic-simple/infrastructure/mark-order-item-served.ts`
- `src/services/inventory.service.ts`
- `src/services/supply-expense.service.ts`
- `functions/src/stock-automatic-simple.ts`

### Sécurité

- `firestore.rules`
- tests Firestore Rules associés aux commandes, paiements et stock

## 17. Décision de sortie du LOT 0

### Acquis

- tous les créateurs actifs et legacy sont identifiés ;
- les écrivains directs de statut et de paiement sont localisés ;
- les lecteurs/écrivains de `items[]` sont recensés par famille ;
- les points de contact stock sont séparés ;
- l'absence d'agrégateur est prouvée ;
- le blocage Rules du canal public est identifié ;
- les écarts avec les décisions produit sont classés.

### GO

GO pour **concevoir précisément le LOT 1** et ses tests à partir de cette
cartographie.

### NO-GO

NO-GO pour modifier immédiatement tous les créateurs sans avoir choisi la
frontière d'écriture des commandes publiques. NO-GO également pour supprimer
`items[]`, modifier le moteur de stock, ajouter des rôles ou centraliser les
statuts dans l'interface.

Le premier livrable du LOT 1 doit être le contrat d'entrée unique et la décision
de sécurité du canal public. L'implémentation ne doit commencer qu'après
validation explicite de ce contrat.
