# LOT 4 — Raccordement de la Cuisine au moteur canonique

| Propriété | Valeur |
| --- | --- |
| Statut | Design d’implémentation |
| Portée | Écran `/kitchen` uniquement |
| Autorité des lignes | `orders/{orderId}/orderItems/{orderItemId}` |
| Mutations autorisées | `MarkOrderItemPreparing`, `MarkOrderItemReady` |
| Mutations interdites | service, paiement, annulation, stock, parent |
| Dépendances | LOT 1, LOT 2, LOT 3 et LOT 3.2 validés |
| Hors périmètre | POS, Salle, QR, Livraison, Checkout public |

## 1. Résumé exécutif

La Cuisine actuelle est une interface par **commande parent**, alimentée par
`orders.kitchenStatus` et `orders.items[]`. Elle fait un `updateDoc()` direct du
parent, avance en bloc toutes les lignes Cuisine ayant le même statut et expose
encore une colonne/action `Servies`. Au passage terminal elle appelle également
le moteur client historique de service et de stock.

Le LOT 4 doit remplacer ce chemin actif par une interface par
**`orderItem` canonique** :

```text
listener orderItems Cuisine
        +
projection parent en lecture
        ↓
view-model Cuisine
        ↓
POST commande métier authentifiée
        ↓
markOrderItemPreparing() ou markOrderItemReady()
        ↓
transaction LOT 2 + agrégateur LOT 3
```

Le composant React ne connaît aucune écriture Firestore. La Cuisine s’arrête
strictement à `ready`. `items[]` reste uniquement une projection de
compatibilité. Les commandes non canoniques restent lisibles dans un adaptateur
legacy séparé et sans action.

## 2. Audit de l’existant

### 2.1 Route et composition réellement actives

```text
/kitchen
└── app/(dashboard)/kitchen/page.tsx
    └── KitchenLazy
        └── KitchenClient
            └── OrdersProvider
                └── modules/kitchen/KitchenBoard
                    └── modules/kitchen/KitchenOrderCard
                        └── components/kitchen-ui/*
```

### 2.2 Registre des fichiers Cuisine

| Fichier | Lecture actuelle | Écriture actuelle | Problème | Cible LOT 4 |
| --- | --- | --- | --- | --- |
| `src/app/(dashboard)/kitchen/page.tsx` | Aucune | Aucune | Simple entrée, correct | Conserver |
| `src/app/(dashboard)/kitchen/layout.tsx` | Aucune | Aucune | Aucun garde métier propre à la route | Conserver le shell ; l’identité est validée par le serveur |
| `src/app/(dashboard)/kitchen/components/KitchenLazy.tsx` | Aucune | Aucune | Aucun problème métier | Conserver |
| `src/app/(dashboard)/kitchen/components/KitchenClient.tsx` | `useRestaurant()`, contexte `OrdersProvider` | Aucune | Dépend du provider legacy parent | Remplacer par `KitchenCanonicalProvider`/hook dédié |
| `src/modules/orders/OrdersProvider.tsx` | Six requêtes parent `orders`, `kitchenStatus`, timestamps legacy, `items[]` | Aucune écriture distante ; buffer local | Source parent, nombreuses requêtes, journal Servies, logs ciblés, aucune lecture `orderItems` | Ne plus utiliser dans `/kitchen`; conserver pour ses autres consommateurs jusqu’à leurs lots |
| `src/modules/kitchen/KitchenBoard.tsx` | Commandes parent, `kitchenStatus`, `items[]`, paiement | `updateDoc(orders/{id})`, `items[]`, `kitchenStatus`, `statusHistory` | Mutation directe, progression groupée, source legacy, service Cuisine, stock | Contrôleur par ligne, aucune API Firestore d’écriture |
| `src/modules/kitchen/KitchenBoard.tsx` | Lignes Cuisine dérivées de `items[]` | Appelle `markOrderItemAsServedAndDeductStock()` | Violation majeure : Cuisine sert et peut déduire le stock | Supprimer du nouveau parcours ; seules Preparing/Ready via route serveur |
| `src/modules/kitchen/KitchenOrderCard.tsx` | Statut global via `nextOrderStatus()` | Appelle `onUpdateStatus(order.id, status)` | Action au niveau commande ; propose implicitement `served` | Carte de groupe contenant des actions par ligne uniquement |
| `src/modules/kitchen/kitchen-view-model.tsx` | `order.items[]`, `kitchenStatus`, statuts parent, paiement | Aucune | Modèle centré commande ; libellés `Servir`, `Récupérer`, `Terminer` | Nouveau view-model à partir de `CanonicalKitchenLine` |
| `src/modules/kitchen/KitchenColumn.tsx` | Commandes parent | Aucune | Variante ancienne non utilisée par la route active | Déprécier après preuve d’absence de consommateurs |
| `src/components/kitchen-ui/*` | Contrats de présentation seulement | Aucune | Conforme : primitives stateless et sans Firebase | Réutiliser intégralement |
| `src/components/orders/KitchenBoard.tsx` | `RestaurantOrder.items[]`, statut parent | Callbacks parent | Ancienne implémentation concurrente | Déprécier ; ne pas raccorder |
| `src/components/orders/OrderCard.tsx` | `order.items[]`, statut/paiement parent | Callbacks dont `Servir`/`Annuler` | Composant générique incompatible avec frontière Cuisine | Ne pas utiliser dans LOT 4 |
| `src/utils/preparation-logic.ts` | Champs legacy `destination`, `productionArea`, `preparationMode` | Aucune | Tolérance utile au legacy, pas une autorité canonique | Réserver à l’adaptateur legacy |
| `src/lib/order-lifecycle.ts` | Normalise plusieurs statuts historiques | Aucune | `nextOrderStatus()` fait progresser une commande globale jusqu’au service | Réutiliser seulement les libellés sûrs ; pas le moteur de transition |
| `src/services/notification-sound.service.ts` | Aucune donnée métier | Lecture Web Audio | Son déjà centralisé | Réutiliser derrière détection de nouveaux IDs de ligne |
| `src/server/orders/commands/service.ts` | État fourni par le store | Port transactionnel | Noyau canonique validé | Réutiliser sans duplication |
| `src/server/orders/commands/permissions.ts` | Acteur, canal et mode de ligne | Aucune | Autorise déjà Kitchen uniquement sur Preparing/Ready et mode kitchen | Réutiliser ; résolution acteur côté serveur |
| `src/server/orders/commands/firestore-store.ts` | Parent + sous-collection complète + preuve | Transaction atomique | Conforme LOT 2/3 | Réutiliser |
| `src/server/orders/aggregate/compute.ts` | Toutes les lignes canoniques et paiement | Projection parent dans transaction | Conforme LOT 3 | Réutiliser sans appel depuis React |
| `src/app/api/restaurants/[restaurantId]/orders/route.ts` | Création canonique | Création LOT 1 | Ne traite pas les commandes métier LOT 2 | Conserver ; ajouter une route distincte de mutation |
| `firestore.rules` | Autorisations de lecture et anciennes écritures clientes | Règles existantes | Le nouveau chemin Admin ne doit pas élargir les écritures client | Auditer/tester au LOT 4.1 ; aucune ouverture directe Cuisine |

