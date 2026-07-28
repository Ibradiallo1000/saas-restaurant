# Mission BLACKBOX — Audit Inventory Instrumentation

## ✅ ÉTAPE 1 — Instrumentation terminée

### Fichiers modifiés (instrumentation temporaire ajoutée)

| Fichier | Tag de log | Objectif |
|---------|-----------|----------|
| `src/modules/stock/shared/use-inventory-referential.ts` | `[InventoryAudit]` | Tracer les documents Coca Cola bruts depuis Firestore |
| `src/modules/stock/shared/inventory-referential.ts` | `[InventoryAudit]` | Normalisation, filtres actif/mode pour Coca Cola |
| `src/app/(dashboard)/manager/components/ManagerClient.tsx` | `[ProductInventoryAudit]` | Parcours Produit > Gestion du stock > Déduction automatique |
| `src/services/supply-expense.service.ts` | `[SupplyAudit]` | Parcours Manager > Dépenses > Nouvelle dépense > Approvisionnement |

## 🎯 Trois parcours tracés

### 1. Inventaire (visible)
- **Hook**: `useInventoryReferential(restaurantId)`
- **Collection**: `restaurants/{restaurantId}/stockItemsV2`
- **Instrumentation**: `[InventoryAudit]` — normalisation, filtre actif, filtre mode

### 2. Produit > Déduction automatique (INVISIBLE)
- **Composant**: `ManagerClient.tsx` > produit modal > section "Gestion du stock"
- **Hook**: `useInventoryReferential(restaurantId)` via `inventoryRef`
- **Données filtrées**: `eligibleAutomaticArticles` = `automaticInventoryArticles(articles)`
- **Instrumentation**: `[ProductInventoryAudit]` — affiche restaurantId, feature flags, counts, chaque document avec son exclusionReason

### 3. Approvisionnement (INVISIBLE)
- **Service**: `SupplyExpenseService.createExpense()`
- **Collection**: `restaurants/{restaurantId}/stockItemsV2`
- **Instrumentation**: `[SupplyAudit]` — affiche restaurantId, items, feature flags

## 🔍 Comment exécuter l'audit

1. **Lancer l'application**: `npm run dev`
2. **Ouvrir la console navigateur** (F12 > Console)
3. **Parcourir les trois écrans**:
   - Aller dans **Manager > Inventaire** → check `[InventoryAudit]` logs
   - Aller dans **Manager > Menu > Modifier un produit > Gestion du stock** → check `[ProductInventoryAudit]` logs
   - Aller dans **Manager > Dépenses > Nouvelle dépense > Approvisionnement** → check `[SupplyAudit]` logs
4. **Rechercher** `COCA COLA` dans les logs pour voir les raisons d'exclusion

## 📋 Rapport attendu

Après reproduction, répondre aux 12 questions de l'Étape 9.

