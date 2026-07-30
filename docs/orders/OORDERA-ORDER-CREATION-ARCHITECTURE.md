# Architecture officielle de création des commandes Ordera

## 1. Statut

| Élément | Valeur |
|---|---|
| Lot | LOT 0.5 — Frontière d'écriture |
| Date | 29 juillet 2026 |
| Nature | Décision d'architecture, sans implémentation |
| Portée | POS, QR à table, salle, emporté et livraison |
| Décision | API serveur unique, transaction Firestore Admin |
| Code, Rules ou données modifiés | Aucun |

Ce document ferme le verrou identifié au LOT 0 : déterminer qui crée les
documents canoniques d'une commande.

## 2. Décision officielle

> **Le navigateur ne crée jamais directement une commande canonique ni ses
> `orderItems`. Tous les canaux appellent une API de création unique, exécutée
> côté serveur. Cette API valide l'intention, recalcule les données faisant
> autorité et crée atomiquement le parent, les lignes et la preuve
> d'idempotence avec Firebase Admin.**

Pour l'architecture actuelle d'Ordera, cette frontière sera un **Route Handler
Next.js hébergé avec l'application sur Firebase App Hosting**, adossé à un
service métier serveur indépendant du transport.

Nom logique de l'opération :

```text
CreateOrder
```

Route proposée :

```text
POST /api/restaurants/{restaurantId}/orders
```

Le Route Handler n'est qu'un adaptateur HTTP. Le contrat, les validations, la
transaction et la sérialisation appartiennent à un module serveur réutilisable,
par exemple :

```text
src/server/orders/create-order-command.ts
src/server/orders/create-order-service.ts
src/server/orders/firestore-order-writer.ts
```

La structure exacte des fichiers sera décidée au LOT 1. Le principe de
séparation est obligatoire.

## 3. Pourquoi cette décision est nécessaire

Le LOT 0 a établi que :

- le POS crée le parent puis les lignes de façon non atomique ;
- les parcours QR et publics créent uniquement `orders.items[]` ;
- une route legacy crée des lignes avec des IDs aléatoires différents ;
- la majorité des interfaces lit encore `items[]` ;
- les Rules autorisent la création publique du parent, mais réservent
  `orderItems` aux membres du restaurant ;
- le moteur de service et de stock exige un `orderItems/{orderItemId}`
  canonique.

Ouvrir la création publique de `orderItems` déplacerait la validation dans des
Rules complexes et exposerait le moteur à des documents inventés par le client.
À l'inverse, Firebase Admin ignore les Rules : l'API serveur doit donc devenir
elle-même la frontière de sécurité et porter toutes les validations.

## 4. Options évaluées

### 4.1 Option A — Écriture directe du parent et des lignes par le client

```text
Navigateur
  └─ batch Firestore
       ├─ orders/{orderId}
       └─ orderItems/{orderItemId}
```

#### Avantages

- fonctionnement simple avec le SDK Web ;
- temps réel natif ;
- moins de code serveur ;
- possibilité de file d'attente hors ligne du SDK.

#### Inconvénients

- le client fournit des champs métier sensibles ;
- les Rules doivent valider chaque produit, prix, quantité, mode de
  préparation, session et agrégat ;
- les limites d'accès documentaire des Rules rendent la validation
  multi-lignes fragile ;
- l'autorisation publique de `orderItems` agrandit fortement la surface
  d'attaque ;
- une application modifiée peut essayer de fabriquer ses propres lignes ;
- la logique canonique serait dupliquée entre clients et Rules.

#### Verdict

**REJETÉE.** La possibilité technique de valider une écriture atomique avec
`getAfter()` ne rend pas cette approche adaptée au domaine Ordera. Les Rules ne
doivent pas devenir le moteur de tarification et de création de commande.

### 4.2 Option B — Le client crée une demande Firestore, un trigger la convertit

```text
Navigateur
  └─ orderCreationRequests/{requestId}
        ↓ trigger
      commande canonique
```

#### Avantages

- le client ne touche pas aux collections canoniques ;
- bonne absorption des requêtes asynchrones ;
- la demande peut être conservée pour audit ;
- possibilité de reprise automatique.

#### Inconvénients

