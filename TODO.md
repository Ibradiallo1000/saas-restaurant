# TODO — Correction addition de table

## Plan

### Step 1: Modifier `page.tsx` — Utiliser `getCanonicalTableSession()` comme source unique
- [x] Ajouter `sessionOrders` dans l'état pour stocker les commandes du polling
- [x] Mettre à jour le polling pour stocker les commandes
- [x] Remplacer `sessionTotal` par `sessionAggregates.totalDue` en mode canonique
- [x] Construire `tableSessionOrders` depuis les commandes canoniques
- [x] Adapter `visibleTableSessionOrders` pour le mode canonique

### Step 2: Supprimer l'expiration de session (30 min)
- [x] Route POST `table-sessions/route.ts` : supprimer `SESSION_TIMEOUT_MS` et `isSessionExpired()`
- [x] Service `table-session.service.ts` : supprimer `SESSION_TIMEOUT_MS` et `isSessionExpired()`

### Step 3: Build & Tests
- [ ] `npx tsc --noEmit`
- [ ] Tests ciblés
- [ ] Build
