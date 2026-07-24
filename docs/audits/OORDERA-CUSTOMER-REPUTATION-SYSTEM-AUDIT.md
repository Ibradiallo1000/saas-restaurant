# OORDERA - Audit du système de réputation et d'engagement client

Date : 24 juillet 2026

Statut : audit uniquement, aucune implémentation applicative.

## 0. Synthèse exécutive

Oordera possède déjà les briques nécessaires pour prouver qu'une commande a été réellement consommée : commandes centralisées par restaurant, statuts cuisine, timestamps finaux, paiement, suivi public et historique de statut. En revanche, le système d'avis n'existe pas réellement dans le produit.

Le seul élément lié aux avis trouvé dans le code est une méthode legacy `OrderService.submitReview` qui écrit dans une collection globale `reviews`, sans contrôle d'unicité par commande, sans sécurité dédiée, sans intégration au suivi client, sans agrégats Owner, sans projection marketplace et sans réponse restaurateur.

La recommandation est de construire un système additif, piloté par les commandes finalisées, avec :

- des avis restaurant liés à une commande ;
- des avis plats liés aux lignes de commande ;
- des agrégats privés restaurant pour les dashboards ;
- des projections publiques marketplace calculées côté serveur ;
- un score Oordera dérivé, jamais saisi manuellement ;
- des badges automatiques basés uniquement sur des signaux réels.

## 1. État actuel

### 1.1 Stockage des commandes

Les commandes sont stockées principalement dans :

```txt
restaurants/{restaurantId}/orders/{orderId}
```

Preuves code :

- `src/lib/restaurant-firestore-paths.ts`
  - `restaurantOrdersRef(db, restaurantId)` retourne `collection(db, "restaurants", restaurantId, "orders")`.
  - `restaurantOrderRef(db, restaurantId, orderId)` retourne le document de commande restaurant.
- `src/services/orderService.ts`
  - `ordersCollection(restaurantId)` cible `restaurants/{restaurantId}/orders`.
  - `createOrder`, `watchOrders` et `updateOrderStatus` manipulent cette sous-collection.
- `src/services/order.service.ts`
  - `createOrder` écrit dans `restaurants/{restaurantId}/orders`.
  - `processPayment` lit et modifie la même commande.
- `src/modules/public/components/CheckoutPublicModal.tsx`
  - les commandes livraison et à emporter sont créées via `restaurantOrdersRef(db, restaurantId)`.
- `src/modules/public/components/CheckoutQRModal.tsx`
  - les commandes QR table sont créées dans la même sous-collection.
- `src/app/order/[restaurantId]/[orderId]/page.tsx`
  - le suivi client lit `doc(db, "restaurants", restaurantId, "orders", orderId)`.

Il existe également une sous-collection legacy d'items dans `src/services/order.service.ts` :

```txt
restaurants/{restaurantId}/orders/{orderId}/orderItems/{itemId}
```

Mais les flux publics récents stockent surtout un tableau `items` directement dans le document de commande.

### 1.2 Quand une commande est considérée terminée

Les statuts opérationnels centralisés sont définis dans `src/lib/order-lifecycle.ts` :

```ts
ORDER_OPERATION_STATUS = {
  PENDING: "pending",
  IN_PREPARATION: "preparing",
  READY: "ready",
  SERVED: "served",
  PICKED_UP: "picked_up",
  COMPLETED: "completed",
}
```

La fonction `nextOrderStatus` considère :

- une commande sur place `ready -> served` ;
- une commande à emporter `ready -> picked_up` ;
- une commande livraison `ready -> picked_up`.

La cuisine écrit le statut final dans `src/modules/kitchen/KitchenBoard.tsx` :

- `kitchenStatus: newOrderStatus`
- `timestamps.servedAt: serverTimestamp()` pour `served`
- `timestamps.pickedUpAt: serverTimestamp()` pour `picked_up`
- `statusHistory` avec source `kitchen`
- `items[].status = "served"` pour les items cuisine concernés

Les analytics considèrent une commande servie/finalisée via :

- `src/lib/analytics/computeAnalyticsFromOrders.ts`
  - `served`, `picked_up`, `completed`
