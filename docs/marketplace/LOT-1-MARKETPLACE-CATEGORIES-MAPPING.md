# OORDERA Marketplace - Lot 1 Categories Globales Et Mapping

Date: 2026-07-23

Status: GO - categories globales administrables et mapping local branche. Not deployed.

## Objectif

Lot 1 relie les categories locales des restaurants a la taxonomie globale du marketplace.

La bibliotheque de menus plateforme ne devient pas une source directe du marketplace. Elle peut seulement transporter un mapping lorsqu'un modele est importe dans un restaurant.

## Modele Final

### Taxonomie globale

Collection:

```txt
marketplaceFoodCategories/{categoryId}
```

Champs stabilises:

- `schemaVersion: 1`
- `name`
- `slug`
- `normalizedName`
- `imageUrl`
- `sortOrder`
- `active`
- `aliases`
- `createdAt`
- `updatedAt`

Lecture publique:

- seulement si `active == true` et `schemaVersion == 1`.

Administration:

- lecture complete, creation, modification et suppression reservees au Super Admin.

### Categories locales restaurant

Collection:

```txt
restaurants/{restaurantId}/categories/{localCategoryId}
```

Champ ajoute:

```ts
marketplaceCategoryId?: string | null
```

Ce champ ne remplace jamais `categoryId`.

### Templates bibliotheque

Les categories modeles peuvent conserver:

```ts
marketplaceCategoryId?: string | null
```

Lors d'un import, le champ est copie dans la categorie locale creee.

Si un produit modele porte aussi un mapping, il est conserve sur le produit importe. Sinon le produit herite du mapping de sa categorie locale pendant la projection.

## Parcours Admin

### Super Admin

Nouvelle page:

```txt
/platform/settings/marketplace-categories
```

Fonctions:

- creer une categorie globale;
- modifier nom, slug, image, ordre et statut;
- activer/desactiver;
- rechercher dans la taxonomie.

### Bibliotheque menus

Dans les categories modeles:

- selection optionnelle d'une categorie marketplace;
- affichage du mapping dans les cartes categories.

### Gestion menu restaurant

Dans le modal de categorie:

- selection optionnelle d'une categorie marketplace active;
- sans mapping, la categorie reste visible dans le menu restaurant;
- sans mapping, les produits de cette categorie sont exclus de la decouverte marketplace.

## Projection `marketplaceDishOffers`

La projection lit toujours:

```ts
product.marketplaceCategoryId || category.marketplaceCategoryId
```

Nouvelle regle:

- si aucun mapping global n'est trouve, l'offre est ecrite avec `discoverable: false`;
- le produit reste intact dans le menu restaurant;
- aucune donnee Firestore restaurant n'est migree ou supprimee.

## Fichiers Concernés

- `src/app/platform/settings/marketplace-categories`
- `src/components/layout/app-sidebar.tsx`
- `src/app/platform/menu-library/components/PlatformMenuLibraryClient.tsx`
- `src/modules/menu-library/MenuLibraryImportDialog.tsx`
- `src/modules/menu-library/types.ts`
- `src/app/(dashboard)/manager/components/ManagerClient.tsx`
- `src/modules/restaurant/types.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
- `firestore.rules`
- `tests/marketplace-discovery`

## Tests Couverts

- projection avec mapping herite de la categorie locale;
- exclusion d'une offre sans mapping global;
- absence de champ prive dans les projections;
- regles Firestore marketplace;
- triggers Lot 0 sans boucle.

## Limites Restantes

- pas de creation de `marketplaceRestaurantCategoryOffers` dans ce lot;
- pas de refonte UX publique marketplace;
- pas de seed automatique de categories globales;
- pas de verification runtime Firebase Functions;
- pas de deploy.

## GO/NO-GO Pour Lot 2

GO pour le Lot 2 cote codebase.

Lot 2 peut construire `marketplaceRestaurantCategoryOffers` a partir des offres `marketplaceDishOffers` discoverables, car chaque offre discoverable possede maintenant un `marketplaceCategoryId`.