- cohérence éventuelle : la commande n'existe pas à la réponse du clic ;
- gestion d'états `pending/processing/failed/completed` supplémentaire ;
- UX et paiement doivent attendre le trigger ;
- déduplication plus complexe entre le document de demande et la commande ;
- erreurs métier renvoyées indirectement ;
- risque de demandes orphelines ou bloquées ;
- une nouvelle infrastructure d'observation et de reprise est nécessaire.

#### Verdict

**NON RETENUE pour la création nominale.** Le modèle de demande asynchrone reste
pertinent pour des traitements longs ou des imports, pas pour confirmer
immédiatement une commande client.

### 4.3 Option C — HTTPS Callable Cloud Function

```text
Navigateur
  └─ Firebase callable CreateOrder
       └─ transaction Admin
```

#### Avantages

- vérification automatique des jetons Firebase Auth ;
- intégration naturelle d'App Check ;
- runtime indépendant de l'application ;
- capacité de montée en charge distincte ;
- protocole d'erreur Firebase standardisé.

#### Inconvénients

- second runtime et second artefact à déployer ;
- couplage au SDK Callable dans tous les clients ;
- configuration locale et émulateurs supplémentaires ;
- le projet utilise déjà des Route Handlers et Firebase Admin dans Next.js ;
- les Functions actuelles servent surtout des projections et ne portent pas
  encore les commandes ;
- l'application est exclusivement web pour les canaux concernés.

#### Verdict

**ARCHITECTURE DE REPLI, pas architecture officielle actuelle.** Elle serait un
bon choix si Ordera ajoutait des clients mobiles natifs, devait faire évoluer le
moteur indépendamment de l'application ou rencontrait des limites
d'exploitation sur App Hosting.

### 4.4 Option D — Route API Next.js + service serveur + transaction Admin

```text
Navigateur
  └─ POST API même origine
       ├─ Auth / App Check / capacité QR
       ├─ validation et recalcul serveur
       └─ transaction Admin
            ├─ orderCreationIdempotency/{key}
            ├─ orders/{orderId}
            ├─ orderItems/{orderItemId}
            └─ annexes atomiques strictement nécessaires
```

#### Avantages

- réutilise Next.js 15, App Hosting et Firebase Admin déjà présents ;
- même endpoint pour tous les canaux web ;
- réponse synchrone avec `orderId` ;
- transaction atomique côté serveur ;
- logique métier testable sans dépendre du Route Handler ;
- aucun droit de création canonique à accorder au public ;
- même origine HTTP, gestion opérationnelle homogène ;
- migration progressive possible canal par canal.

#### Inconvénients

- le service Admin contourne les Rules : les validations serveur sont
  obligatoires et doivent être testées ;
- l'API partage actuellement le cycle de déploiement de l'application ;
- App Hosting est configuré avec `maxInstances: 1`, à réévaluer avant charge
  significative ;
- aucun App Check n'est actuellement initialisé ;
- le mode hors ligne ne peut pas confirmer une commande côté serveur.

#### Verdict

**RETENUE.**

## 5. Compatibilité avec l'infrastructure réelle

Le dépôt contient déjà :

- Next.js 15 et des Route Handlers sous `src/app/api` ;
- `firebase-admin` côté application ;
- `src/server/firebase-admin.ts` protégé contre l'exécution navigateur ;
- une vérification de jeton Firebase dans
  `src/server/auth/api-auth.ts` ;
- Firebase App Hosting via `apphosting.yaml` ;
- des transactions Admin dans l'API de session de table ;
- des Cloud Functions v2, mais seulement pour les projections Marketplace dans
  l'export actif.

L'architecture choisie ne demande donc pas de nouvelle plateforme. Elle demande
de durcir et généraliser une capacité serveur déjà présente.

Constats de sécurité actuels à traiter :

- aucun usage d'App Check n'a été trouvé ;
- le helper d'authentification anonyme existe, mais aucun appel actif n'a été
  trouvé ;
- l'API de création de session de table accepte actuellement un
  `restaurantId + tableId` sans preuve QR signée ;
- `apphosting.yaml` limite le backend à une seule instance.

## 6. Modèle de confiance