### 2.3 Listeners et notifications actuels

`OrdersProvider` ouvre actuellement :

1. commandes actives par `kitchenStatus` ;
2. servies du jour via `timestamps.servedAt` ;
3. servies du jour via `servedAt` legacy ;
4. récupérées via `timestamps.pickedUpAt` ;
5. récupérées via `pickedUpAt` legacy ;
6. récupération de statuts `picked_up/completed` ;
7. un listener de diagnostic supplémentaire sur une requête existante.

Le son est déclenché après hydratation lorsqu’un nouvel `orderId` apparaît. Une
seconde alerte compare le nombre d’éléments de `items[]` et le changement de
paiement. Cette logique ne détecte pas proprement une nouvelle ligne canonique
dans une commande déjà connue.

### 2.4 Mutations directes à éliminer du nouveau parcours

Dans `modules/kitchen/KitchenBoard.tsx`, `updateStatus()` :

- calcule le prochain statut à partir du parent ;
- modifie en bloc les entrées `items[]` Cuisine partageant le statut courant ;
- écrit directement `kitchenStatus` ;
- écrit des timestamps et `statusHistory` au parent ;
- peut marquer `served` ;
- peut appeler `markOrderItemAsServedAndDeductStock()`.

Ces comportements sont tous interdits dans le chemin canonique LOT 4.

## 3. Responsabilité officielle de la Cuisine

### 3.1 Autorisé

- lire les `orderItems` dont `preparationMode == "kitchen"` ;
- lire les données parent nécessaires au contexte opérationnel ;
- demander `pending → preparing` ;
- demander `pending → ready` si l’action explicite « Marquer prête » est
  utilisée et si LOT 2 l’autorise ;
- demander `preparing → ready` ;
- consulter la quantité active, variantes, suppléments et notes ;
- regrouper visuellement plusieurs lignes d’une même commande.

### 3.2 Interdit

- `MarkOrderItemServed` ;
- `CancelOrderItemQuantity` ;
- `ConfirmOrderPayment` ;
- toute écriture directe dans `orders`, `orderItems`, `items[]` ou Stock V2 ;
- toute modification de `servedQuantity` ou `cancelledQuantity` ;
- toute clôture de commande ou de table ;
- tout calcul local autoritaire du parent.