- `src/lib/order-lifecycle.ts`
  - `normalizeKitchenStatus` mappe `served`, `picked_up`, `completed` vers le statut cuisine servi.

Conclusion : la définition la plus fiable d'une consommation/remise effective est :

```txt
kitchenStatus in ["served", "picked_up", "completed"]
ET
timestamps.servedAt ou timestamps.pickedUpAt présent
```

Pour les anciens documents, les fallbacks `servedAt` et `pickedUpAt` racine existent dans `OrdersProvider.tsx`.

### 1.3 Événements prouvant qu'un client a réellement consommé

Signaux forts existants :

- `timestamps.servedAt`
  - commande servie sur place.
- `timestamps.pickedUpAt`
  - commande remise en livraison ou à emporter.
- `items[].servedAt`
  - item cuisine marqué servi.
- `statusHistory`
  - historique de statut avec source `kitchen`, `service` ou `order`.
- `paymentStatus`
  - `paid`, `verified`, `paye`, `validated` normalisés comme payés dans `src/lib/order-lifecycle.ts`.
- `paidAt`
  - timestamp de paiement.

Signaux faibles :

- `updatedAt`
  - utile pour l'ordre d'affichage, insuffisant pour prouver la consommation.
- `createdAt`
  - utile pour périodes et tendances, insuffisant pour avis.
- `sessionActive === false`
  - pertinent pour table clôturée, mais pas suffisant seul.

Recommandation : autoriser l'avis uniquement quand la commande est finalisée par fulfillment, et idéalement payée ou validée selon le type de flux.

### 1.4 Données client existantes

Les commandes contiennent déjà des données client variables selon le canal.

Public livraison / à emporter (`CheckoutPublicModal.tsx`) :

- `customer.phone`
- `phoneNumber`
- `secondaryPhoneNumber`
- `deliveryAddress`
- `deliveryInstructions`
- `customerNote`
- `paymentProofSms` si paiement mobile

QR table (`CheckoutQRModal.tsx`) :

- `createdBy`
- `createdByLabel`
- `customer.phone: null`
- `customer.name: null`
- `customerNote`
- `tableSessionId`
- `tableId`

POS / service interne (`src/services/order.service.ts`) :

- `customerName`
- `customerPhone`
- `deliveryAddress`

Loyauté (`src/services/loyalty.service.ts`) :

```txt
restaurants/{restaurantId}/customers/{customerId}
```

Le `customerId` est dérivé du téléphone nettoyé. Le service agrège :

- `visits`
- `totalSpent`
- `loyaltyPoints`
- `lastVisit`

Suivi local client (`src/modules/public/orderTrackingStorage.ts`) :

- `restaurantId`
- `orderId`
- `tableSessionId`
- `createdAt`
- `updatedAt`
- `completedAt`
- conservation 24h après fin.

Conclusion : il n'existe pas de compte client public. Le futur système d'avis doit donc reposer sur un droit d'avis lié à la commande, pas sur une authentification client classique.

## 2. Avis restaurant

### 2.1 Architecture recommandée

Créer une collection par restaurant :

```txt
restaurants/{restaurantId}/reviews/{orderId}
```

Utiliser `orderId` comme identifiant de document empêche naturellement plusieurs avis restaurant pour une même commande.

Modèle recommandé :

```ts
RestaurantReview {
  restaurantId: string
  orderId: string
  orderType: "dine_in" | "pickup" | "delivery"
  rating: 1 | 2 | 3 | 4 | 5
  recommended: boolean
  comment: string | null
  author: {
    displayName: string | null
    phoneHash: string | null
    tableLabel: string | null
  }
  source: "order_tracking" | "qr_table" | "pickup_delivery_link"
  status: "published" | "pending_moderation" | "hidden" | "deleted"
  createdAt: Timestamp
  updatedAt: Timestamp
  orderCompletedAt: Timestamp
  reply?: {
    message: string
    authorId: string
    authorRole: "owner" | "manager" | "super_admin"
    createdAt: Timestamp
    updatedAt: Timestamp
  }
  moderation?: {
    hiddenBy?: string
    hiddenAt?: Timestamp
    reason?: string
  }
}
```

### 2.2 Empêcher plusieurs avis pour une même commande

Stratégie prioritaire :

