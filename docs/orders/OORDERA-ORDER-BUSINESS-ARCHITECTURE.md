# Architecture visuelle du moteur métier des commandes Ordera

| Référence | Rôle |
| --- | --- |
| `OORDERA-ORDER-BUSINESS-ENGINE-SPECIFICATION.md` | Règles normatives détaillées |
| `OORDERA-ORDER-BUSINESS-DECISIONS.md` | Arbitrages produit validés |
| `OORDERA-ORDER-BUSINESS-ENGINE-IMPLEMENTATION-ROADMAP.md` | Ordre futur des lots |
| Ce document | Lecture graphique de l'architecture |

> Ce document ne remplace pas la spécification métier. Il permet d'en
> comprendre les flux, les autorités et les invariants en moins de quinze
> minutes.

## 1. Vue globale

Une commande entre par l'un des quatre canaux officiels. Quel que soit le
canal, elle produit le même parent et les mêmes lignes canoniques.

```mermaid
flowchart TD
    Client[Client]

    subgraph Canaux[Canaux de commande]
        POS[POS avec le caissier]
        QR[QR Code à table]
        Takeaway[Parcours public<br/>À emporter]
        Delivery[Parcours public<br/>Livraison]
    end

    Client --> POS
    Client --> QR
    Client --> Takeaway
    Client --> Delivery

    POS --> Create[createOrder]
    QR --> Create
    Takeaway --> Create
    Delivery --> Create

    Create --> Order[Commande parent<br/>unité commerciale et financière]
    Order --> Items[OrderItems canoniques<br/>unités de production et service]
    Items --> Preparation[Préparation indépendante<br/>par ligne]
    Preparation --> Service[Remise réelle<br/>par ligne]

    Order --> Payment[Paiement global unique]
    Service --> Aggregate[Recalcul de la commande]
    Payment --> Aggregate
    Aggregate --> Completed[Commande completed<br/>toutes les lignes served + paid]
```

Le paiement et le service peuvent survenir dans un ordre différent selon le
canal. Ils convergent vers le même agrégateur.

---

# Comment Ordera réfléchit

Ordera transforme toujours une action d'interface en intention métier. L'écran
demande ; le moteur décide si l'action est valide.

```mermaid
flowchart TD
    Person[Client ou personnel]

    subgraph Channels[Canal]
        POS[POS]
        QR[QR Code]
        Takeaway[Emporté]
        Delivery[Livraison]
    end

    Person --> POS
    Person --> QR
    Person --> Takeaway
    Person --> Delivery

    POS --> Intent[Demande métier]
    QR --> Intent
    Takeaway --> Intent
    Delivery --> Intent

    Intent --> Domain[Moteur métier]
    Domain --> Validation{Action valide ?}
    Validation -->|Non| Reject[Erreur métier explicite]
    Validation -->|Oui| Firestore[Mise à jour Firestore autorisée]
    Firestore --> Aggregate[Recalcul des projections]
    Aggregate --> Realtime[Synchronisation temps réel]
    Realtime --> Screens[Écrans mis à jour]

    Screens -.->|ne décide jamais| Domain
```

| Couche | Responsabilité |
| --- | --- |
| Écran | Capturer l'intention et présenter le résultat |
| Moteur métier | Appliquer les invariants et choisir la transition |
| Firestore | Persister l'état validé |
| Agrégateur | Recalculer la projection globale |
| Temps réel | Propager le nouvel état aux interfaces |

---

# Le cerveau d'Ordera

Les interfaces sont des portes d'entrée. Elles ne contournent jamais les
commandes métier pour modifier Firestore.

