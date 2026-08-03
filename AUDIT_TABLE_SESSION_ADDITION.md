# Audit — Addition de table et commandes multiples

## 1. Fonctionnement actuel

### Collections Firestore concernées

```
restaurants/{restaurantId}
├── tables/{tableId}                          # État de la table (free/occupied, currentSessionId)
├── tableSessions/{tableSessionId}            # Session active/fermée, paymentRequest, totalAmount
├── orders/{orderId}                          # Chaque commande (tableSessionId, total, paymentStatus)
├── visits/{visitId}                          # Historique de visites (tableId, sessionId, createdAt)
└── publicPaymentRequestIdempotency/{hash}    # Clé d'idempotence des paiements
```

### Routes API concernées

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/restaurants/{id}/table-sessions` | POST | Créer/réutiliser une session de table |
| `/api/restaurants/{id}/table-sessions/{sessionId}` | GET | Lire session + agrégats des commandes |
| `/api/restaurants/{id}/orders` | POST | Créer une commande (canonical) |
| `/api/restaurants/{id}/orders/{orderId}` | GET | Lire une commande |
| `/api/restaurants/{id}/table-sessions/{sessionId}/payment-requests` | POST | Demander paiement (client) |
| `/api/restaurants/{id}/table-sessions/{sessionId}/confirm-payment` | POST | Valider paiement (staff POS) |
| `/api/restaurants/{id}/orders/{orderId}/payment-requests` | POST | Payer une commande unitaire (takeaway/delivery) |

### Fichiers côté client

| Fichier | Rôle |
|---------|------|
| `src/modules/public/canonical/public-api-client.ts` | Client API canonique (createTableSession, createOrder, payment, getSession) |
| `src/modules/public/components/CheckoutQRModal.tsx` | Modal de validation de commande QR (dine_in) |
| `src/modules/public/components/CheckoutPublicModal.tsx` | Modal de validation (takeaway/delivery) |
| `src/app/order/[restaurantId]/[orderId]/page.tsx` | Page de suivi de commande (affiche le total, paiement) |
| `src/app/(public)/[slug]/page.tsx` | Page menu public (reçoit les params t, sessionId, mode) |
| `src/services/table-session.service.ts` | Service client Firestore (legacy) |
| `src/modules/public/cart/CartContext.tsx` | Contexte du panier |

### Fichiers serveur

| Fichier | Rôle |
|---------|------|
| `src/app/api/restaurants/[restaurantId]/table-sessions/route.ts` | POST : création/réutilisation session |
| `src/app/api/restaurants/[restaurantId]/table-sessions/[tableSessionId]/route.ts` | GET : agrégats session |
| `src/app/api/restaurants/[restaurantId]/table-sessions/[tableSessionId]/payment-requests/route.ts` | POST : demande de paiement client |
| `src/app/api/restaurants/[restaurantId]/table-sessions/[tableSessionId]/confirm-payment/route.ts` | POST : validation staff |
| `src/app/api/restaurants/[restaurantId]/orders/route.ts` | POST : création commande canonique |
| `src/server/orders/create/` | Logique métier de création de commande |

---

## 2. Cause probable du total limité à la dernière commande

**Observation critique : La page de suivi affiche `sessionTotal` (calcul local) et non `sessionAggregates.totalDue` (calcul serveur).**

### Analyse détaillée

Dans `src/app/order/[restaurantId]/[orderId]/page.tsx` (ligne ~205) :

```typescript
const tableSessionOrdersQuery = useMemoFirebase(() => {
  if (!db || !restaurantId || !activeTableSessionId || useCanonicalQr) return null
  //                                   ↑↑↑↑↑↑↑↑↑↑↑↑↑↑
  return query(
    collection(db, "restaurants", restaurantId, "orders"),
    where("tableSessionId", "==", activeTableSessionId),
    orderBy("createdAt", "desc")
  )
}, [activeTableSessionId, db, restaurantId, useCanonicalQr])
```

**En mode canonique** (`useCanonicalQr === true`) :
- `tableSessionOrdersQuery` est `null`
- `tableSessionOrdersData` est `undefined`
- `tableSessionOrders = mergeOrdersById(tableSessionOrdersData, order)` → ne contient QUE la commande courante
- `sessionTotal = tableSessionOrders.reduce(...)` → total de la SEULE commande courante
- Le `sessionAggregates` récupéré via `getCanonicalTableSession` contient bien le bon total cumulé (`totalDue`)
- **Mais l'affichage utilise `sessionTotal` et non `sessionAggregates.totalDue`**

**En mode legacy** (non-canonique) :
- `tableSessionOrdersQuery` est actif
- `onSnapshot` écoute toutes les commandes de la session
- `sessionTotal` reflète bien la somme de toutes les commandes
- Le problème ne se produit PAS en mode legacy

### Cause racine

La variable `sessionTotal` (ligne ~280-290) est calculée à partir de `tableSessionOrders` qui, en mode canonique, ne contient que la commande courante. La valeur `sessionAggregates.totalDue` (calculée côté serveur à partir de toutes les commandes de la session) n'est pas utilisée dans l'affichage du "Total à payer".

---

## 3. Comportement réel de « Commander encore »

### Logique

Dans `CheckoutQRModal.tsx` (handleSubmit) :
1. Appelle `createCanonicalTableSession({ app, user, restaurantId, tableId })`
   - Cette API réutilise la session active existante si elle est dans le timeout (30 min)
   - Retourne le même `tableSessionId`
2. Appelle `createCanonicalQrOrder` avec `tableContext.tableSessionId`
3. Redirige vers `/order/{restaurantId}/{orderId}?tableSessionId={tableSessionId}`

Dans la page de suivi, le bouton « Commander encore » :
4. `buildContinueOrderingPath(slug, safeOrder)` construit l'URL :
   ```
   /{slug}?t={tableId}&sessionId={tableSessionId}&mode=dine_in&orderId={orderId}
   ```
5. Redirige vers le menu public avec ces paramètres
6. `PublicPage` reçoit `tableId`, `sessionId`, `mode` en props
7. Le panier est réinitialisé, l'utilisateur recommande

**Problème potentiel** : Le `CartContext` est vidé avant de rediriger vers le menu. Les articles précédents ne sont pas conservés. C'est normal (nouvelle commande), mais l'expérience est une commande indépendante, pas un "ajout au panier existant".

### Ce qui fonctionne correctement
- La session de table est réutilisée (même `tableSessionId`)
- La nouvelle commande porte le même `tableSessionId`
- Les deux commandes sont liées à la même session

### Ce qui est cassé
- L'affichage du total (voir section 2)

---

## 4. Fonctionnement multi-appareils

### Mode legacy (non-canonique)
- `tableSessionOrdersQuery` est un `onSnapshot` Firestore sur toutes les commandes avec `tableSessionId == X`
- Chaque appareil reçoit les mises à jour en temps réel via Firestore
- `localTableUserId` (localStorage) distingue "Toi" des autres convives
- Des notifications toast apparaissent quand quelqu'un d'autre ajoute une commande
- La synchronisation est **temps réel** via les listeners Firestore

### Mode canonique
- `tableSessionOrdersQuery` est `null` volontairement
- Les agrégats sont récupérés par polling (`getCanonicalTableSession`, intervalle 5s)
- Pas de listener temps réel pour les nouvelles commandes des autres
- Les notifications toast sont désactivées (pas de `onSnapshot`)
- La synchronisation est **quasi temps réel** (polling 5s)

### Le total est-il partagé entre appareils ?

**En mode legacy** : Oui, car tous les appareils écoutent le même `onSnapshot` sur la collection orders filtrée par `tableSessionId`.

**En mode canonique** : Oui potentiellement, car `getCanonicalTableSession` renvoie les agrégats serveur. Mais l'affichage utilise `sessionTotal` (local), pas `sessionAggregates.totalDue` (serveur).

---

## 5. Risques de double paiement

### Analyse du flux de paiement

1. **Client** → `POST /table-sessions/{id}/payment-requests`
   - Vérifie que `paymentRequest.status` n'est pas `validated` ou `pending_confirmation`
   - Utilise l'idempotence (`proofRef`) avec hash de `{tableSessionId}:{idempotencyKey}`
   - Si la clé existe déjà → `replayed: true`, pas de double traitement
   - **Verrou transactionnel** : la lecture et l'écriture sont dans `runTransaction`

2. **Deux clients simultanés** :
   - Le premier client A : la transaction lit `paymentRequest.status` = "none", écrit "requested"
   - Le second client B : la transaction lit `paymentRequest.status` = "requested" (après A)
   - **Firestore transactions sont optimistes** : si B lit après A, la transaction de B échoue et retente
   - Au retentative, B voit `paymentRequest.status` !== "none" → `PAYMENT_ALREADY_CONFIRMED` (409)

3. **Staff** → `POST /table-sessions/{id}/confirm-payment`
   - Itère toutes les commandes de la session
   - Pour chaque commande : `confirmOrderPayment` avec idempotence (scopedKey)
   - Si commande déjà `paymentStatus === "paid"`, elle est sautée
   - **Verrou transactionnel** via `FirestoreAtomicOrderCommandStore`

### Risque résiduel

- **Concurrence entre deux clients** : Bien gérée par la transaction Firestore + idempotence
- **Concurrence entre client et staff** : Si le staff valide pendant qu'un client initie un paiement, la transaction du staff peut échouer et retenter. Risque faible.
- **Double paiement mobile** : Le client peut payer via mobile money ET demander un paiement espèces. La transaction empêche le double statut, mais le paiement mobile réel (hors système) peut être effectué. C'est un risque opérationnel, pas technique.

---

## 6. Source officielle recommandée pour l'addition

**La source officielle est l'API `GET /api/restaurants/{id}/table-sessions/{sessionId}`.**

Cette API :
1. Lit tous les documents `orders` de la session (via `tableSessionId` ET `sessionId` pour couvrir legacy)
2. Calcule les agrégats :
   ```
   totalDue = max(0, totalOrdered - totalCancelled - totalDiscount - totalRefunded - totalPaid)
   ```
3. Retourne `session.totalDue` et `counts.totalDue`

**Le montant à payer doit être** :
- `totalDue` = maximum entre 0 et (totalOrdered - totalCancelled - totalDiscount - totalRefunded - totalPaid)

---

## 7. Correction minimale recommandée

### Problème
Dans `src/app/order/[restaurantId]/[orderId]/page.tsx`, le "Total à payer" affiche `sessionTotal` (calcul local sur `tableSessionOrders`) au lieu de `sessionAggregates.totalDue` (calcul serveur sur toutes les commandes de la session).

### Correction

**Étape 1** : Remplacer l'affichage du total par la valeur serveur quand elle est disponible.

Dans la section d'affichage du "Total à payer", remplacer :

```tsx
<PublicPrice role="total" value={formatMoney(sessionTotal)} suffix="FCFA" />
```

par :

```tsx
<PublicPrice role="total" value={formatMoney(sessionAggregates?.totalDue ?? sessionTotal)} suffix="FCFA" />
```

**Étape 2** : S'assurer que `sessionAggregates` est utilisé comme source de vérité pour `sessionPaymentConfirmed`.

Remplacer :

```tsx
const sessionPaymentConfirmed =
  tableSession?.paymentRequest?.status === "validated" ||
  tableSession?.status === "closed" ||
  (tableSessionOrders.length > 0 && tableSessionOrders.every(...)) ||
  isPaidPaymentStatus(safeOrder.paymentStatus)