## 4. Sources de vérité et contrats de lecture

| Information | Autorité |
| --- | --- |
| Identité/progression/quantités de ligne | `orderItems/{orderItemId}` |
| Éligibilité Cuisine | `preparationMode == "kitchen"` |
| Colonne | `orderItem.status` |
| Quantité affichée | `quantity - cancelledQuantity` |
| Variantes/options/notes de ligne | snapshots immuables de `orderItem` |
| Numéro, table, client, type, heure | parent `orders/{orderId}` en lecture |
| Statut global | `orders.orderStatus`, projection LOT 3 |
| Compatibilité temporaire | `orders.items[]`, lecture legacy uniquement |

Contrat UI recommandé :

```text
CanonicalKitchenLine
├── restaurantId
├── orderId
├── orderItemId
├── version
├── productId / productName
├── preparationMode = kitchen
├── status
├── quantity
├── cancelledQuantity
├── activeQuantity
├── selectedOptions / instructions
└── createdAt / updatedAt

KitchenOrderContext
├── displayId
├── type / serviceMode
├── table
├── customer/delivery context minimal
├── createdAt
└── orderStatus (lecture seulement)
```

## 5. Parcours métier

### A — Nouvelle ligne

```text
orderItem.preparationMode = kitchen
orderItem.status = pending
→ colonne À préparer
→ activeQuantity = quantity - cancelledQuantity
```

### B — Démarrage

```text
POST MarkOrderItemPreparing
→ validation token, rôle, tenant, version
→ transaction LOT 2
→ ligne preparing, version + 1
→ agrégateur LOT 3
→ listener affiche En préparation
```

### C — Fin de préparation

```text
POST MarkOrderItemReady
→ ligne ready, version + 1
→ readyAt/preparedBy via moteur
→ agrégateur LOT 3
→ listener affiche Prêtes
```

La carte `ready` ne comporte plus d’action Cuisine.

### D — Commande mixte

Pour Pizza Cuisine + Coca Bar + Eau direct :

- seule Pizza est présente dans les lignes opérationnelles Cuisine ;
- le contexte peut afficher « Commande mixte » ;
- les lignes Bar/direct ne sont jamais rendues comme actions ;
- leurs mutations temps réel peuvent faire évoluer le parent, sans déplacer la
  Pizza hors de sa colonne propre ;
- la Cuisine ne sert aucune des trois lignes.

### E — Annulation partielle

Afficher `activeQuantity = quantity - cancelledQuantity`. Si le résultat reste
positif, la ligne conserve son statut de préparation et reste actionnable selon
ce statut. L’UI peut indiquer « quantité ajustée » lorsque
`cancelledQuantity > 0`.

### F — Annulation totale

`activeQuantity == 0` ou `status == cancelled` :

- retirer immédiatement la ligne des colonnes actives ;
- afficher éventuellement une notification non bloquante « Ligne annulée » si
  elle était visible ;
- ne proposer aucune action ;
- conserver l’historique dans les données, sans colonne Annulées persistante au
  LOT 4.

### Ligne partiellement servie

Une ligne Cuisine déjà `ready` avec `0 < servedQuantity < activeQuantity` reste
`ready`. Elle ne redevient ni pending ni preparing et ne présente aucune action
de préparation. La remise restante appartient au LOT 5.

## 6. Structure de l’écran

Trois colonnes actives seulement :

| Statut canonique | Colonne | Action |
| --- | --- | --- |
| `pending` | À préparer | Commencer ; Marquer prête |
| `preparing` | En préparation | Marquer prête |
| `ready` | Prêtes | Aucune action Cuisine |
| `served` | Hors vue active | Historique éventuel hors LOT 4 |
| `cancelled` | Hors vue active | Notification transitoire éventuelle |

Chaque groupe de commande affiche :

- référence/numéro ou table ;
- type de commande ;
- heure et temps écoulé ;
- uniquement ses lignes Cuisine ;
- quantité active par ligne ;
- variantes, suppléments, instructions et notes ;
- statut de chaque ligne ;
- action placée sur la ligne concernée.

Prix, détail de paiement, Stock, action Servir et action Encaisser sont absents.
La contrainte de paiement préalable pour takeaway/livraison doit être résolue
par une éligibilité serveur ou un champ parent de lecture, jamais en modifiant
le statut depuis la Cuisine.

Les primitives `components/kitchen-ui` sont conservées. Elles reçoivent des
contrats de présentation et ne lisent jamais Firestore.

## 7. Actions individuelles et groupées

### 7.1 Stratégie officielle