- document ID = `orderId` dans `restaurants/{restaurantId}/reviews/{orderId}` ;
- création via transaction ou Cloud Function ;
- rejet si le document existe déjà ;
- vérification que la commande appartient au restaurant ;
- vérification que la commande est finalisée ;
- vérification d'un jeton d'avis si l'avis est créé depuis une page publique.

Stratégie alternative :

```txt
orderReviewClaims/{restaurantId_orderId}
```

Cette collection peut contenir un token hashé et une date d'expiration, mais elle ajoute de la complexité. Elle n'est utile que si la sécurité client directe ne suffit pas.

### 2.3 Création côté client ou serveur

Éviter une écriture directe non authentifiée dans Firestore. Les règles Firestore peuvent vérifier certaines propriétés de la commande avec `get()`, mais elles sont mal adaptées à :

- token anti-fraude ;
- hash téléphone ;
- limitation temporelle fine ;
- normalisation commentaire ;
- modération ;
- agrégats atomiques.

Recommandation :

- créer une Cloud Function callable ou HTTPS `submitRestaurantReview`;
- entrée : `restaurantId`, `orderId`, `reviewToken`, `rating`, `recommended`, `comment`;
- la fonction valide la commande puis écrit l'avis et met à jour les agrégats.

## 3. Avis plat

### 3.1 Architecture recommandée

Les avis plats doivent être liés aux lignes de commande, pas seulement au produit, pour éviter les doublons quand un même produit apparaît plusieurs fois avec options différentes.

Collection recommandée :

```txt
restaurants/{restaurantId}/dishReviews/{orderId_lineId}
```

Modèle :

```ts
DishReview {
  restaurantId: string
  orderId: string
  lineId: string
  productId: string
  productNameSnapshot: string
  categoryId: string | null
  marketplaceCategoryId: string | null
  rating: 1 | 2 | 3 | 4 | 5 | null
  loved: boolean
  comment: string | null
  quantity: number
  selectedOptionsSnapshot: unknown[]
  createdAt: Timestamp
  updatedAt: Timestamp
  status: "published" | "hidden" | "deleted"
}
```

### 3.2 Limitation à une seule notation par commande

Le document ID doit être déterministe :

```txt
{orderId}_{lineId}
```

Si les lignes de commande n'ont pas d'identifiant stable, ajouter au moment du rendu un identifiant dérivé de :

```txt
productId + index de ligne + options snapshot
```

Mais pour une fiabilité durable, il est préférable que les futurs items aient un `lineId` stable dès la création de commande.

### 3.3 Relation avec les produits

Un avis plat doit garder des snapshots :

- nom du produit au moment de commande ;
- prix payé ;
- options choisies ;
- catégorie locale ;
- catégorie marketplace si déjà mappée.

Ainsi, la suppression ou modification du produit ne casse pas l'historique d'avis.

## 4. Tableau de bord Owner

### 4.1 Données nécessaires

Agrégat recommandé :

```txt
restaurants/{restaurantId}/reviewAggregates/summary
```

Champs :

```ts
RestaurantReviewSummary {
  averageRating: number
  bayesianRating: number
  reviewCount: number
  recommendationRate: number
  ratingDistribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
  unansweredCount: number
  hiddenCount: number
  lastReviewAt: Timestamp | null
  lastComputedAt: Timestamp
}
```

Statistiques temporelles :

```txt
restaurants/{restaurantId}/reviewDailyStats/{yyyy-MM-dd}
```

Champs :

- nombre d'avis ;
- moyenne du jour ;
- recommandation oui/non ;
- nombre de commentaires ;
- nombre d'avis avec réponse ;
- évolution par rapport à J-1, semaine, mois.

Agrégats plats :

```txt
restaurants/{restaurantId}/productReviewAggregates/{productId}
```

Champs :

- `averageRating`
- `reviewCount`
- `lovedCount`
- `loveRate`
- `commentCount`
- `lastReviewAt`
- `marketplaceCategoryId`

### 4.2 Écrans Owner à prévoir

Le dashboard Owner doit afficher :

- note moyenne ;
- nombre total d'avis ;
- évolution sur 7/30 jours ;
- répartition 1 à 5 étoiles ;
- taux de recommandation ;
- commentaires récents ;
- avis sans réponse ;
- réponses du restaurateur ;
- top plats aimés ;
- plats à surveiller.