```

par une logique qui utilise aussi `sessionAggregates` (quand disponible en mode canonique).

**Étape 3** : Activer le polling des agrégats même sans `order` (pour le cas multi-appareil où l'order peut ne pas être chargé).

### Prérequis
- `getCanonicalTableSession` doit être exporté depuis `public-api-client.ts` (vérifier)
- Idéalement, utiliser `sessionAggregates` comme source unique de vérité pour le total

---

## 8. Tests à prévoir

### Tests unitaires
1. **Création de session de table** : Vérifier que `POST /table-sessions` retourne le même `tableSessionId` pour une table déjà occupée
2. **Agrégats de session** : Vérifier que `GET /table-sessions/{id}` retourne `totalDue` = somme des commandes moins paiements
3. **Idempotence paiement** : Vérifier que deux appels identiques à `payment-requests` retournent `replayed: true`
4. **Blocage double paiement** : Vérifier le code 409 si `paymentRequest.status` est déjà `validated`

### Tests d'intégration
5. **Commande + "Commander encore"** : Simuler scan QR → commande 12 000 FCFA → commander encore → commande 3 000 FCFA → vérifier total = 15 000 FCFA
6. **Multi-appareils legacy** : Simuler deux clients sur la même table → vérifier que chaque appareil voit le total cumulé
7. **Multi-appareils canonique** : Même test en mode canonique → vérifier le polling met à jour le total
8. **Paiement concurrent** : Simuler deux clients payant simultanément → vérifier qu'un seul paiement est accepté
9. **Validation staff** : Simuler un paiement client → validation staff → vérifier que la table passe à `free`

### Tests de régression
10. **Commande takeaway/delivery** : Vérifier que le flux de paiement unitaire n'est pas cassé
11. **POS** : Vérifier que les commandes POS sans `tableSessionId` ne sont pas impactées
12. **Session expirée** : Vérifier qu'une session de 30+ min est correctement fermée

---

## Synthèse des risques

| Risque | Gravité | Probabilité | Mitigation |
|--------|---------|-------------|------------|
| Total affiché = dernière commande seulement | **Haute** | Certaine en mode canonique | Utiliser `sessionAggregates.totalDue` |
| Double paiement simultané | **Haute** | Faible | Transaction Firestore + idempotence |
| Paiement client + staff simultané | **Moyenne** | Très faible | Transaction optimiste + retry |
| Nouvelle commande non visible en temps réel | **Basse** | Moyenne | Polling 5s (canonique) |
| « Commander encore » sans session | **Haute** | Faible | Vérification `tableSessionId` existant |
| Perte de contexte après rechargement | **Basse** | Faible | localStorage + paramètres URL |
