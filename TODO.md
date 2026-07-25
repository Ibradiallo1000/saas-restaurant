# Marketplace Sync — Client Side Implementation — ✅ COMPLETE
# Firestore Rules — Marketplace Projection Write Access — ✅ COMPLETE

## Files Created
1. [x] `src/lib/marketplace-discovery/marketplace-discovery-sync-client.ts` — Client-side sync service (Firebase client SDK)

## Files Modified
2. [x] `src/app/(dashboard)/manager/components/ManagerClient.tsx` — Call sync after save
3. [x] `firestore.rules` — Add create/update/delete rules for `marketplaceDishOffers` and `marketplaceRestaurantCategoryOffers`
4. [x] `tests/marketplace-discovery/firestore-rules.test.mjs` — Update assertions for new write rules

## Firestore Rules Changes
- `marketplaceDishOffers`:
  - `allow read: if resource.data.discoverable == true && schemaVersion == 1` (unchanged)
  - `allow create: if canManageRestaurantMenu(request.resource.data.restaurantId)` + field validation (restaurantId, productId, marketplaceCategoryId, discoverable, schemaVersion)
  - `allow update: if canManageRestaurantMenu(resource.data.restaurantId)` + restaurantId immutability + field validation
  - `allow delete: if canManageRestaurantMenu(resource.data.restaurantId)`
- `marketplaceRestaurantCategoryOffers`:
  - `allow read: if resource.data.discoverable == true && schemaVersion == 1` (unchanged)
  - `allow create: if canManageRestaurantMenu(request.resource.data.restaurantId)` + field validation (restaurantId, marketplaceCategoryId, discoverable, schemaVersion)
  - `allow update: if canManageRestaurantMenu(resource.data.restaurantId)` + restaurantId immutability + field validation
  - `allow delete: if canManageRestaurantMenu(resource.data.restaurantId)`
- `marketplaceFoodCategories` — unchanged (super-admin only)
- Catch-all `{document=**}` — unchanged (deny all)

## Steps
- [x] Audit complete: `marketplace-discovery-sync.ts` uses `firebase-admin` → incompatible with Spark
- [x] Create `marketplace-discovery-sync-client.ts` with:
  - `syncDishOffer(db, restaurantId, productId)` — project and write to `marketplaceDishOffers`
  - `syncCategoryOffers(db, restaurantId, categoryId)` — re-sync all products in a category
  - `rebuildRestaurantCategoryOffers(db, restaurantId)` — rebuild `marketplaceRestaurantCategoryOffers`
  - Reuse `projectMarketplaceDishOffer` and `projectMarketplaceRestaurantCategoryOffer` from core
- [x] In `ManagerClient.tsx`:
  - After `handleSaveProduct` → call `syncDishOffer()` then `rebuildRestaurantCategoryOffers()`
  - After `handleSaveCategory` → call `syncCategoryOffers()` then `rebuildRestaurantCategoryOffers()`
- [x] After `handleToggleProduct` → also calls marketplace sync
- [x] **Firestore Rules**: Replace `allow write: if false` with manager-restricted create/update/delete
  - update validates required fields + restaurantId immutability
  - delete restricted to manager of the restaurant
- [x] Update tests in `tests/marketplace-discovery/firestore-rules.test.mjs`
- [x] Run `npx mocha tests/marketplace-discovery/firestore-rules.test.mjs` — **11/11 passing**
- [x] Run `npx tsc --noEmit` — no errors
- [x] Verify no POS/marketplace files were touched