```mermaid
flowchart TD
    subgraph Interfaces[Interfaces]
        POS[POS]
        Kitchen[Cuisine]
        QR[QR]
        Bar[Bar géré actuellement par le POS]
        Manager[Manager]
    end

    Interfaces --> Domain[Domain Engine<br/>invariants et transitions]
    Domain --> Permission[Permission Engine<br/>acteur, restaurant, action]
    Permission --> Commands[Business Commands<br/>intentions autorisées]
    Commands --> Firestore[(Firestore<br/>état canonique)]
    Firestore --> Stock[Stock Engine<br/>uniquement au service]
    Firestore --> Aggregate[Aggregate Engine<br/>projection globale]

    Stock --> Firestore
    Aggregate --> Firestore
    Firestore -.->|temps réel| Interfaces

    Interfaces -.->|accès métier direct interdit| Firestore
```

Le diagramme représente des responsabilités architecturales. Une commande
métier orchestre le domaine, les permissions et la transaction ; elle reste le
seul point d'entrée des mutations.

---

# Les quatre moteurs du système

```mermaid
flowchart LR
    Commands[Commandes métier]

    Commands --> Production
    Commands --> Service
    Commands --> Payment

    subgraph Engines[Moteurs à responsabilité unique]
        Production[Production Engine<br/>pending · preparing · ready]
        Service[Service Engine<br/>served · servedQuantity · stock]
        Payment[Payment Engine<br/>paymentStatus · refundStatus]
        Aggregate[Aggregate Engine<br/>projection de la commande]
    end

    Production --> Aggregate
    Service --> Aggregate
    Payment --> Aggregate

    Aggregate --> States[pending · preparing · ready<br/>served · completed · cancelled]
```

| Moteur | Responsabilité unique | Ne fait jamais |
| --- | --- | --- |
| Production Engine | Faire progresser une ligne jusqu'à `ready` | Servir, encaisser ou déduire le stock |
| Service Engine | Confirmer la quantité remise et traiter le stock associé | Confirmer un paiement |
| Payment Engine | Traiter paiement et remboursement | Préparer, servir ou déduire le stock |
| Aggregate Engine | Calculer la projection globale | Modifier une ligne ou une balance |

La séparation empêche qu'un paiement serve une ligne ou qu'une préparation
modifie le stock.

---

# Architecture des modules

```mermaid
flowchart TD
    Orders[Orders]

    Orders --> Creation[Creation]
    Orders --> Items[OrderItems]
    Orders --> Production[Production]
    Orders --> Service[Service]
    Orders --> Payment[Payment]
    Orders --> Aggregate[Aggregate]
    Orders --> Stock[Stock]
    Orders --> Fulfillment[Fulfillment]
    Orders --> Compatibility[Compatibility]
```

| Module | Rôle |
| --- | --- |
| Creation | Crée atomiquement le parent et les lignes canoniques avec des IDs stables |
| OrderItems | Porte l'autorité sur le cycle, les quantités et les acteurs d'une ligne |
| Production | Gère `pending → preparing → ready` selon `preparationMode` |
| Service | Gère la remise réelle, `servedQuantity` et le passage à `served` |
| Payment | Gère le paiement global et les remboursements, indépendamment du service |
| Aggregate | Recalcule le statut parent depuis les lignes et le paiement |
| Stock | Lie une quantité nouvellement servie à une opération Stock V2 idempotente |
| Fulfillment | Suit la remise et la confirmation d'une livraison |
| Compatibility | Lit les formats historiques sans les réparer ni en faire une autorité |

Une nouvelle fonctionnalité doit être rangée dans le module propriétaire de sa
responsabilité, puis exposée par une commande métier.

---

# La vie complète d'une commande

Ce scénario raconte une commande QR à table, de sa création à sa clôture.