### 4.3 Managers : accès recommandé

Le projet distingue déjà Owner, Manager, Cuisine, Caisse et autres rôles. Les Managers ont des vues opérationnelles (`src/app/(dashboard)/manager/components/ManagerDashboardView.tsx`) avec métriques commandes et interventions.

Recommandation produit :

- Owner : accès complet aux avis, réponses, modération restaurant, exports.
- Manager : lecture des avis et réponse autorisée si le restaurant active cette permission.
- Cuisine/Caisse/Serveur : pas d'accès par défaut aux avis détaillés ; seulement indicateurs opérationnels anonymisés si nécessaire.
- Super Admin : modération globale et visibilité technique.

Raison : les avis contiennent potentiellement des données personnelles et des critiques sensibles. Les réponses engagent la marque du restaurant.

## 5. Marketplace

### 5.1 État actuel des projections

Collections publiques actuelles :

```txt
marketplaceFoodCategories
marketplaceDishOffers
marketplaceRestaurantCategoryOffers
```

Preuves :

- `src/lib/marketplace-discovery/marketplace-discovery-types.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-sync.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-repository.ts`
- `functions/src/index.ts`

Synchronisation :

- produit modifié : `syncMarketplaceDishOfferOnProductWrite`
- catégorie locale modifiée : `syncMarketplaceDishOffersOnCategoryWrite`
- restaurant modifié : `syncMarketplaceDishOffersOnRestaurantWrite`

La projection `MarketplaceDishOfferDocument` contient déjà :

- restaurant ;
- produit ;
- catégorie locale ;
- catégorie marketplace ;
- prix ;
- image ;
- horaires ;
- `orderCount`.

La projection `MarketplaceRestaurantCategoryOfferDocument` contient :

- une carte par `restaurantId + marketplaceCategoryId` ;
- nombre de produits ;
- prix minimum ;
- image représentative ;
- localisation ;
- horaires.

### 5.2 Limite actuelle de popularité

Le champ `orderCount` est lu par :

- `projectMarketplaceDishOffer`
- `MarketplaceDishRepository.listOffers({ order: "popular" })`
- `PublicPage.tsx` pour trier les produits du menu public.

Mais `docs/marketplace/OORDERA-MARKETPLACE-TECHNICAL-GAPS.md` indique qu'aucun écrivain persistant de `restaurants/{restaurantId}/products/{productId}.orderCount` n'a été prouvé.

Conclusion : ne pas baser la réputation future sur `orderCount` tant qu'un agrégateur fiable n'est pas en place.

### 5.3 Calcul automatique des classements

Restaurants les mieux notés :

- source : `marketplaceRestaurantReputation/{restaurantId}` ou champs ajoutés à `marketplaceRestaurantCategoryOffers`;
- tri : score bayésien, pas moyenne brute ;
- seuil : nombre minimal d'avis.

Plats les plus appréciés :

- source : `productReviewAggregates` projeté vers `marketplaceDishOffers`;
- métriques : `dishAverageRating`, `dishReviewCount`, `lovedCount`, `loveRate`.

Restaurants tendance :

- croissance commandes terminées sur 7 jours ;
- croissance avis récents ;
- activité récente ;
- pénalité si fermé/inactif.

Nouveautés :

- `restaurant.createdAt` ou premier produit publié récent ;
- score plafonné dans le temps ;
- ne pas présenter comme "top" sans données.

Plats populaires :

- commandes terminées par produit sur 7/30 jours ;
- avis plat ;
- coups de coeur ;
- disponibilité.

Restaurants populaires :

- commandes terminées ;
- taux de répétition client ;
- volume pondéré par fraîcheur ;
- score de réputation.

Badges automatiques :

- uniquement issus d'agrégats calculés ;
- jamais ajoutés manuellement dans les cartes publiques.

## 6. Score Oordera

### 6.1 Objectif

Le Score Oordera doit classer les restaurants de manière robuste, même avec peu d'avis, sans favoriser artificiellement un restaurant ayant une seule note 5/5.

### 6.2 Formule recommandée

Score sur 100 :