### 6.1 Le client est une source d'intention, jamais d'autorité

Le client peut proposer :

- les IDs de produits et options sélectionnés ;
- les quantités souhaitées ;
- le canal et le type de commande ;
- les coordonnées nécessaires à l'emporté ou la livraison ;
- une session de table ou une capacité QR ;
- une clé d'idempotence.

Le client ne décide jamais :

- le nom produit canonique ;
- le prix unitaire ;
- le total ;
- la taxe, la remise ou les frais autorisés ;
- `preparationMode` ;
- `requiresKitchen` ;
- les IDs des articles de stock ;
- l'état initial d'une ligne ou de la commande ;
- les quantités servies ;
- l'identité du restaurant déduite d'un produit ;
- les timestamps serveur.

### 6.2 L'API fait autorité

L'API :

1. authentifie ou qualifie l'appelant ;
2. vérifie le périmètre restaurant ;
3. charge le restaurant et sa configuration ;
4. vérifie les produits actifs et leurs options ;
5. recalcule les snapshots et montants ;
6. détermine la destination de préparation ;
7. valide la table, la session ou l'adresse ;
8. génère `orderId` et `orderItemId` ;
9. exécute une transaction atomique ;
10. renvoie un résultat minimal et traçable.

### 6.3 Firestore Rules

Après migration de tous les canaux :

- la création directe du parent canonique doit être refusée aux clients ;
- la création directe de `orderItems` doit rester refusée au public ;
- les lectures temps réel restent accordées selon les besoins des interfaces ;
- les mutations ultérieures passent par leurs commandes métier dédiées ;
- Firebase Admin écrit uniquement après les contrôles du service serveur.

Les Rules restent une défense essentielle pour les accès clients, mais elles ne
valident pas les écritures Admin. Les tests du service serveur deviennent donc
aussi importants que les tests Rules.

## 7. Identité et autorisation par canal

### 7.1 Personnel authentifié : POS, Manager et Caisse

Requis :

- jeton Firebase Auth dans `Authorization: Bearer <idToken>` ;
- vérification Admin du jeton ;
- lecture serveur du document utilisateur et de l'appartenance restaurant ;
- rôle autorisé pour `CreateOrder` ;
- session de caisse valide lorsque le canal l'exige.

Le `restaurantId` du chemin ne suffit jamais.

### 7.2 Client QR à table

Requis :

- jeton App Check valide ;
- identité Firebase anonyme recommandée et liée à la demande ;
- **capacité de table signée et à durée limitée**, émise par le serveur lors de
  l'ouverture de la session QR ;
- correspondance stricte :
  `restaurantId + tableId + tableSessionId + expiration` ;
- session Firestore active au moment de la transaction ;
- limite de fréquence par application, identité, session et restaurant.

Le `tableId` visible dans l'URL n'est pas un secret. Il ne constitue pas une
preuve d'accès à la table.

La capacité peut être :

- un jeton signé par le serveur ; ou
- un secret aléatoire opaque dont seule l'empreinte est stockée.

Le choix cryptographique précis appartient au LOT 1, mais les propriétés
suivantes sont obligatoires :

- non forgeable ;
- bornée à une seule session et un restaurant ;
- expirante ;
- révocable par fermeture de session ;
- jamais placée dans un log ;
- transmise dans le corps ou un en-tête, pas comme donnée métier persistante de
  la commande.

### 7.3 Emporté et livraison publics

Requis :

- App Check ;
- identité Firebase anonyme recommandée ;
- validation serveur des coordonnées et du canal ;
- limitation de fréquence multi-niveaux ;
- clé d'idempotence ;
- politique anti-abus distincte des commandes à table.

App Check prouve que l'appel provient d'une instance reconnue de l'application ;
il ne prouve ni l'identité humaine ni l'intention légitime. Il doit être combiné
avec la validation, l'idempotence et le rate limiting.

### 7.4 App Check

App Check est obligatoire avant l'ouverture générale de l'API publique.

Pour une Route API personnalisée, le navigateur envoie le jeton dans
`X-Firebase-AppCheck` et le serveur le vérifie avec Firebase Admin. La
protection anti-rejeu App Check à usage limité peut être évaluée pour
`CreateOrder`, mais ne remplace pas l'idempotence métier.