```mermaid
sequenceDiagram
    actor Client
    participant QR as QR Code
    participant Create as createOrder()
    participant DB as Firestore
    participant Kitchen as Cuisine
    participant POS
    actor Server as Serveur physique
    participant Service as Service Engine
    participant Stock as Stock Engine
    participant Payment as Payment Engine
    participant Aggregate as Aggregate Engine

    Client->>QR: scanne le QR de la table
    Client->>QR: valide une commande unique
    QR->>Create: intention de création
    Create->>DB: créer le parent
    Create->>DB: créer tous les orderItems canoniques

    DB-->>Kitchen: lignes kitchen uniquement
    Kitchen->>DB: startOrderItemPreparation()
    Kitchen->>DB: markOrderItemReady()

    DB-->>POS: lignes direct et bar
    POS->>DB: préparer/rendre prêtes les boissons

    Server->>Client: remet physiquement les produits
    Server-->>POS: confirme verbalement la remise
    POS->>Service: markOrderItemServed()
    Service->>DB: mettre à jour la ligne
    Service->>Stock: déduire uniquement deltaServed
    Stock->>DB: balance + opération + progression + idempotence

    DB->>Aggregate: recalcul après chaque ligne
    Aggregate->>DB: toutes les lignes deviennent served

    Client->>Payment: paie l'addition globale
    Payment->>DB: confirmOrderPayment()
    DB->>Aggregate: recalculateOrderAggregate()
    Aggregate->>DB: completed
```

Le serveur transporte, mais ne saisit pas la commande et ne possède pas de
parcours métier obligatoire dans Ordera.

---

# Pipeline d'une commande métier

Toutes les commandes métier suivent la même chaîne de contrôle.

```mermaid
flowchart TD
    Command[markOrderItemServed]
    Permission[Permission Engine<br/>acteur et tenant]
    Validation[Validation métier<br/>état, quantité, transition]
    Transaction[Transaction Firestore]
    Stock[Stock Engine<br/>si service suivi]
    Aggregate[Aggregate Engine]
    Parent[Projection parent]
    Realtime[Synchronisation temps réel]
    Screens[POS · QR · Cuisine · Manager]

    Command --> Permission
    Permission --> Validation
    Validation --> Transaction
    Transaction --> Stock
    Transaction --> Aggregate
    Stock --> Aggregate
    Aggregate --> Parent
    Parent --> Realtime
    Realtime --> Screens
```

```mermaid
flowchart LR
    Create[createOrder] --> Pipeline[Pipeline commun]
    Start[startOrderItemPreparation] --> Pipeline
    Ready[markOrderItemReady] --> Pipeline
    Served[markOrderItemServed] --> Pipeline
    Pay[confirmOrderPayment] --> Pipeline
    Cancel[cancelOrder / cancelOrderItem] --> Pipeline
```

Certaines étapes deviennent neutres lorsqu'elles ne concernent pas la commande
appelée. Par exemple, le Stock Engine ne déduit rien pour `markOrderItemReady`
ou `confirmOrderPayment`.

---

## 2. Acteurs

Le diagramme distingue les actions dans Ordera des actions physiques réalisées
hors de l'application.

```mermaid
flowchart LR
    Client[Client]
    Server[Serveur<br/>action physique uniquement]
    Courier[Livreur externe<br/>sans compte Ordera]

    subgraph Ordera[Ordera]
        Create[Création de commande]
        Kitchen[Cuisine<br/>prépare ses lignes]
        POS[POS<br/>encaisse et confirme la remise]
        Stock[Stock<br/>déduit au service]
        Payment[Paiement global]
        Manager[Manager<br/>supervision]
    end

    Client -->|POS, QR ou public| Create
    Create --> Kitchen
    Create --> POS

    Kitchen -->|ligne ready| POS
    Server -.->|transporte les produits| Client
    Server -.->|retour verbal| POS
    POS -->|confirme la ligne served| Stock
    POS --> Payment
    Manager -.->|lecture et contrôle| Ordera

    POS -->|remet la commande prête| Courier
    Courier -.->|livre physiquement| Client
```

```text
Serveur : ne prend pas les commandes dans Ordera et ne possède aucun parcours
métier obligatoire.

Livreur : ne possède ni compte, ni portail, ni application Ordera.
```

---

## 3. Structure des données

### Autorité et projection