```txt
Score Oordera =
  35% note bayésienne
+ 15% volume d'avis qualifiés
+ 15% commandes terminées récentes
+ 10% fidélité client
+ 10% taux de commandes finalisées
+ 5% activité récente
+ 5% rapidité du service
+ 5% qualité des données marketplace
- pénalités qualité
```

Variables :

- `bayesianRating`
  - moyenne pondérée avec moyenne globale de la plateforme.
- `qualifiedReviewVolumeScore`
  - logarithmique pour éviter l'effet taille brute.
- `recentCompletedOrdersScore`
  - commandes servies/remises sur 7/30 jours.
- `loyaltyScore`
  - visites répétées depuis `restaurants/{restaurantId}/customers`.
- `completionRate`
  - commandes finalisées / commandes créées.
- `recentActivityScore`
  - activité produits + commandes + horaires actifs.
- `serviceSpeedScore`
  - différence entre `createdAt` et `timestamps.servedAt` / `timestamps.pickedUpAt`.
- `dataQualityScore`
  - image, prix, catégorie marketplace, horaires, localisation.

Pénalités :

- avis récents très négatifs ;
- restaurant fermé/inactif ;
- trop de commandes non finalisées ;
- données publiques incomplètes ;
- détection de fraude.

### 6.3 Pourquoi une note bayésienne

Avantage :

- évite de classer premier un restaurant avec un seul avis 5 étoiles ;
- valorise progressivement la fiabilité statistique ;
- cohérent pour plusieurs centaines de restaurants.

Inconvénient :

- moins lisible qu'une moyenne simple ;
- nécessite d'expliquer en interne les facteurs du score.

## 7. Badges automatiques

Les badges doivent être calculés par un service d'agrégation et exposés dans les projections publiques.

### 7.1 Règles recommandées

`Très bien noté`

- `averageRating >= 4.5`
- `reviewCount >= 20`
- `bayesianRating >= 4.3`
- moins de 10% d'avis 1 ou 2 étoiles sur 30 jours.

`Coup de cœur`

- pour un plat : `lovedCount >= 10` et `loveRate >= 25%`;
- pour un restaurant : plusieurs plats coup de coeur ou recommandation >= 85%.

`Tendance`

- croissance des commandes terminées sur 7 jours >= 30%;
- volume minimal de commandes ;
- activité récente confirmée.

`Top restaurant`

- top 5% du Score Oordera dans une ville ou catégorie ;
- minimum d'avis et commandes ;
- restaurant ouvert/actif.

`Nouveau`

- restaurant créé ou publié depuis moins de 45 jours ;
- au moins un produit découvrable ;
- horaires et localisation configurés.

`Chef recommandé`

- badge automatique réservé aux restaurants avec :
  - `bayesianRating >= 4.4`;
  - `reviewCount >= 30`;
  - au moins 3 plats notés >= 4.5 ;
  - taux de réponse restaurateur >= 50%.

`Service rapide`

- temps médian de service inférieur au seuil de la catégorie ;
- calculé séparément par type de commande.

`Favori local`

- score élevé dans une commune/quartier ;
- fidélité client élevée ;
- activité récente stable.

### 7.2 Champs publics recommandés

Dans les projections :

```ts
badges: Array<{
  key: string
  label: string
  reason: string
  computedAt: Timestamp
}>
```

Le champ `reason` peut rester privé si l'UI publique n'en a pas besoin. Pour éviter toute exposition excessive, les projections publiques peuvent ne garder que `key` et `label`.

## 8. Modèle de données

### 8.1 Nouvelles collections privées

```txt
restaurants/{restaurantId}/reviews/{orderId}
restaurants/{restaurantId}/dishReviews/{orderId_lineId}
restaurants/{restaurantId}/reviewAggregates/summary
restaurants/{restaurantId}/reviewDailyStats/{yyyy-MM-dd}
restaurants/{restaurantId}/productReviewAggregates/{productId}
restaurants/{restaurantId}/reviewModerationEvents/{eventId}
```

Optionnel :

```txt
restaurants/{restaurantId}/reviewInvitations/{orderId}
```

Cette collection stockerait un token hashé, une expiration et l'état `used`.

### 8.2 Nouvelles projections publiques