Références Firebase :

- https://firebase.google.com/docs/app-check/web/custom-resource
- https://firebase.google.com/docs/app-check/custom-resource-backend

## 8. Contrat d'entrée proposé

Exemple conceptuel, non définitif :

```ts
type CreateOrderCommand = {
  schemaVersion: 1
  idempotencyKey: string
  channel: "pos" | "qr_table" | "public_takeaway" | "public_delivery"
  orderType: "dine_in" | "takeaway" | "delivery"
  lines: Array<{
    clientLineId: string
    productId: string
    quantity: number
    optionIds?: string[]
    note?: string
  }>
  table?: {
    tableId: string
    tableSessionId: string
    capability: string
  }
  customer?: {
    name?: string
    phone?: string
  }
  delivery?: {
    address: string
    instructions?: string
  }
}
```

### 8.1 Champs interdits en entrée

Le schéma doit rejeter, et non simplement ignorer, notamment :

- `price`, `unitPrice`, `priceSnapshot` ;
- `total`, `subtotal`, `deliveryFee` imposé par le client ;
- `status`, `orderStatus`, `kitchenStatus` ;
- `servedQuantity`, `servedAt`, `servedBy` ;
- `preparationMode`, `requiresKitchen` ;
- `stockArticleId`, `quantityPerSale` ;
- `createdAt`, `updatedAt` ;
- `paymentStatus=paid`.

Un rejet explicite évite qu'une évolution cliente donne l'impression qu'un
champ sensible est pris en compte.

### 8.2 Validation minimale

- `schemaVersion` supportée ;
- clé d'idempotence bornée et syntaxiquement valide ;
- au moins une ligne et plafond explicite ;
- IDs sûrs ;
- quantités entières positives et plafonnées ;
- produits actifs appartenant au restaurant ;
- options actives et compatibles avec le produit ;
- notes et coordonnées bornées ;
- type cohérent avec le canal ;
- session de table active pour `dine_in` ;
- paiement initial distinct de la création ;
- aucun montant reçu comme autorité.

## 9. Contrat de sortie

Succès :

```ts
type CreateOrderResult = {
  orderId: string
  displayId: string
  idempotencyKey: string
  replayed: boolean
  orderStatus: "pending" | "ready"
  paymentStatus: "unpaid" | "pending_cash" | "pending_mobile"
  total: number
  lineIds: string[]
}
```

L'API ne renvoie pas de données internes inutiles, de secrets de session ou
d'association stock.

Erreurs stables recommandées :

```text
UNAUTHENTICATED
APP_CHECK_REQUIRED
FORBIDDEN
INVALID_COMMAND
INVALID_TABLE_CAPABILITY
TABLE_SESSION_INACTIVE
PRODUCT_NOT_AVAILABLE
OPTION_NOT_AVAILABLE
PRICE_CONFIGURATION_INVALID
IDEMPOTENCY_CONFLICT
RATE_LIMITED
ORDER_CREATION_FAILED
```

Le message utilisateur est séparé du code machine et des détails de log.

## 10. Idempotence

### 10.1 Règle

Un clic, plusieurs retries réseau ou un double envoi produisent une seule
commande.

La clé est générée par le client avant la première tentative et conservée
jusqu'à la réponse. Elle est scoped par :

```text
restaurantId + principalId + channel + idempotencyKey
```

Pour un public anonyme, `principalId` est l'UID anonyme ; pour une table, la
session entre également dans le scope.

### 10.2 Preuve persistée

Document conceptuel :

```text
restaurants/{restaurantId}/orderCreationIdempotency/{stableHash}
```

Champs essentiels :

```ts
{
  restaurantId,
  principalId,
  channel,
  idempotencyKey,
  requestHash,
  orderId,
  createdAt
}
```

La transaction :

- retourne l'ordre existant si la clé et le hash correspondent ;
- retourne `IDEMPOTENCY_CONFLICT` si la même clé porte un contenu différent ;
- ne crée jamais une seconde commande.

Un TTL peut nettoyer les preuves anciennes après une durée métier validée, sans
modifier l'historique de commande.

## 11. Transaction atomique officielle

Séquence logique :

