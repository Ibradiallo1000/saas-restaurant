# OORDERA Marketplace - Lot 2 Restaurant Category Offers

Date: 2026-07-23

Status: GO - projection `marketplaceRestaurantCategoryOffers` ajoutee. Not deployed.

## Objectif

Lot 2 cree une projection publique unique par restaurant et categorie marketplace globale.

Cette projection est derivee uniquement des offres produits deja publiees dans:

```txt
marketplaceDishOffers
```

Elle ne lit pas directement la bibliotheque de menus et ne modifie pas l'interface publique marketplace.

## Collection

```txt
marketplaceRestaurantCategoryOffers/{restaurantId}__{marketplaceCategoryId}
```

## Modele Final

```ts
type MarketplaceRestaurantCategoryOffer = {
  schemaVersion: 1
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  marketplaceCategoryId: string
  localCategoryId: string | null
  productCount: number
  minimumPrice: number | null
  representativeImageUrl: string | null
  cityName: string | null
  communeName: string | null
  districtName: string | null
  discoverable: boolean
  sourceUpdatedAt: string | null
  updatedAt: string
}
```

## Regles De Calcul

- une projection = `restaurantId + marketplaceCategoryId`;
- seules les offres `marketplaceDishOffers.discoverable == true` sont agregees;
- `productCount` compte les produits uniques;
- `minimumPrice` prend le plus petit `displayPrice` numerique;
- `representativeImageUrl` prend une image produit representative, priorite au prix le plus bas;
- `localCategoryId` choisit la categorie locale contenant le plus de produits du groupe;
- si aucun produit decouvrable ne reste, la projection est supprimee.

## Logo Restaurant

La projection utilise le vrai logo restaurant depuis les formats connus:

- `restaurant.logoUrl`;
- `restaurant.logoImageUrl`;
- `restaurant.logo.url`;
- `restaurant.logo` si c'est deja une URL.

Le champ `coverImage` n'est pas utilise comme logo.

## Synchronisation Automatique

Les triggers existants appellent maintenant:

```ts
syncMarketplaceRestaurantCategoryOffers({ db, restaurantId })
```

apres:

- modification produit;
- suppression produit;
- modification categorie locale;
- modification restaurant.

Suppression restaurant:

```ts
deleteMarketplaceRestaurantCategoryOffers(db, restaurantId)
```

Aucun trigger n'ecoute `marketplaceRestaurantCategoryOffers`, donc il n'y a pas de boucle.

## Backfill Idempotent

Script ajoute:

```bash
npm run marketplace:category-offers:backfill -- --restaurant-id <id> --limit 1 --write
```

ou, en environnement autorise:

```bash
npm run marketplace:category-offers:backfill -- --allow-global --limit 100 --write
```

Garde-fous:

- lecture refusee hors emulateur, QA ou staging;
- ecriture globale exige `--allow-global`;
- ecriture exige `--limit`;
- aucun deploy.

## Regles Firestore

Lecture publique:

```txt
discoverable == true && schemaVersion == 1
```

Ecriture client:

```txt
false
```

Les ecritures runtime sont effectuees par Admin SDK.

## Indexes

Indexes ajoutes:

- `marketplaceRestaurantCategoryOffers`: `discoverable + marketplaceCategoryId + productCount desc + __name__ desc`;
- `marketplaceRestaurantCategoryOffers`: `restaurantId + marketplaceCategoryId`;
- `marketplaceDishOffers`: `restaurantId + discoverable + __name__`.

## Tests Couverts

- construction d'identifiant stable;
- logo restaurant reel;
- agregation restaurant-categorie;
- exclusion des champs prives;
- regles Firestore;
- absence de trigger sur la projection agregee.

## Limites Restantes

- pas de page categorie marketplace publique dans ce lot;
- pas de `marketplaceRestaurantCards`;
- pas de popularite reelle;
- pas de deploy Functions;
- pas de validation runtime emulator.

## GO/NO-GO Pour Lot 3

GO cote codebase.

Lot 3 peut creer `marketplaceRestaurantCards`, car les categories restaurant visibles par le marketplace sont maintenant agregees et detachees de la lecture directe des menus restaurant.