Le LOT 4 expose d’abord l’action ligne par ligne, autorité fondamentale. Il peut
également offrir :

- « Commencer les lignes en attente » ;
- « Tout marquer prêt ».

Une action groupée est une orchestration de commandes canoniques individuelles.
Elle n’est jamais un `updateDoc()` multiple.

### 7.2 Exécution recommandée

- capturer pour chaque ligne `orderItemId`, `version` et une clé indépendante ;
- appeler la route générique avec une concurrence limitée (maximum 3) ;
- conserver chaque succès déjà committé ;
- afficher un bilan `X réussies, Y à actualiser` ;
- laisser le listener remplacer les états locaux ;
- sur échec d’une ligne, ne pas rejouer automatiquement les succès ;
- permettre une nouvelle tentative uniquement pour les échecs avec une nouvelle
  intention ou la même clé selon le résultat précédent.

L’action groupée n’est pas atomique entre lignes. Cette propriété doit être
visible dans le contrat et les tests.

## 8. Lecture temps réel cible

### 8.1 Stratégie retenue

Utiliser deux flux groupés, jamais un listener par commande :

1. une requête `collectionGroup("orderItems")` :
   - `restaurantId == restaurantId courant` ;
   - `preparationMode == "kitchen"` ;
   - `status in ["pending", "preparing", "ready"]` ;
   - tri `createdAt asc` ;
   - limite initiale 200 ;
2. une requête parent `orders` active, limitée et triée, fournissant les
   contextes nécessaires, puis jointure mémoire `orderId`.

La collection-group nécessite un index composite et une Rule de lecture
compatible, à ajouter uniquement avec autorisation au sous-lot 4.2. Elle évite
le N+1 et reste la recommandation unique.

Si un parent contextuel est momentanément absent, afficher la ligne avec sa
référence `orderId` et un contexte « Synchronisation… », sans masquer l’action
si l’autorité canonique est complète. Le serveur revalide toujours la commande.

### 8.2 Pagination et durée d’ouverture

- 200 lignes actives couvrent le tableau opérationnel, avec alerte de
  saturation si la limite est atteinte ;
- pas de pagination dans les trois colonnes actives : les lignes actives ne
  doivent pas disparaître silencieusement ;
- historique servi séparé, chargé à la demande et hors flux actif ;
- unsubscribe systématique au changement de restaurant, à la déconnexion et au
  démontage ;
- horloge unique de page toutes les 30 secondes ;
- regroupement et tri mémoïsés par signatures/version ;
- aucune copie profonde de tous les documents à chaque tick.

### 8.3 Connexion

L’UI expose `connected`, `reconnecting` ou `disconnected`. Hors connexion :

- aucune mutation n’est mise en file localement ;
- boutons désactivés ;
- message « Connexion perdue — aucune action n’a été enregistrée » ;
- reprise par listener puis action explicite.

## 9. Notifications

La notification sonore est basée sur les nouveaux `orderItemId` Cuisine, pas
sur les nouveaux parents.

Règles :

1. construire le set initial sans son ;
2. après la première snapshot complète, sonner une seule fois si un ou plusieurs
   nouveaux IDs pending apparaissent ;
3. regrouper les lignes du même snapshot dans une alerte :
   « 3 nouvelles lignes Cuisine — 2 commandes » ;
4. mémoriser les IDs vus pour la session et les retirer seulement après une
   politique de rétention, pas lorsqu’une ligne change de colonne ;
5. ne jamais sonner pour un simple changement pending → preparing/ready ;
6. demander l’activation audio à la première interaction si le navigateur
   bloque l’autoplay ;
7. si l’onglet est masqué, utiliser titre/son autorisé et alerte in-app au
   retour ; aucune Push API dans ce lot ;
8. respecter `prefers-reduced-motion` pour l’animation, indépendamment du son.

Réutiliser `playNewOrderNotificationSound()`.

## 10. Frontière serveur

### 10.1 Option choisie

Choisir une route générique de commande métier :

```text
POST /api/restaurants/{restaurantId}/orders/{orderId}/commands
```

Une route par commande multiplierait validation, audit HTTP et traduction
d’erreurs. La route générique conserve une allowlist stricte et délègue au
même service LOT 2.

### 10.2 Requête Cuisine

Headers :

```text
Authorization: Bearer <Firebase ID token>
Idempotency-Key: <UUID stable pour l’intention>
Content-Type: application/json
X-Firebase-AppCheck: <token si enforcement activé>
```

Body :

```json
{
  "commandName": "MarkOrderItemPreparing",
  "orderItemId": "item-id",
  "expectedVersion": 3
}
```

ou `commandName = "MarkOrderItemReady"`.

Le body Cuisine ne peut contenir ni acteur, rôle, `sourceChannel`, quantité
servie, paiement, stock, parent ou statut cible libre.