```text
1. Construire toutes les références
2. Lire la preuve d'idempotence
3. Lire restaurant, produits, options et session nécessaires
4. Valider et recalculer
5. Générer parent et lignes canoniques
6. transaction.create(order)
7. transaction.create(orderItem[0..n])
8. transaction.create(idempotencyProof)
9. Mettre à jour la session de table si nécessaire
10. Commit
```

Toutes les lectures transactionnelles doivent précéder les écritures. Firestore
garantit qu'une transaction réussie applique toutes ses écritures ou aucune et
peut rejouer la fonction en cas de concurrence. Aucun effet externe, log
irréversible ou mutation mémoire ne doit donc être placé comme effet métier
dans le callback transactionnel.

Référence Firebase :

- https://firebase.google.com/docs/firestore/manage-data/transactions

### 11.1 Parent

Le parent contient :

- identité et canal ;
- snapshots financiers recalculés ;
- axes globaux initiaux ;
- références table/client ;
- projection temporaire `items[]` ;
- audit de création.

Le créateur ne décide jamais `completed`. L'état initial est dérivé :

- présence d'une préparation : `pending` ;
- lignes toutes directes : `ready` ;
- paiement : état initial séparé, jamais « payé » par simple demande client.

### 11.2 Lignes

Chaque ligne :

- possède un ID stable généré serveur ;
- référence le produit ;
- contient les snapshots nécessaires à l'historique ;
- possède son propre état initial ;
- commence avec `servedQuantity = 0` ;
- ne contient aucun résultat de déduction anticipé.

### 11.3 Projection `items[]`

Pendant la transition :

- elle est créée dans la même transaction à partir des mêmes objets canoniques ;
- ses IDs sont identiques à ceux des sous-documents ;
- elle ne reçoit aucune donnée fournie directement par le client ;
- elle reste une projection de compatibilité jusqu'au LOT 8.

## 12. Données validées et recalculées côté serveur

| Donnée | Source d'autorité |
|---|---|
| Restaurant actif | document restaurant |
| Produit, nom et disponibilité | `products/{productId}` |
| Prix | produit/configuration tarifaire serveur |
| Options et suppléments | configuration du produit |
| Préparation | produit/catégorie normalisés |
| Taxes/remises/frais | configuration restaurant et règles métier |
| Table et zone | table + session active |
| Identité du créateur | Firebase Auth / principal public |
| Timestamps | horloge serveur |
| État initial | moteur de création |
| IDs de lignes | serveur |

Les associations stock peuvent être snapshotées si le contrat métier l'exige,
mais aucune balance n'est lue ou modifiée à la création. La disponibilité
commerciale et le niveau physique de stock sont des validations distinctes.

## 13. Séquence par canal

### 13.1 POS

```text
POS → ID token + commande → API
API → autorisation restaurant/rôle/session caisse
API → validation produits et recalcul
API → transaction canonique
API → orderId
POS → paiement séparé
```

### 13.2 QR à table

```text
Scan QR
  → API session de table
  → session + capacité signée
Client anonyme + App Check
  → API CreateOrder
API
  → vérifie capacité + session active
  → transaction canonique
  → orderId
```

### 13.3 Emporté/livraison publics

```text
Client anonyme + App Check
  → API CreateOrder
API
  → anti-abus + validation canal/coordonnées
  → transaction canonique
  → orderId
Client
  → paiement séparé
```

## 14. Disponibilité et mode hors ligne

Une commande commerciale ne doit pas être affichée comme confirmée tant que le
serveur ne l'a pas créée. En absence de réseau :

- le panier reste local ;
- l'interface indique « En attente de connexion » ;
- le client peut réessayer avec la même clé d'idempotence ;
- aucune fausse référence de commande n'est générée ;
- aucun paiement ne démarre avant confirmation de création.

La file d'attente hors ligne Firestore n'est donc pas utilisée pour créer
silencieusement des commandes canoniques. Cette contrainte est volontaire :
prix, disponibilité, session et configuration doivent être revérifiés au
moment de l'acceptation.

## 15. Anti-abus et observabilité

### 15.1 Défenses obligatoires