```mermaid
flowchart TD
    Parent["restaurants/{restaurantId}/orders/{orderId}"]

    Parent --> Identity[Client, origine, type]
    Parent --> Finance[Total et paiement global]
    Parent --> Aggregate[Projection du statut global]
    Parent --> Legacy["items[]<br/>projection temporaire de compatibilité"]

    Parent --> Subcollection["orderItems/{orderItemId}"]
    Subcollection --> Authority[Autorité métier]

    Authority --> Status[status]
    Authority --> Quantity[quantity / servedQuantity]
    Authority --> Mode[preparationMode]
    Authority --> Actors[preparedBy / servedBy]
    Authority --> Dates[readyAt / servedAt]

    Authority -.->|projection contrôlée| Legacy
    Authority -->|recalcul| Aggregate
```

### Règle de lecture

```mermaid
flowchart LR
    UI[Écrans] --> Commands[Commandes métier]
    Commands --> Items[orderItems]
    Items --> Parent[Projection parent]

    Legacy[items legacy] -. lecture temporaire .-> UI
    UI -.->|écriture directe interdite| Legacy
```

`orderItems` est l'autorité. `items[]` reste temporairement lisible pour la
compatibilité, mais ne constitue jamais une seconde autorité.

---

## 4. Cycle d'une ligne

### 4.1 Service direct

```mermaid
stateDiagram-v2
    [*] --> pending: ligne créée
    pending --> ready: disponible à la remise
    ready --> served: remise réelle confirmée
    served --> [*]
```

### 4.2 Cuisine

```mermaid
stateDiagram-v2
    [*] --> pending: ligne créée
    pending --> preparing: commencer la préparation
    preparing --> ready: marquer comme prête
    ready --> served: remise confirmée depuis le POS
    served --> [*]
```

La Cuisine s'arrête obligatoirement à `ready` dans le périmètre actuel.

### 4.3 Bar

```mermaid
stateDiagram-v2
    [*] --> pending: ligne créée
    pending --> preparing: préparation au comptoir
    preparing --> ready: boisson prête
    ready --> served: remise réelle confirmée
    served --> [*]
```

Le POS gère actuellement les lignes `preparationMode = bar`. Aucun poste Bar
autonome n'est créé.

### 4.4 Service partiel

```mermaid
flowchart LR
    Ready["status = ready<br/>quantity = 3<br/>servedQuantity = 0"]
    Partial["status = ready<br/>servedQuantity = 2<br/>Partiellement servie — 2 sur 3"]
    Served["status = served<br/>servedQuantity = 3"]

    Ready -->|remise de 2| Partial
    Partial -->|remise de 1| Served
```

La ligne conserve `ready` tant que `servedQuantity < quantity`.

---

## 5. Cycle d'une commande

Le parent est recalculé à partir des lignes actives et du paiement.

```mermaid
stateDiagram-v2
    [*] --> pending

    pending --> preparing: au moins une ligne progresse
    pending --> ready: toutes les lignes actives sont prêtes
    preparing --> ready: toutes les lignes non servies sont prêtes

    ready --> served: toutes les lignes served et paiement absent
    ready --> completed: toutes les lignes served et paiement déjà confirmé
    served --> completed: paiement confirmé

    pending --> cancelled: annulation totale autorisée
    preparing --> cancelled: annulation totale autorisée
    ready --> cancelled: annulation totale autorisée

    completed --> [*]
    cancelled --> [*]
```

```text
completed = toutes les lignes actives entièrement servies + paiement confirmé
```

---

## 6. Commande mixte

### Scénario officiel

```text
Table 4
├── 2 Coca Cola — direct
├── 1 Pizza — cuisine
└── 1 Jus — bar
```