### 10.3 Traitement serveur

1. limiter taille et exiger JSON ;
2. vérifier ID token révoqué ;
3. charger `users/{uid}` et
   `restaurants/{restaurantId}/staff/{uid}` ;
4. vérifier compte actif, appartenance tenant et rôle `kitchen` autorisé ;
5. fixer côté serveur :
   - `actor.id = uid` ;
   - `actor.role = kitchen` ;
   - `actor.restaurantId = restaurantId` ;
   - `sourceChannel = kitchen` ;
6. allowlist uniquement Preparing/Ready sur cette route pour un acteur Cuisine ;
7. appeler `markOrderItemPreparing()` ou `markOrderItemReady()` avec
   `FirestoreAtomicOrderCommandStore` ;
8. retourner le résultat canonique et un `requestId`.

Manager/Owner éventuellement autorisés par le noyau ne sont pas ajoutés à
l’interface Cuisine sans décision distincte. Le rôle transmis par le navigateur
n’est jamais accepté comme autorité.

### 10.4 Réponse

Succès :

```json
{
  "ok": true,
  "commandName": "MarkOrderItemReady",
  "orderId": "...",
  "orderItemId": "...",
  "version": 4,
  "replayed": false,
  "requestId": "..."
}
```

Erreur :

```json
{
  "ok": false,
  "code": "CONCURRENT_MODIFICATION",
  "message": "...",
  "retryable": true,
  "requestId": "..."
}
```

Codes HTTP : 400 JSON, 401 authentification, 403 acteur/tenant, 404
commande/ligne, 409 transition/concurrence/idempotence, 422 contrat, 503 panne
transitoire.

### 10.5 App Check

Recommandation unique : intégrer la vérification App Check dans la route dès
4.1, avec enforcement activé après validation locale et télémétrie de tokens.
Le token d’identité reste obligatoire ; App Check ne remplace jamais
l’authentification utilisateur.

## 11. UX des mutations

- pas de mise à jour optimiste du statut ;
- bouton désactivé et `aria-busy` pendant l’appel ;
- une intention conserve sa clé pendant les retries réseau ;
- au succès, attendre le listener ; si le listener tarde, afficher
  « Enregistré, synchronisation… » ;
- double clic absorbé côté UI et par idempotence serveur ;
- conflit de version : désactiver l’action, laisser le listener actualiser,
  puis inviter à recommencer ;
- timeout sans réponse : retry explicite avec la même clé ;
- erreur définitive : nouvelle intention uniquement après nouvelle lecture ;
- aucune file hors ligne.

## 12. Compatibilité legacy

Classification :

| Format | Présentation | Actions |
| --- | --- | --- |
| `orderItems` complet et `canonicalItemCount` cohérent | Canonique | Preparing/Ready autorisés |
| Parent avec seulement `items[]` | Badge « Commande historique » | Aucune |
| `orderItems` incomplet | Badge « Données incomplètes » | Aucune |
| Statut ancien non normalisable | Badge « Statut historique » | Aucune |
| Commande terminée historique | Historique à la demande | Aucune |

L’adaptateur legacy peut réutiliser temporairement les lectures de
`OrdersProvider`, mais il doit produire un type distinct
`ReadOnlyLegacyKitchenOrder`. Aucun objet legacy ne peut entrer dans le client
de commandes LOT 2. Aucune réparation ou création implicite de `orderItems`.

## 13. Matrice des erreurs UI

