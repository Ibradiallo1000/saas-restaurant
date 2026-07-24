# OORDERA Marketplace - Lot 0 Projection Sync

Date: 2026-07-23

Status: GO - shared projection contract stabilized and Firestore triggers wired. Not deployed.

## Scope

Lot 0 stabilizes the synchronization contract for `marketplaceDishOffers`.

No marketplace UI was changed. No customer localization was implemented. No restaurant menu, cart, order, payment, checkout or tracking workflow was changed.

## Target Source Collections

Source data remains:

```txt
restaurants/{restaurantId}
restaurants/{restaurantId}/categories/{categoryId}
restaurants/{restaurantId}/products/{productId}
```

Public read model remains:

```txt
marketplaceDishOffers/{restaurantId}__{productId}
```

Global category taxonomy remains:

```txt
marketplaceFoodCategories/{categoryId}
```

## Existing Functions Reused

Existing functions kept:

- `projectMarketplaceDishOffer`
- `syncMarketplaceDishOffer`
- `deleteMarketplaceDishOffer`
- `disableMarketplaceRestaurantOffers`

New shared backend helpers added:

- `evaluateMarketplaceDishPublishability`
- `syncMarketplaceProductById`
- `syncMarketplaceCategoryProducts`
- `syncMarketplaceRestaurantProducts`
- `deleteMarketplaceRestaurantOffers`

Firebase Functions entrypoints added:

- `syncMarketplaceDishOfferOnProductWrite`
- `syncMarketplaceDishOffersOnCategoryWrite`
- `syncMarketplaceDishOffersOnRestaurantWrite`

## Single Source Of Truth

A product offer is marketplace-discoverable only when all conditions below are true:

- restaurant exists;
- restaurant `status === "active"`;
- restaurant `isActive !== false`;
- restaurant has no `deletedAt`;
- restaurant has a public `name`;
- restaurant has a public `slug`;
- product exists;
- product `isActive === true`;
- product `available !== false`;
- product has no `deletedAt`;
- product has a public `name`;
- local category, when present, is not disabled and not deleted.

This rule is implemented in:

```txt
src/lib/marketplace-discovery/marketplace-discovery-core.ts
```

The stricter `product.isActive === true` criterion intentionally aligns marketplace discovery with the public menu query, which currently loads products with `where("isActive", "==", true)`.

## Event Behavior

### Product Created Or Updated

Use:

```ts
syncMarketplaceProductById({ db, restaurantId, productId })
```

Behavior:

- creates or updates `marketplaceDishOffers/{restaurantId}__{productId}` if publishable;
- writes the offer as `discoverable: false` if the source exists but is not publishable;
- deletes the offer if the product source no longer exists.

### Product Disabled

The same product sync writes a non-discoverable projection.

### Product Deleted

The same product sync deletes the projection.

### Category Updated

Use:

```ts
syncMarketplaceCategoryProducts({ db, restaurantId, categoryId })
```

Behavior:

- reprojections all products in the local category, with pagination;
- products become non-discoverable if the category is inactive/deleted.

### Restaurant Updated

Use:

```ts
syncMarketplaceRestaurantProducts({ db, restaurantId })
```

Behavior:

- if restaurant is active, reprojections all products;
- if restaurant is inactive/suspended/deleted, disables or deletes its offers according to source existence.

### Restaurant Deleted

Use:

```ts
deleteMarketplaceRestaurantOffers(db, restaurantId)
```

Behavior:

- deletes all dish offers for the restaurant.

## Backfill And Rebuild

Updated scripts:

- `scripts/marketplace-discovery-backfill.mjs`
- `scripts/marketplace-discovery-rebuild.mjs`

Backfill now uses `syncMarketplaceProductById` for writes, so it shares the same publication rule as the runtime sync service.

Rebuild now:

- examines existing marketplace offers;
- deletes obsolete offers whose source product no longer exists;
- resynchronizes existing source products when `--write` is used;
- keeps environment guardrails.

Write guardrails remain:

- no write outside emulator, QA or staging-like environments unless the script guards are deliberately satisfied;
- global writes require explicit `--allow-global`;
- writes require explicit `--limit`.

## Public Data Projected

Allowed public fields are controlled by `MARKETPLACE_DISCOVERY_PUBLIC_FIELDS`.

Forbidden fields are controlled by `MARKETPLACE_DISCOVERY_FORBIDDEN_FIELDS`.

Never projected:

- owner email;
- owner id;
- phone;
- payment configuration;
- cloudinary secrets;
- staff data;
- permissions;
- logs;
- cost price;
- stock;
- recipe;
- supplier fields.

## Automatic Synchronization Status

The repository now contains the minimal Firebase Cloud Functions runtime:

- `functions/package.json`;
- `functions/tsconfig.json`;
- `functions/src/index.ts`;
- `firebase-functions` and `firebase-admin` dependencies.

No deployment was executed.

The Firestore triggers listen only to source collections:

```txt
restaurants/{restaurantId}
restaurants/{restaurantId}/categories/{categoryId}
restaurants/{restaurantId}/products/{productId}
```

They do not listen to `marketplaceDishOffers`, so projection writes cannot retrigger the same sync path.

Trigger behavior:

- product write: sync or delete the single offer through `syncMarketplaceProductById` / `deleteMarketplaceDishOffer`;
- category write: resync all products in the local category through `syncMarketplaceCategoryProducts`;
- restaurant write: resync, disable or delete restaurant offers through `syncMarketplaceRestaurantProducts` / `deleteMarketplaceRestaurantOffers`.

The triggers reuse the central services and do not duplicate the projection mapper.

## Tests

Executed:

```bash
npm run test:marketplace-discovery
npm run functions:typecheck
npm run functions:build
npx tsc --noEmit
npm run build
git diff --check
```

Covered:

- projection whitelist;
- private field exclusion;
- product active/inactive criteria;
- restaurant active/inactive criteria;
- category inactive criteria;
- missing public data;
- marketplace rules static assertions.
- trigger source paths;
- absence of trigger loop on `marketplaceDishOffers`;
- trigger reuse of central sync services.

## Remaining Limits

- Cloud Functions were added but not deployed.
- Runtime production synchronization starts only after an explicit Firebase deploy by the operator.
- No destructive remote rebuild was executed.
- `marketplaceRestaurantCards` and `marketplaceRestaurantCategoryOffers` are not implemented in Lot 0.
- Category global mapping UI is not implemented in Lot 0.
- Emulator runtime validation was not executed in this lot.

## GO/NO-GO For Lot 1

GO for Lot 1 from a codebase readiness perspective.

Operational prerequisite before production use: deploy the Functions in the intended Firebase environment and monitor the first sync events.