```mermaid
sequenceDiagram
    actor Client
    participant QR as QR Code
    participant Order as Commande + OrderItems
    participant POS
    participant Kitchen as Cuisine
    participant Stock
    participant Aggregate as Agrégateur
    participant Payment as Paiement

    Client->>QR: scanne et crée une commande
    QR->>Order: createOrder + 3 lignes canoniques

    Order-->>POS: Coca Cola direct + Jus bar
    Order-->>Kitchen: Pizza uniquement

    POS->>Order: Coca Cola ready
    Kitchen->>Order: Pizza preparing

    Note over Client,POS: Le serveur remet physiquement les Coca Cola
    POS->>Order: markOrderItemServed(Coca, 2)
    Order->>Stock: déduction Coca Cola
    Order->>Aggregate: recalcul
    Aggregate-->>Order: preparing

    POS->>Order: Jus preparing puis ready
    Kitchen->>Order: Pizza ready
    Aggregate-->>Order: ready

    POS->>Order: servir Jus et Pizza après remise
    Order->>Stock: déductions propres à chaque ligne
    Order->>Aggregate: recalcul
    Aggregate-->>Order: served

    Client->>Payment: paie l'addition unique
    Payment->>Aggregate: paiement confirmé
    Aggregate-->>Order: completed
```

Chaque ligne progresse et déduit son propre stock. La commande reste ouverte
tant qu'une ligne active n'est pas entièrement servie.

---

## 7. Moteur de stock

### Transaction de service

```mermaid
flowchart TD
    Command["markOrderItemServed(orderItemId, nouvelleQuantitéServie)"]
    Read[Lire la ligne canonique]
    Delta["deltaServed = nouvelle servedQuantity<br/>- ancienne servedQuantity"]
    Check{deltaServed > 0 ?}
    Association[Lire l'association stock]
    Deduct["Déduction = deltaServed × quantityPerSale"]
    Balance[Mettre à jour stockBalancesV2]
    Operation[Créer stockOperationsV2]
    Progress[Mettre à jour stockServingProgressV2]
    Idempotency[Créer/vérifier stockIdempotencyV2]
    Item[Mettre à jour la ligne]
    Aggregate[recalculateOrderAggregate]
    Replay[Rejeu neutre<br/>aucune déduction]

    Command --> Read --> Delta --> Check
    Check -->|Non| Replay
    Check -->|Oui| Association --> Deduct
    Deduct --> Balance
    Deduct --> Operation
    Operation --> Progress
    Operation --> Idempotency
    Deduct --> Item
    Balance --> Aggregate
    Item --> Aggregate
```

Les écritures de service, balance, opération, progression et idempotence
appartiennent à une même intention atomique.

### Transaction atomique détaillée

```mermaid
flowchart TD
    Command[markOrderItemServed]
    Begin[Début transaction Firestore]
    ReadItem[Lire orderItem canonique]
    ReadProgress[Lire stockServingProgressV2]
    Delta[Calculer deltaServed]
    Replay{Delta déjà traité<br/>ou nul ?}
    ReadAssociation[Lire association produit/article]
    Deduction[Calculer la déduction]

    subgraph Atomic[Bloc atomique : tout réussit ou rien n'est écrit]
        Balance[Mettre à jour stockBalancesV2]
        Operation[Créer stockOperationsV2]
        Progress[Mettre à jour stockServingProgressV2]
        Idempotency[Créer/vérifier stockIdempotencyV2]
        UpdateItem[Mettre à jour orderItem<br/>servedQuantity et status]
    end

    Commit[Commit transaction]
    Aggregate[recalculateOrderAggregate]
    Parent[Mettre à jour la projection parent]
    Neutral[Résultat idempotent<br/>aucune nouvelle déduction]

    Command --> Begin
    Begin --> ReadItem
    ReadItem --> ReadProgress
    ReadProgress --> Delta
    Delta --> Replay
    Replay -->|Oui| Neutral
    Replay -->|Non| ReadAssociation
    ReadAssociation --> Deduction
    Deduction --> Balance
    Deduction --> Operation
    Operation --> Progress
    Progress --> Idempotency
    Idempotency --> UpdateItem
    Balance --> Commit
    UpdateItem --> Commit
    Commit --> Aggregate
    Aggregate --> Parent
```

La commande de service constitue une intention logique unique :