| Code métier | Message Cuisine | Action UI |
| --- | --- | --- |
| `INVALID_COMMAND` | Action invalide. Actualisez l’écran. | Bloquer, journaliser `requestId` |
| `ORDER_NOT_FOUND` | Cette commande n’est plus disponible. | Retirer après snapshot |
| `ORDER_ITEM_NOT_FOUND` | Cette ligne n’est plus disponible. | Actualiser les lignes |
| `RESTAURANT_MISMATCH` | Cette ligne appartient à un autre restaurant. | Déconnexion sécurisée/support |
| `FORBIDDEN_ACTOR` | Vous n’êtes pas autorisé à effectuer cette action. | Désactiver les actions |
| `INVALID_TRANSITION` | Cette ligne a déjà changé d’état. Actualisation en cours. | Attendre listener |
| `ITEM_ALREADY_SERVED` | Cette ligne a déjà été remise au client. | Retirer de la vue active |
| `ITEM_CANCELLED` | Cette ligne a été annulée. | Retirer de la vue active |
| `INVALID_QUANTITY` | Quantité de ligne invalide. | Lecture seule/support |
| `QUANTITY_EXCEEDS_REMAINING` | La quantité de cette ligne a changé. | Actualiser |
| `CONCURRENT_MODIFICATION` | Cette commande vient d’être modifiée sur un autre poste. | Attendre listener puis réessayer |
| `IDEMPOTENCY_CONFLICT` | Cette action a déjà été utilisée différemment. | Nouvelle intention après actualisation |
| `IDEMPOTENCY_CORRUPTED` | Action temporairement indisponible. | Support, conserver `requestId` |
| `LEGACY_ORDER_READ_ONLY` | Cette ancienne commande ne peut pas être modifiée depuis ce nouvel écran. | Badge lecture seule |
| `PAYMENT_STATE_INCONSISTENT` | L’état de cette commande doit être vérifié. | Lecture seule/support |
| `NO_CANONICAL_ORDER_ITEMS` | Cette commande historique ne possède pas de lignes exploitables. | Lecture seule |
| `UNAUTHENTICATED` | Votre session a expiré. Reconnectez-vous. | Redirection login |
| `APP_CHECK_REQUIRED` | L’application n’a pas pu être vérifiée. | Recharger/support |
| `STOCK_DEDUCTION_FAILED` | Non applicable à une action Cuisine. | Alerte critique si jamais reçu |
| Erreur réseau/503 | Connexion interrompue. Aucune action n’a été enregistrée. | Retry même clé |

## 14. Performance

- complexité de regroupement O(nombre de lignes actives) ;
- maps `orderId → contexte` et `status → lignes` ;
- clés React = `orderItemId` ;
- `React.memo` sur signature ligne/version, pas sérialisation du parent complet ;
- une horloge partagée toutes les 30 secondes ;
- colonnes virtualisées seulement au-delà d’un seuil mesuré, pas par défaut ;
- aucune écoute Servies dans le flux actif ;
- limite visible et métrique de saturation ;
- test tablette 768 px, écran 1280–1440 px, zoom 200 % et journée complète ;
- suivi des erreurs listener, reconnexions, durée de snapshot et nombre de
  documents.

## 15. Matrice de tests

### 15.1 Tests unitaires

| ID | Preuve |
| --- | --- |
| U1 | Filtre strict `preparationMode == kitchen` |
| U2 | Exclusion Bar et direct |
| U3 | Regroupement par `orderId` sans fusionner les lignes |
| U4 | Colonnes pending/preparing/ready par statut de ligne |
| U5 | `activeQuantity = quantity - cancelledQuantity` |
| U6 | Annulation totale exclue des actions |
| U7 | Ligne partiellement servie reste ready |
| U8 | Tri priorité puis `createdAt` stable |
| U9 | Options, suppléments, instructions et notes |
| U10 | Aucun prix/paiement/stock dans le view-model |
| U11 | Mapping complet des erreurs |
| U12 | Actions uniquement Preparing/Ready |
| U13 | Génération et conservation de clé lors d’un retry |
| U14 | Classification canonical/legacy/partial |
| U15 | Calcul des compteurs par lignes, pas commandes |

### 15.2 Tests composants

| ID | Preuve |
| --- | --- |
| C1 | Carte pending et actions accessibles |
| C2 | Carte preparing |
| C3 | Carte ready sans action Servir |
| C4 | État loading/`aria-busy`/double clic |
| C5 | Erreur compréhensible et focus |
| C6 | Commande mixte : seulement lignes Cuisine |
| C7 | Ligne partiellement annulée |
| C8 | Legacy en lecture seule |
| C9 | Reflow mobile/tablette/zoom 200 % |
| C10 | Thèmes clair/sombre et réduction mouvement |

### 15.3 Tests route et sécurité

| ID | Preuve |
| --- | --- |
| R1 | Token absent/invalide refusé |
| R2 | Compte inactif refusé |
| R3 | Mauvais restaurant refusé |
| R4 | Rôle Kitchen Preparing autorisé |
| R5 | Rôle Kitchen Ready autorisé |
| R6 | Kitchen Served refusé |
| R7 | Kitchen Payment/Cancel refusés |
| R8 | Ligne Bar/direct refusée |
| R9 | Acteur/rôle/source du body ignorés ou rejetés |
| R10 | App Check invalide refusé selon enforcement |
| R11 | Payload et taille stricts |
| R12 | Traduction HTTP et `requestId` |

### 15.4 Tests d’intégration avec émulateur