- App Check sur les appels publics ;
- Firebase Auth pour le personnel ;
- identité anonyme recommandée pour le public ;
- capacité QR pour les tables ;
- validation stricte du schéma ;
- plafond de lignes et de quantités ;
- rate limiting par IP hachée, app, UID, restaurant et session ;
- idempotence persistante ;
- taille maximale du corps HTTP ;
- délai serveur borné ;
- aucune donnée sensible dans les logs.

### 15.2 Événements de log

```text
ORDER_CREATE_RECEIVED
ORDER_CREATE_AUTHORIZED
ORDER_CREATE_VALIDATED
ORDER_CREATE_COMMIT_STARTED
ORDER_CREATE_COMMITTED
ORDER_CREATE_REPLAYED
ORDER_CREATE_REJECTED
ORDER_CREATE_FAILED
```

Contexte minimal :

```text
requestId, restaurantId, channel, principalType,
idempotencyHash, lineCount, orderId, durationMs, errorCode
```

Ne pas logger :

- jeton Firebase ;
- jeton App Check ;
- capacité QR ;
- téléphone ou adresse en clair ;
- notes client complètes.

### 15.3 Métriques

- taux de succès par canal ;
- rejets par code ;
- taux de rejeu idempotent ;
- latence p50/p95/p99 ;
- contention et retries Firestore ;
- commandes sans lignes : objectif strictement zéro ;
- divergence parent/lignes : objectif strictement zéro.

## 16. Disponibilité opérationnelle

`apphosting.yaml` fixe actuellement `maxInstances: 1`. Ce réglage convient à un
environnement limité, mais devient un risque si toutes les commandes passent
par l'API. Avant activation générale :

- mesurer la charge attendue ;
- autoriser une capacité suffisante ;
- vérifier la région d'App Hosting et celle de Firestore ;
- définir timeouts et alertes ;
- tester les pics simultanés ;
- prévoir la bascule vers une Callable/HTTP Function sans modifier le service
  métier, grâce à la séparation transport/domaine.

Le service métier ne doit dépendre ni de `NextRequest`, ni de `NextResponse`.
Cette règle conserve la portabilité.

## 17. Migration progressive

### Phase 1 — Socle serveur

- contrat et schémas ;
- service métier pur ;
- writer transactionnel Admin ;
- idempotence ;
- authentification staff ;
- App Check et principal public ;
- capacité QR ;
- tests sans raccordement UI.

### Phase 2 — POS

- remplacer `OrderService.createOrder()` côté navigateur par l'API ;
- vérifier parent + lignes atomiques ;
- conserver paiement et service séparés ;
- interdire le fallback silencieux vers l'ancien service.

### Phase 3 — QR à table

- durcir la création de session ;
- émettre la capacité ;
- migrer `CheckoutQRModal` ;
- supprimer son écriture directe du parent.

### Phase 4 — Emporté/livraison publics

- migrer `CheckoutPublicModal` ;
- appliquer anti-abus et idempotence ;
- conserver le paiement séparé.

### Phase 5 — Routes legacy

- rediriger ou raccorder `/r/[slug]/checkout` ;
- supprimer l'usage de `src/services/orderService.ts` ;
- empêcher tout créateur parent-only.

### Phase 6 — Verrouillage

- Rules : refuser les créations directes clientes ;
- tests statiques : aucun `addDoc`/`setDoc` direct vers `orders` ou
  `orderItems` hors infrastructure autorisée ;
- télémétrie : zéro commande canonique partielle.

Chaque phase doit pouvoir être activée par canal. Aucun fallback ne doit créer
un ancien format après une erreur serveur.

## 18. Rollback

Le rollback est un rollback de routage, jamais un retour à une écriture
parent-only.

Options acceptables :

- désactiver un canal de création ;
- rétablir une version précédente de l'API qui respecte déjà parent + lignes ;
- basculer le même service métier vers une Function ;
- maintenir le panier et inviter à réessayer.

Option interdite :

```text
API indisponible → écrire directement dans Firestore depuis le navigateur
```

Cette option détruirait précisément l'invariant que cette architecture crée.

## 19. Tests obligatoires avant LOT 1 terminé

### Unitaires