```txt
marketplaceRestaurantReputation/{restaurantId}
marketplaceDishReputation/{restaurantId_productId}
```

Ou enrichissement des projections existantes :

- `marketplaceDishOffers`
- `marketplaceRestaurantCategoryOffers`

Champs recommandés :

```ts
ratingAverage: number | null
bayesianRating: number | null
reviewCount: number
recommendationRate: number | null
oorderaScore: number | null
badges: string[]
recentOrderScore: number | null
trendScore: number | null
serviceSpeedMedianMinutes: number | null
```

Pour les plats :

```ts
dishRatingAverage: number | null
dishReviewCount: number
dishLovedCount: number
dishLoveRate: number | null
dishBadges: string[]
```

### 8.3 Index Firestore nécessaires

Avis restaurant :

- `restaurants/{restaurantId}/reviews`
  - `status ASC, createdAt DESC`
  - `rating ASC, createdAt DESC`
  - `orderId ASC`
  - `reply.createdAt ASC` ou `hasReply ASC, createdAt DESC`

Avis plats :

- `restaurants/{restaurantId}/dishReviews`
  - `productId ASC, createdAt DESC`
  - `productId ASC, rating DESC`
  - `loved ASC, createdAt DESC`
  - `status ASC, createdAt DESC`

Stats journalières :

- `restaurants/{restaurantId}/reviewDailyStats`
  - `date DESC`

Marketplace :

- `marketplaceRestaurantCategoryOffers`
  - `discoverable ASC, marketplaceCategoryId ASC, oorderaScore DESC`
  - `discoverable ASC, marketplaceCategoryId ASC, ratingAverage DESC`
  - `discoverable ASC, marketplaceCategoryId ASC, trendScore DESC`
  - `discoverable ASC, cityName ASC, oorderaScore DESC`

- `marketplaceDishOffers`
  - `discoverable ASC, marketplaceCategoryId ASC, dishLovedCount DESC`
  - `discoverable ASC, marketplaceCategoryId ASC, dishRatingAverage DESC`
  - `discoverable ASC, normalizedName ASC`

### 8.4 Impacts sur statistiques existantes

Les stats existantes calculent déjà :

- commandes totales ;
- revenus ;
- produits les plus commandés ;
- statuts ;
- temps de préparation approximatif.

Le nouveau système ne doit pas remplacer ces calculs. Il doit ajouter :

- agrégats d'avis ;
- agrégats plats ;
- scores marketplace ;
- signaux de satisfaction.

Les écritures d'agrégats doivent être idempotentes et séparées des workflows POS/Cuisine/Paiement.

## 9. Sécurité

### 9.1 Qui peut créer un avis

Recommandation :

- client public : uniquement via une fonction serveur validant `restaurantId`, `orderId` et `reviewToken`;
- staff : non autorisé à créer un avis client ;
- Super Admin : peut créer uniquement en back-office de modération/import si besoin, journalisé.

Conditions serveur :

- la commande existe dans `restaurants/{restaurantId}/orders/{orderId}`;
- la commande est finalisée : `served`, `picked_up` ou `completed`;
- le timestamp final existe ;
- l'avis n'existe pas encore ;
- le token est valide et non expiré ;
- le commentaire est nettoyé et limité.

### 9.2 Qui peut répondre

- Owner : oui.
- Manager : oui seulement si permission restaurant explicite.
- Cuisine/Caisse/Serveur : non par défaut.
- Super Admin : modération, pas réponse commerciale par défaut.

### 9.3 Qui peut modifier

- Client : modifier son avis pendant une courte fenêtre si token valide, ou pas de modification pour une V1 plus simple.
- Owner/Manager : modifier uniquement leur réponse.
- Super Admin : masquer/restaurer/modérer.

### 9.4 Qui peut supprimer

- Client : demander suppression ou supprimer via token valide si V1 le prévoit.
- Owner/Manager : ne doit pas supprimer un avis, seulement répondre ou signaler.
- Super Admin : masquer/supprimer pour abus.

### 9.5 Anti-fraude

Protections :