| ID | Preuve |
| --- | --- |
| I1 | pending → preparing, ligne + parent + audit + preuve |
| I2 | preparing → ready, ligne + parent + audit + preuve |
| I3 | pending → ready autorisé explicitement |
| I4 | Double clic : une mutation |
| I5 | Conflit de version |
| I6 | Nouvelle ligne reçue en temps réel |
| I7 | Commande mixte, autres lignes inchangées |
| I8 | Deux lignes Cuisine à états différents |
| I9 | Action groupée avec succès total |
| I10 | Action groupée partielle, bilan par ligne |
| I11 | Aucune opération/progression/idempotence Stock |
| I12 | Aucun champ de paiement modifié |
| I13 | Aucun `updateDoc()` client du parent |
| I14 | Legacy-only refusé |
| I15 | Sous-collection partielle refusée |
| I16 | `items[]` ambigu ignoré et warning audité |
| I17 | Reconnexion sans alerte sonore initiale |
| I18 | Plusieurs nouvelles lignes = une alerte groupée |
| I19 | Isolation entre restaurants |
| I20 | Rollback serveur laisse ligne et parent identiques |

### 15.5 Non-régression

- LOT 1 ;
- LOT 2 ;
- LOT 3 ;
- LOT 3.2 ;
- Stock ;
- tests Rules lecture collection-group et refus écritures Cuisine ;
- typecheck ;
- build ;
- `git diff --check`.

## 16. Fichiers à réutiliser

- `src/components/kitchen-ui/*` ;
- `src/components/operational-ui/*` et `src/components/pos-ui` pour le shell ;
- `src/services/notification-sound.service.ts` ;
- `src/design-system/context/RestaurantContext` ;
- `src/design-system/context/TenantProvider` ;
- `src/firebase` pour le token et les listeners de lecture ;
- `src/server/firebase-admin.ts` ;
- `src/server/orders/commands/service.ts` ;
- `src/server/orders/commands/permissions.ts` ;
- `src/server/orders/commands/firestore-store.ts` ;
- `src/server/orders/commands/errors.ts` ;
- `src/server/orders/aggregate/compute.ts` ;
- `src/server/orders/common/idempotency.ts` ;
- le modèle de sécurité serveur de
  `src/server/orders/create/security.ts`, factorisé plutôt que copié ;
- le modèle de Route Handler de
  `src/app/api/restaurants/[restaurantId]/orders/route.ts`.

## 17. Fichiers et comportements à déprécier

Sans suppression pendant la conception :

- usage de `OrdersProvider` par `/kitchen` ;
- `KitchenBoard.updateStatus()` et son `updateDoc()` parent ;
- écriture Cuisine de `kitchenStatus`, `items[]`, `statusHistory` et timestamps ;
- appel Cuisine à `markOrderItemAsServedAndDeductStock()` ;
- colonne `Servies` du tableau actif ;
- `actionLabels.served/picked_up/completed` dans le contexte Cuisine ;
- calcul de la prochaine action avec `nextOrderStatus(parent)` ;
- view-model fondé sur `order.items[]` ;
- `src/modules/kitchen/KitchenColumn.tsx` ancien ;
- `src/components/orders/KitchenBoard.tsx` et son usage futur potentiel ;
- logs ciblés `DEBUG_PICKED_UP_ORDER_ID` et listeners diagnostiques une fois la
  nouvelle observabilité validée.

## 18. Découpage d’implémentation

### LOT 4.1 — Frontière serveur

- route générique `/commands` ;
- schéma strict Preparing/Ready ;
- résolution du principal et App Check ;
- traduction des erreurs ;
- tests route, permissions et idempotence.

Critère : aucun rôle Kitchen ne peut invoquer Served/Payment/Cancel.

### LOT 4.2 — Lecture canonique

- index et Rule de lecture collection-group après autorisation ;
- listener `orderItems` groupé ;
- listener contextes parent ;
- jointure, classification legacy et connexion ;
- tests isolation, limites et nettoyage.

Critère : aucun listener par commande, aucune autorité `items[]`.

### LOT 4.3 — View-model et interface

- cartes/lignes canoniques ;
- trois colonnes ;
- actions par ligne ;
- UX erreurs, loading, retry et accessibilité ;
- retrait de Servir/stock/paiement.

Critère : aucun import Firestore d’écriture dans le contrôleur Cuisine.

### LOT 4.4 — Groupes, notifications et performance

- regroupement visuel ;
- orchestration groupée avec résultats partiels ;
- détection des nouveaux `orderItemId` ;
- métriques, saturation et reconnexion.

Critère : aucun son au premier chargement, aucun double son, journée complète
stable.

### LOT 4.5 — Preuves et bascule

- matrice unitaires/composants/intégration/Rules ;
- non-régression LOT 1–3.2 et Stock ;
- feature flag Kitchen canonique ciblé ;
- test local authentifié ;
- désactivation de l’ancien chemin actif sans suppression.

Critère : toutes les preuves vertes et rollback testé.

## 19. Bascule et retour arrière

Utiliser un flag ciblé par restaurant/poste, désactivé par défaut :