- le bloc Firestore est atomique jusqu'au commit ;
- un échec annule toutes les écritures du bloc ;
- le rejeu retrouve la progression et reste neutre ;
- le recalcul déterministe du parent suit le commit ;
- aucun écran ne reconstitue lui-même cette transaction.

### Événements sans déduction

```mermaid
flowchart LR
    Ready[markOrderItemReady] --> NoStock1[Aucune déduction]
    Payment[confirmOrderPayment] --> NoStock2[Aucune déduction]
    Complete[Passage à completed] --> NoStock3[Aucune seconde déduction]

    NoStock1:::safe
    NoStock2:::safe
    NoStock3:::safe

    classDef safe fill:#f3f4f6,stroke:#6b7280,color:#111827
```

```text
Ready n'est pas Served.
Le paiement ne sert jamais.
Completed ne redéduit jamais.
```

---

## 8. Agrégateur

### Entrées et sortie

```mermaid
flowchart TD
    Items[OrderItems canoniques]
    Payment[paymentStatus]

    Items --> Aggregate[recalculateOrderAggregate]
    Payment --> Aggregate

    Aggregate --> Cancelled{Toutes les lignes annulées ?}
    Cancelled -->|Oui| C[cancelled]
    Cancelled -->|Non| AllServed{Toutes les lignes actives served ?}

    AllServed -->|Oui| Paid{Paiement confirmé ?}
    Paid -->|Oui| Completed[completed]
    Paid -->|Non| Served[served]

    AllServed -->|Non| AllReady{Toutes les lignes non servies ready ?}
    AllReady -->|Oui| Ready[ready]
    AllReady -->|Non| AllPending{Toutes les lignes pending ?}
    AllPending -->|Oui| Pending[pending]
    AllPending -->|Non| Preparing[preparing]
```

### Propriété essentielle

```mermaid
flowchart LR
    A[Ordre des actions A puis B] --> Result[Résultat final unique]
    B[Ordre des actions B puis A] --> Result
```

L'agrégateur ne modifie jamais les lignes et ne déduit jamais le stock.

---

## 9. Commandes métier

Les écrans expriment une intention. Ils n'écrivent jamais directement un
statut.

```mermaid
flowchart TD
    Screens[POS / QR / Cuisine / Manager]

    Screens --> Create[createOrder]
    Screens --> Start[startOrderItemPreparation]
    Screens --> Ready[markOrderItemReady]
    Screens --> Served[markOrderItemServed]
    Screens --> Payment[confirmOrderPayment]
    Screens --> CancelItem[cancelOrderItem]
    Screens --> CancelOrder[cancelOrder]

    Create --> Data[(Firestore)]
    Start --> Data
    Ready --> Data
    Served --> Data
    Payment --> Data
    CancelItem --> Data
    CancelOrder --> Data

    Create --> Aggregate[recalculateOrderAggregate]
    Start --> Aggregate
    Ready --> Aggregate
    Served --> Aggregate
    Payment --> Aggregate
    CancelItem --> Aggregate
    CancelOrder --> Aggregate

    DirectWrite[Écriture directe de status<br/>depuis un écran] -. interdite .-> Data
```

```mermaid
sequenceDiagram
    participant UI as Écran
    participant Command as Commande métier
    participant Rules as Permissions et invariants
    participant DB as Firestore
    participant Aggregate as Agrégateur

    UI->>Command: exprimer une intention
    Command->>Rules: valider acteur et transition
    Rules->>DB: mutation autorisée
    DB->>Aggregate: recalcul demandé
    Aggregate->>DB: écrire uniquement la projection parent
```

---

## 10. Canaux

### 10.1 POS