- un avis par commande restaurant ;
- un avis plat par ligne de commande ;
- token d'avis hashé ;
- expiration du droit d'avis ;
- rate limit par IP/téléphone hashé ;
- blocage des avis sans commande finalisée ;
- stockage d'un `phoneHash`, jamais le téléphone en clair dans les projections publiques ;
- modération automatique des commentaires trop longs ou suspects.

### 9.6 Règles Firestore

Les règles actuelles n'ont pas de `match /reviews` global dédié, malgré `COLLECTION_NAMES.REVIEWS`. Les règles restaurant n'ont pas non plus de sous-collection `reviews`.

Il faudra ajouter des règles explicites :

- avis privés restaurant lisibles par Owner/Manager autorisé ;
- projections publiques lisibles uniquement si `published/discoverable`;
- écritures publiques directes interdites ou strictement limitées ;
- agrégats écrits uniquement par backend Admin SDK.

## 10. UX recommandée

Parcours idéal :

```txt
Commande
-> Service/remise terminé(e)
-> Page suivi affiche le statut final
-> Invitation courte : "Comment s'est passée votre expérience ?"
-> Note restaurant + recommandation
-> Option : noter les plats consommés
-> Commentaire facultatif
-> Merci
-> Agrégats et marketplace mis à jour automatiquement
```

### 10.1 Où déclencher

Point naturel :

- `src/app/order/[restaurantId]/[orderId]/page.tsx`

Cette page sait déjà détecter la fin via `isClientTrackingComplete` et affiche déjà un message qui évoque le partage d'avis.

À éviter :

- bloquer le paiement ;
- bloquer le suivi ;
- demander l'avis avant service/remise ;
- demander plusieurs fois après refresh.

### 10.2 UX restaurant

Owner :

- écran "Avis clients" ;
- filtres par note, date, réponse, plat ;
- réponse rapide ;
- signalement ;
- tendances.

Manager :

- vue lecture/réponse selon permission.

Marketplace :

- ne pas afficher de note si `reviewCount` est trop faible ;
- afficher une mention sobre du type `Nouveau` plutôt qu'une note non fiable ;
- ne jamais afficher de faux badges.

## 11. Compatibilité avec les flux existants

### Marketplace

Compatible si la réputation est projetée dans les read models existants :

- `marketplaceDishOffers`
- `marketplaceRestaurantCategoryOffers`

Ne pas lire les avis bruts depuis la page publique marketplace.

### Menu public

Compatible si les badges et notes restent optionnels et issus de données réelles.

Attention : les consignes UI précédentes interdisent les badges fictifs. Toute note/badge doit être absent tant que les agrégats ne sont pas fiables.

### POS

Ne pas modifier le POS pour la V1. Les commandes POS peuvent devenir éligibles aux avis si elles contiennent un téléphone ou si un reçu/lien d'avis est généré plus tard.

### Cuisine

Ne pas modifier le workflow cuisine. Le système d'avis doit seulement lire les statuts finaux et timestamps.

### Dashboard Owner

Ajouter des widgets et pages dédiés sans changer les métriques financières existantes.

### Dashboard Manager

Ajouter un accès contrôlé par permission, idéalement lecture seule en V1.

### Bibliothèque

Aucun impact direct. Les avis portent sur les produits réellement commandés, pas sur les modèles de bibliothèque.

### Analytics

Les agrégats d'avis complètent `computeAnalyticsFromOrders`, ils ne le remplacent pas.

## 12. Architecture recommandée

### 12.1 Flux d'écriture

```txt
Commande finalisée
-> génération ou activation du droit d'avis
-> client soumet l'avis via fonction serveur
-> écriture RestaurantReview et DishReview
-> mise à jour agrégats privés
-> synchronisation projections publiques
-> marketplace reflète score, notes et badges
```

### 12.2 Services à créer plus tard

```txt
src/lib/reputation/reputation-types.ts
src/lib/reputation/reputation-validation.ts
src/lib/reputation/reputation-aggregates.ts
src/lib/reputation/reputation-score.ts
src/lib/reputation/reputation-badges.ts
src/lib/reputation/reputation-projections.ts
functions/src/reputation-triggers.ts
```

### 12.3 Cloud Functions recommandées

- `submitRestaurantReview`
- `onRestaurantReviewWrite`
- `onDishReviewWrite`
- `rebuildRestaurantReputation`
- `rebuildMarketplaceReputationProjections`