```text
KITCHEN_CANONICAL_ORDER_ITEMS
```

Le mécanisme exact doit réutiliser le système de flags réel du projet, pas une
variable supposée.

Phases :

1. lecture canonique cachée avec comparaison ;
2. nouvelle vue en lecture seule ;
3. Preparing/Ready activés pour un restaurant pilote ;
4. validation journée complète ;
5. ancienne mutation désactivée ;
6. élargissement séparé.

Rollback :

- désactiver les actions et repasser la nouvelle vue en lecture seule ;
- si nécessaire, réafficher temporairement l’ancien écran **sans** réactiver
  Servir ni les mutations directes ;
- conserver toutes les mutations canoniques déjà committées ;
- aucune inversion de statut, d’audit ou de donnée ;
- aucun script de réparation improvisé.

## 20. Risques restants et mitigations

| Risque | Niveau | Mitigation |
| --- | --- | --- |
| Rules actuelles non adaptées à `collectionGroup(orderItems)` | Élevé | Sous-lot 4.2 avec index + tests Rules avant activation |
| Parent et lignes reçus à des instants différents | Moyen | Jointure tolérante et autorité ligne |
| Commandes legacy nombreuses dans la file | Moyen | Adaptateur lecture seule et métrique |
| Action groupée partiellement réussie | Moyen | Résultats par ligne, aucun faux rollback |
| Paiement préalable takeaway/livraison | Élevé | Validation serveur/contrat explicite, jamais statut local |
| Rôle Kitchen représenté différemment entre `users` et `staff` | Élevé | Résolveur principal unique et matrice fixtures |
| Saturation au-delà de 200 lignes actives | Moyen | Alerte visible et métrique, pas troncature silencieuse |
| Onglet ouvert toute la journée | Moyen | deux listeners bornés, cleanup, horloge unique |
| Ancien composant réutilisé par erreur | Élevé | tests statiques interdisant imports/mutations |
| App Check non activé sur tous les clients | Moyen | déploiement progressif mesuré avant enforcement |

## 21. Décisions ouvertes et recommandations uniques

| Question | Recommandation |
| --- | --- |
| Route par commande ou générique ? | Une route générique allowlistée `/commands` |
| Ligne ou commande comme carte ? | Groupe visuel par commande, actions et statuts par ligne |
| Action groupée ? | Oui après actions individuelles, orchestration non atomique à concurrence limitée |
| pending → ready direct ? | Autorisé seulement via bouton explicite « Marquer prête », conformément à LOT 2 |
| Lignes annulées ? | Hors colonnes actives, notification transitoire |
| Lignes served ? | Hors flux actif ; historique à la demande hors LOT 4 |
| Temps réel ? | `collectionGroup(orderItems)` + un flux parent, aucun N+1 |
| Mise à jour optimiste ? | Non pour les transitions métier |
| App Check ? | Intégrer en 4.1, enforcement après validation mesurée |
| Legacy ? | Adaptateur typé lecture seule, aucune réparation |
| Paiement en Cuisine ? | Contexte d’éligibilité seulement, aucun détail ni action |
| Rollback ? | Flag ciblé vers lecture seule, jamais retour aux mutations legacy |

## 22. Critères GO / NO-GO d’implémentation

### GO de conception

Le design est prêt à être implémenté si les sous-lots gardent ces barrières :

- seulement `orderItems` comme autorité ;
- seulement Preparing/Ready pour Kitchen ;
- route serveur authentifiée ;
- aucune écriture directe Firestore ;
- parent uniquement par LOT 3 ;
- aucune action de service/stock ;
- commandes mixtes filtrées par ligne ;
- legacy lecture seule ;
- collection-group sécurisée et indexée avant activation ;
- flag et rollback lecture seule.

### NO-GO d’activation

L’activation reste interdite si une seule de ces conditions manque :

- test permettant à Kitchen de servir, payer, annuler ou écrire Stock ;
- import `updateDoc()`/`runTransaction()` dans le nouveau contrôleur Cuisine ;
- lecture autoritaire de `items[]` ;
- rôle navigateur accepté sans résolution serveur ;
- action groupée masquant des échecs ;
- commande legacy actionnable ;
- listener N+1 non borné ;
- Rules/index collection-group non prouvés ;
- non-régression LOT 1–3.2 ou Stock en échec.

## 23. Verdict

**GO pour implémenter le LOT 4 selon les sous-lots 4.1 à 4.5.**

Ce GO autorise la future implémentation ciblée, pas l’activation, le déploiement
ou la suppression immédiate du legacy. L’activation Cuisine canonique restera
NO-GO jusqu’à validation des Rules/index de lecture, des routes serveur, de la
matrice de tests et du rollback ciblé.