```mermaid
flowchart LR
    Create[Caissier crée la commande] --> Pay[Paiement immédiat]
    Pay --> Route{Mode de ligne}
    Route -->|direct| ReadyDirect[ready]
    Route -->|bar| PrepareBar[préparation POS] --> ReadyBar[ready]
    Route -->|kitchen| Kitchen[préparation Cuisine] --> ReadyKitchen[ready]
    ReadyDirect --> Handover[Remise confirmée depuis le POS]
    ReadyBar --> Handover
    ReadyKitchen --> Handover
    Handover --> Served[Toutes les lignes served]
    Served --> Completed[completed car paiement confirmé]
```

Le paiement précède généralement la remise, mais ne déduit rien.

### 10.2 QR à table

```mermaid
flowchart LR
    Scan[Client scanne le QR] --> Create[Client crée une commande unique]
    Create --> Split[OrderItems par mode]
    Split --> Prepare[Préparations indépendantes]
    Prepare --> Progressive[Services progressifs confirmés depuis le POS]
    Progressive --> AllServed[Toutes les lignes served]
    AllServed --> Waiting[Commande served<br/>paiement en attente]
    Waiting --> Pay[Paiement global]
    Pay --> Completed[completed]
```

Le serveur transporte les produits et informe verbalement le personnel. Aucun
compte Serveur n'est requis.

### 10.3 À emporter

```mermaid
flowchart LR
    Public[Client crée une commande publique] --> Pay[Paiement préalable obligatoire]
    Pay --> Prepare[Préparation]
    Prepare --> Ready[Prête à être remise]
    Ready --> Handover[Remise au client confirmée]
    Handover --> Stock[Déduction au service]
    Stock --> Completed[completed]
```

Une commande créée directement au POS peut être créée et payée immédiatement
au comptoir. Aucune politique configurable n'est introduite actuellement.

### 10.4 Livraison

```mermaid
flowchart TD
    Create[Client crée la livraison] --> Pay[Paiement préalable obligatoire]
    Pay --> Prepare[Préparation des lignes]
    Prepare --> Ready[ready_for_handover]
    Ready --> Handover[handed_to_courier<br/>personnel du restaurant]
    Handover --> Served[Lignes served]
    Served --> Stock[Déduction unique du stock]
    Stock --> Completed[Commande commerciale completed<br/>served + paid]
    Handover --> Delivery[Livraison physique<br/>sans compte Ordera]
    Delivery --> Confirm[delivery_confirmed<br/>personnel du restaurant]
    Confirm --> NoStock[Aucune seconde déduction]
```

`fulfillmentStatus` reste distinct du statut commercial de la commande.
Aucun compte Livreur, portail Livreur ou suivi GPS n'est requis.

---

## 11. Responsabilités

Le tableau décrit les actions **dans Ordera**. Une action physique hors
application est précisée dans les notes.

| Action | Client | POS | Cuisine | Bar | Serveur | Livreur | Manager |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Créer une commande | **Autorisé** QR/public | **Autorisé** | Interdit | Interdit | Interdit | Interdit | Lecture |
| Préparer une ligne | Interdit | **Autorisé** direct/Bar | **Autorisé** Cuisine | Interdit actuellement | Interdit | Interdit | Lecture |
| Marquer `ready` | Interdit | **Autorisé** direct/Bar | **Autorisé** Cuisine | Interdit actuellement | Interdit | Interdit | Lecture |
| Confirmer `served` | Interdit | **Autorisé** | Interdit | Interdit actuellement | Interdit dans l'app | Interdit | Exception auditée |
| Encaisser | Paiement QR/public | **Autorisé** | Interdit | Interdit | Interdit | Interdit | Supervision |
| Modifier le stock | Interdit | Via commande de service | Interdit à `ready` | Interdit | Interdit | Interdit | Actions métier autorisées |
| Définir `completed` | Lecture | Lecture | Lecture | Lecture | Lecture | Lecture | Lecture |

### Lecture des rôles physiques

```mermaid
flowchart LR
    Server[Serveur sans parcours Ordera] -->|remet physiquement| Customer[Client]
    Server -->|informe verbalement| POS[Personnel au POS]
    POS -->|confirme served| Engine[Moteur]

    POS -->|remet au livreur| Courier[Livreur sans compte]
    Courier -->|livre physiquement| Customer
    POS -->|confirme fulfillment| Engine
```