Déclencheurs :

- création/modification d'avis ;
- réponse restaurateur ;
- changement d'état de modération ;
- rebuild planifié de sécurité.

### 12.4 Pourquoi côté serveur

Avantages :

- sécurité ;
- anti-doublon transactionnel ;
- agrégats cohérents ;
- projections publiques sans données privées ;
- possibilité de modération.

Inconvénients :

- plus de complexité ;
- nécessite tests Functions ;
- latence légère entre avis et marketplace.

## 13. Risques

Risques techniques :

- duplication d'avis si l'unicité n'est pas imposée par ID déterministe ;
- exposition de données privées client dans les projections ;
- notes non fiables avec faible volume ;
- agrégats désynchronisés si les triggers échouent ;
- index Firestore manquants ;
- coût de lecture si les avis bruts sont lus directement par le marketplace.

Risques produit :

- restaurateurs frustrés s'ils ne peuvent pas répondre ;
- mauvais usage des badges si les règles ne sont pas transparentes ;
- classement perçu comme injuste si le score Oordera n'est pas stable ;
- faux avis si le token d'avis est faible.

Risques UX :

- demander un avis trop tôt ;
- surcharge de la page de suivi ;
- trop de questions après commande ;
- affichage public de notes non représentatives.

## 14. Dépendances

Dépendances existantes utiles :

- statuts et timestamps dans `src/lib/order-lifecycle.ts`;
- suivi client dans `src/app/order/[restaurantId]/[orderId]/page.tsx`;
- stockage local du suivi dans `src/modules/public/orderTrackingStorage.ts`;
- customers/loyauté dans `src/services/loyalty.service.ts`;
- projections marketplace dans `src/lib/marketplace-discovery`;
- Cloud Functions dans `functions/src/index.ts`;
- règles marketplace existantes dans `firestore.rules`.

Dépendances à ajouter :

- règles Firestore pour avis et agrégats ;
- Functions de soumission et agrégation ;
- tests sécurité ;
- index Firestore ;
- UI de collecte avis ;
- UI dashboard avis.

## 15. Estimation de complexité

Complexité globale : élevée mais maîtrisable si livrée par lots.

Découpage estimatif :

- Lot 0 - modèle, sécurité, tokens : moyen/élevé.
- Lot 1 - avis restaurant V1 sur suivi public : moyen.
- Lot 2 - agrégats Owner : moyen.
- Lot 3 - réponses restaurateur et modération : moyen.
- Lot 4 - avis plats : moyen/élevé.
- Lot 5 - projections marketplace réputation : élevé.
- Lot 6 - Score Oordera et badges : élevé.
- Lot 7 - optimisation, anti-fraude avancée, analytics : élevé.

## 16. Ordre d'implémentation recommandé

1. Définir les types centraux `RestaurantReview`, `DishReview`, `ReviewAggregate`.
2. Ajouter les règles Firestore et les tests de sécurité.
3. Créer une fonction serveur de soumission d'avis restaurant.
4. Ajouter un droit d'avis lié à la commande finalisée.
5. Intégrer une demande d'avis minimale dans la page de suivi.
6. Créer les agrégats restaurant privés.
7. Ajouter l'écran Owner "Avis clients".
8. Ajouter réponses restaurateur et modération.
9. Ajouter avis plats et agrégats produits.
10. Projeter les scores vers le marketplace.
11. Ajouter Score Oordera.
12. Ajouter badges automatiques.
13. Ajouter rebuild idempotent et monitoring.
14. Activer les classements marketplace dynamiques.

## 17. Recommandation finale

GO pour concevoir le système de réputation, mais NO-GO pour afficher notes, badges ou classements publics tant que les agrégats ne sont pas produits par un pipeline fiable.

La V1 la plus sûre est :

```txt
Commande finalisée
-> avis restaurant unique lié à orderId
-> agrégat privé Owner
-> aucun badge public au début
```

Puis :

```txt
avis plats
-> projections marketplace
-> score Oordera
-> badges automatiques
-> classements dynamiques
```

Cette approche respecte l'architecture actuelle : les flux métier restent intacts, les avis sont additifs, et le marketplace ne lit que des projections publiques contrôlées.