- validation de chaque canal ;
- rejet des champs sensibles ;
- recalcul des prix et totaux ;
- état initial avec et sans Cuisine ;
- IDs stables ;
- hash d'idempotence ;
- même clé/même payload ;
- même clé/payload différent ;
- plafonds de lignes et quantités.

### Intégration Firestore Admin

- parent + toutes les lignes créés ;
- aucune écriture partielle sur erreur ;
- session de table validée dans la transaction ;
- deux requêtes simultanées produisent une commande ;
- projection `items[]` identique aux lignes ;
- aucun stock modifié ;
- aucun paiement confirmé implicitement.

### API et sécurité

- ID token staff valide/invalide ;
- rôle appartenant à un autre restaurant ;
- App Check absent/invalide ;
- capacité QR expirée, altérée ou fermée ;
- rate limit ;
- corps surdimensionné ;
- données produit falsifiées ;
- tentative d'imposer un prix ou un statut.

### Rules

- refus de création directe de `orderItems` par le public ;
- refus de création directe du parent après migration ;
- lectures encore nécessaires autorisées ;
- service Admin non testé par Rules mais par la suite d'intégration serveur.

### Canaux

- POS comptoir ;
- table POS ;
- QR table ;
- emporté POS et public ;
- livraison POS et publique ;
- commande mixte ;
- retry réseau ;
- double clic.

## 20. Critères GO/NO-GO du LOT 1

### GO

Le LOT 1 peut être déclaré terminé uniquement si :

- tous les nouveaux créateurs passent par la même API ;
- le parent et toutes les lignes sont atomiques ;
- chaque ligne a le même ID dans la projection et le sous-document ;
- le serveur recalcule prix, préparation et totaux ;
- les publics sont protégés par App Check et le protocole de capacité adapté ;
- l'idempotence résiste aux appels concurrents ;
- aucune création ne touche au stock ou ne confirme un paiement ;
- les routes legacy ne peuvent plus créer un format incomplet ;
- les Rules refusent les créations directes après bascule ;
- les tests de sécurité et d'intégration passent.

### NO-GO

- ouverture publique de `orderItems` ;
- confiance dans les prix ou statuts du client ;
- parent créé avant ses lignes ;
- API publique protégée uniquement par `restaurantId`, `tableId` ou CORS ;
- absence de preuve d'idempotence ;
- fallback direct Firestore ;
- App Check présenté comme une authentification utilisateur ;
- logique métier enfermée dans le Route Handler ;
- activation générale avec `maxInstances: 1` non évalué ;
- suppression immédiate de `items[]`.

## 21. Conséquences sur la roadmap

Le verrou d'architecture est levé sous réserve d'approbation de cette décision.
Le LOT 1 peut désormais être conçu autour d'un contrat stable :

```text
Une intention cliente
  → une API serveur
  → une validation autoritative
  → une transaction
  → un parent + n lignes + une preuve d'idempotence
```

Les lots suivants ne doivent pas rediscuter la frontière :

- LOT 2 commande les lignes canoniques ;
- LOT 3 agrège le parent ;
- LOT 4 limite la Cuisine à `ready` ;
- LOT 5 expose le service au POS ;
- LOT 6 sépare paiement et clôture ;
- LOT 8 retire progressivement la dépendance à `items[]`.

## 22. Références

### Documents Ordera

- `OORDERA-ORDER-BUSINESS-ENGINE-LOT-0-CARTOGRAPHY.md`
- `OORDERA-ORDER-BUSINESS-ENGINE-SPECIFICATION.md`
- `OORDERA-ORDER-BUSINESS-DECISIONS.md`
- `OORDERA-ORDER-BUSINESS-ENGINE-IMPLEMENTATION-ROADMAP.md`

### Documentation Firebase officielle

- Transactions et écritures atomiques :
  https://firebase.google.com/docs/firestore/manage-data/transactions
- App Check pour un backend personnalisé :
  https://firebase.google.com/docs/app-check/web/custom-resource
- Vérification serveur App Check :
  https://firebase.google.com/docs/app-check/custom-resource-backend
- Fonctions appelables et jetons automatiques :
  https://firebase.google.com/docs/functions/callable
- Firebase App Hosting :
  https://firebase.google.com/docs/app-hosting/get-started
