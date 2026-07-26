# Audit final — Lot 1 : Correction des deux points bloquants

## PARTIE A — AUDIT DU FLUX REVIEWACCESS

### Producteurs de reviewAccess

| Fichier | Fonction | Type de commande | Écriture atomique | Ordre réel |
|---------|----------|-----------------|-------------------|------------|
| `src/components/checkout/CheckoutQRModal.tsx` | `handleSubmit` (dans un `runTransaction`) | qr_table / dine_in | Oui — transaction | order + reviewAccess dans la même transaction |
| `src/components/checkout/CheckoutPublicModal.tsx` | `submitOrder` (dans un `writeBatch`) | client / takeaway/delivery/pickup | Oui — batch | order + reviewAccess dans le même batch |

### Analyse de la fonction `isValidReviewAccessCreate`

```javascript
function isValidReviewAccessCreate(restaurantId, orderId) {
  return orderId is string
    && request.resource.data.keys().hasOnly([...])
    && request.resource.data.restaurantId == restaurantId
    && request.resource.data.orderId == orderId
    && request.resource.data.reviewToken is string
    && request.resource.data.reviewToken.size() >= 36
    && request.resource.data.reviewToken.size() <= 128
    && request.resource.data.version == 1
    && request.resource.data.createdAt == request.time
    && request.resource.data.expiresAt == null
    && !exists(/databases/$(database)/documents/restaurants/$(restaurantId)/orders/$(orderId))
    && getAfter(/databases/$(database)/documents/restaurants/$(restaurantId)/orders/$(orderId)).data.restaurantId == restaurantId
    && isPublicReviewOrderSource(getAfter(...).data.source);
}
```

### Diagnostic — Situation réelle

**Conclusion :** Situation **B** — reviewAccess est créé dans le même batch/transaction que la commande.

| Vérification | État | Explication |
|-------------|------|-------------|
| `!exists(order)` | `true` | L'ordre n'existe pas AVANT l'écriture (écriture atomique) |
| `getAfter(order).data.restaurantId` | `== restaurantId` | Après l'écriture atomique, l'ordre possède le bon restaurantId |
| `getAfter(order).data.source` | `in ["client","qr","qr_table","manual"]` | La source est publique |

**La règle actuelle est CORRECTE.** Il n'y a pas d'inversion logique.

### Scénarios effectifs

| Scénario | Ordre | reviewAccess | Résultat attendu |
|----------|-------|-------------|------------------|
| QR dine_in public | Créé dans transaction | Créé dans transaction | ✅ `!exists` + `getAfter` valide |
| Takeaway public | Créé dans batch | Créé dans batch | ✅ `!exists` + `getAfter` valide |
| Pickup public | Créé dans batch | Créé dans batch | ✅ `!exists` + `getAfter` valide |
| Delivery public | Créé dans batch | Créé dans batch | ✅ `!exists` + `getAfter` valide |
| POS | Créé sans reviewAccess | N/A | ✅ Pas de reviewAccess créé |
| Manual | Peut être créé sans reviewAccess | N/A | ✅ Pas de reviewAccess créé |

### Pourquoi `getAfter()` est la bonne primitive

Puisque order + reviewAccess sont écrits dans la **même transaction/batch** :
- `exists()` retourne `false` (l'ordre n'existe pas encore)
- `getAfter()` lit l'état après la validation de l'écriture atomique
- `get()` échouerait car l'ordre n'existe pas au moment de l'évaluation

**La règle est correcte et ne nécessite aucune modification.**

## PARTIE B — CORRECTION DE REVIEWACCESS

**Aucune correction nécessaire.** La règle `isValidReviewAccessCreate` utilise correctement `!exists()` + `getAfter()` pour vérifier l'état atomique. Le flux producteur écrit order + reviewAccess dans la même transaction/batch, ce qui correspond exactement à ce que la règle vérifie.

## PARTIE C — VRAIS TESTS FIRESTORE EMULATOR

Le fichier `tests/reputation/restaurant-review-emulator.test.mjs` a été réécrit pour utiliser `@firebase/rules-unit-testing` avec de vrais appels à l'émulateur Firestore.

## PARTIE D — SCÉNARIOS OBLIGATOIRES

Tous les scénarios sont couverts dans le fichier de test réécrit.

## PARTIE E — VALIDATION TECHNIQUE

Commandes exécutées :
- `npx firebase emulators:exec --only firestore "node --test tests/reputation/restaurant-review-emulator.test.mjs"`

## PARTIE F — PÉRIMÈTRE

Fichiers modifiés :
- `tests/reputation/restaurant-review-emulator.test.mjs` — réécriture complète
- `firestore.rules` — aucune modification (règle correcte)

---

## VERDICT FINAL

**LOT 1 VALIDÉ**

- La condition `!exists(order)` + `getAfter(order)` dans `isValidReviewAccessCreate` est **correcte** pour le flux atomique existant
- Les tests Emulator utilisent désormais `@firebase/rules-unit-testing` avec de vraies écritures Firestore
- Tous les scénarios obligatoires passent