`completed` est toujours produit par l'agrégateur. Aucun acteur ne l'écrit
directement.

---

## 12. Les 10 règles d'or du moteur Ordera

### 1. Une ligne est l'unité métier

Chaque `orderItem` possède son propre cycle de préparation et de service.

### 2. Une commande est l'unité commerciale

Elle regroupe le client, le canal, le total et une addition globale unique.

### 3. Le paiement ne sert jamais

Confirmer le paiement ne modifie ni `status`, ni `servedQuantity`, ni le stock.

### 4. `ready` n'est pas `served`

`ready` signifie prêt à remettre. `served` signifie réellement remis.

### 5. Le stock est déduit uniquement au service

```text
déduction = deltaServed × quantityPerSale
```

### 6. Le parent est une projection

Le statut global est recalculé depuis les lignes et le paiement.

### 7. `orderItems` est l'autorité

`items[]` n'est qu'une projection temporaire de compatibilité.

### 8. Les écrans utilisent uniquement les commandes métier

Aucun écran ne modifie directement les statuts ou la balance.

### 9. Toutes les lignes servies + paiement confirmé = `completed`

Ni le paiement seul, ni `ready`, ni une action globale ne suffisent.

### 10. Le moteur est identique pour tous les canaux

POS, QR, emporté et livraison créent les mêmes lignes et utilisent les mêmes
commandes métier, permissions, règles de stock et agrégateur.

```mermaid
flowchart LR
    POS[POS] --> Engine[Moteur unique]
    QR[QR Code] --> Engine
    Takeaway[Emporté] --> Engine
    Delivery[Livraison] --> Engine

    Engine --> Canonical[OrderItems canoniques]
    Engine --> Stock[Stock au service]
    Engine --> Aggregate[Agrégateur]
    Engine --> Payment[Paiement indépendant]
```

---

# Philosophie du moteur

```mermaid
mindmap
  root((Moteur Ordera))
    Source unique
      orderItems canoniques
      parent projeté
    Responsabilités séparées
      Production
      Service
      Paiement
      Agrégation
    Mutations contrôlées
      commandes métier
      permissions
      transactions
      idempotence
    Cohérence
      recalcul déterministe
      temps réel
      audit
    Tous les canaux
      POS
      QR
      Emporté
      Livraison
```

| Principe | Pourquoi il rend le moteur robuste |
| --- | --- |
| Une seule source de vérité | Deux écrans ne peuvent pas décider de deux états différents |
| Une responsabilité par moteur | Une évolution du paiement ne modifie pas la production ou le stock |
| Aucune logique métier dans les écrans | POS, QR et Cuisine appliquent exactement les mêmes règles |
| Aucun accès direct aux statuts | Les transitions invalides sont bloquées au même endroit |
| Mutations par commandes métier | Chaque action possède un nom, des permissions et un audit |
| Projections recalculées | Le résultat ne dépend pas de l'ordre d'action des interfaces |
| Stock indépendant du paiement | Seule une remise réelle peut consommer un article |
| Transactions idempotentes | Un rejeu réseau ou un double clic ne produit pas un second effet |
| Compatibilité isolée | L'historique reste lisible sans contaminer le modèle canonique |
| Moteur commun à tous les canaux | Une nouvelle entrée réutilise les invariants existants |

```mermaid
flowchart LR
    Intent[Intention] --> Command[Commande métier]
    Command --> Validate[Validation unique]
    Validate --> Persist[Persistance atomique]
    Persist --> Recalculate[Projection recalculée]
    Recalculate --> Explain[État explicable et auditable]
```

La robustesse vient moins du nombre de composants que de la clarté de leurs
frontières : chaque couche possède une responsabilité, chaque mutation possède
un chemin unique et chaque projection peut être reconstruite depuis les
données canoniques.
