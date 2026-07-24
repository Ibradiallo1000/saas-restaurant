# OORDERA - Audit d'architecture Marketplace

Date : 2026-07-23

Statut : AUDIT UNIQUEMENT - Aucune implementation applicative realisee.

## 1. Perimetre audite

Cette analyse couvre le marketplace public actuel, le menu public restaurant, les projections Firestore de decouverte de plats, les composants UI associes, les services/types TypeScript et les regles/index Firestore concernes.

Fichiers principaux audites :

- `src/app/page.tsx`
- `src/app/marketplace-client.tsx`
- `src/app/marketplace-dish-client.tsx`
- `src/app/marketplace-dish-view-model.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-types.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-repository.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-sync.ts`
- `src/lib/marketplace-discovery/marketplace-discovery-config.ts`
- `src/lib/marketplace-offer-navigation.ts`
- `src/components/marketplace-ui/*`
- `src/components/public-ui/public-restaurant-card.tsx`
- `src/modules/public/PublicPage.tsx`
- `src/modules/public/components/CategoriesBar.tsx`
- `src/modules/public/components/DishCard.tsx`
- `src/modules/catalog/CatalogProvider.tsx`
- `src/modules/restaurant/types.ts`
- `src/services/restaurant.service.ts`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/marketplace-discovery-backfill.mjs`
- `scripts/marketplace-discovery-rebuild.mjs`

## 2. Architecture actuelle

### 2.1 Route marketplace racine

La route publique `/` est le point d'entree marketplace actuel.

Preuve : `src/app/page.tsx`

- `MarketplacePage` lit `searchParams`.
- Si `MARKETPLACE_DISH_DISCOVERY_ENABLED === "true"` et que `view !== "restaurants"`, la route rend le marketplace oriente plats via `renderDishMarketplace`.
- Sinon, elle rend le marketplace historique restaurants via `renderRestaurantMarketplace`.

Il existe donc deux experiences sur la meme route :

- `/` : marketplace plats si le feature flag est actif.
- `/?view=restaurants` : marketplace restaurants historique.

### 2.2 Marketplace restaurants historique

Preuve : `src/app/page.tsx` et `src/app/marketplace-client.tsx`

La liste des restaurants est chargee cote serveur via :

```ts
adminDb.collection("restaurants").where("status", "==", "active").get()
```

Puis chaque document est normalise par `toPublicRestaurant`.

Conditions supplementaires :

- `name` obligatoire.
- `slug` obligatoire et valide.
- `deletedAt` absent.
- `isActive !== false`.

Champs publics utilises :

- `name`
- `slug`
- `logoUrl` ou `logo`
- `coverImage`, `coverImageUrl` ou `coverUrl`
- `shortDescription`, `description`, `tagline` ou `welcomeMessage`
- `address`, `city`, `country`
- `cuisineTypes` ou `cuisineType`
- `services`

Le filtrage UI est uniquement client :

- recherche par inclusion sur `name`, `description`, `location`, `cuisineTypes`;
- filtre par `services`.

### 2.3 Marketplace plats actuel

Preuve : `src/app/page.tsx`, `src/lib/marketplace-discovery/marketplace-discovery-repository.ts`

Le marketplace plats ne lit pas directement `restaurants/{restaurantId}/products`. Il lit une collection publique derivee :

```txt
marketplaceDishOffers
```

La page `/` appelle :

```ts
repository.listOffers({ pageSize: 24, normalizedPrefix: search || null, categoryId, cursor })
repository.listActiveCategories(20)
```

Le resultat est converti en view model par `buildMarketplaceDishHomeViewModel`, puis affiche par `MarketplaceDishClient`.

### 2.4 Composants UI marketplace

Preuve : `src/components/marketplace-ui/README.md`

Le dossier `src/components/marketplace-ui` est une couche presentationnelle. Il ne doit pas importer Firebase, Firestore, Auth, provider, service ou mutation.

Composants importants :

- `MarketplaceLayout`
- `MarketplaceContainer`
- `MarketplaceSearch`
- `MarketplaceCategoryRail`
- `MarketplaceOfferCard`
- `MarketplaceDishCard`
- `MarketplaceDishGroup`
- `MarketplaceOfferSelector`
- `MarketplaceFilterList`
- `MarketplaceFilterSheet`
- `MarketplaceSection`
- `MarketplaceFeedback`

Le readme precise que la couche UI ne trie pas, ne recherche pas, ne calcule pas et ne revalide pas les offres. Ces decisions doivent rester dans le controleur et le view model.

### 2.5 Routes publiques liees

Routes observees :

- `/` : marketplace actuel.
- `/?view=restaurants` : marketplace restaurants historique.
- `/{slug}` : page menu public restaurant.
- `/r/{slug}` : route legacy, redirige vers `/{slug}`.
- `/checkout` : checkout public legacy/base.
- `/r/{slug}/checkout` : checkout legacy.
- `/r/{slug}/order` : redirection legacy vers `/{slug}`.
- `/order/{restaurantId}/{orderId}` : suivi de commande public.

Preuves :

- `src/app/(public)/[slug]/page.tsx` transmet `slug`, table/session/mode/orderId et intention marketplace a `PublicPage`.
- `src/app/r/[slug]/page.tsx` redirige vers `/${slug}`.
- `src/app/r/[slug]/order/page.tsx` redirige vers `/${slug}`.
- `src/lib/marketplace-offer-navigation.ts` construit les liens marketplace vers `/{slug}?product={productId}&source=marketplace`.

## 3. Flux de donnees actuel

### 3.1 Flux restaurant vers marketplace restaurants

```txt
restaurants
  -> src/app/page.tsx renderRestaurantMarketplace()
  -> toPublicRestaurant()
  -> MarketplaceClient
  -> PublicRestaurantCard
  -> /{slug}
```

Ce flux est direct et non indexe dans une collection publique dediee.

### 3.2 Flux produit restaurant vers marketplace plats

```txt
restaurants/{restaurantId}
restaurants/{restaurantId}/products/{productId}
restaurants/{restaurantId}/categories/{categoryId}
  -> projectMarketplaceDishOffer()
  -> marketplaceDishOffers/{restaurantId}__{productId}
  -> MarketplaceDishRepository.listOffers()
  -> MarketplaceDishClient
  -> MarketplaceOfferCard
  -> /{restaurantSlug}?product={productId}&source=marketplace
  -> PublicPage
```

Preuves :

- `scripts/marketplace-discovery-backfill.mjs` parcourt `restaurants`, puis `products`, puis lit la categorie restaurant associee.
- `projectMarketplaceDishOffer` fabrique une projection publique.
- `syncMarketplaceDishOffer` ecrit dans `marketplaceDishOffers`.
- `buildMarketplaceOfferHref` envoie vers `/{slug}` avec `product` et `source=marketplace`.
- `PublicPage` resout ensuite le produit depuis `restaurants/{restaurantId}/products`.

### 3.3 Flux categories marketplace globales

```txt
marketplaceFoodCategories
  -> MarketplaceDishRepository.listActiveCategories()
  -> MarketplaceCategoryRail
  -> filtre category dans l'URL
  -> listOffers({ categoryId })
```

Preuve : `MarketplaceDishRepository.listActiveCategories()` lit :

```ts
db.collection("marketplaceFoodCategories")
  .where("active", "==", true)
  .orderBy("sortOrder", "asc")
```

Les offres sont filtrees par :

```ts
where("marketplaceCategoryId", "==", input.categoryId)
```

## 4. Collections Firestore actuelles

### 4.1 Collections publiques marketplace

`marketplaceDishOffers`

Document derive public d'un produit propose par un restaurant.

Champs declares dans `MarketplaceDishOfferDocument` :

- `schemaVersion`
- `restaurantId`
- `restaurantSlug`
- `productId`
- `categoryId`
- `marketplaceCategoryId`
- `sourceTemplateId`
- `name`
- `normalizedName`
- `searchTokens`
- `description`
- `imageUrl`
- `imageAlt`
- `currency`
- `displayPrice`
- `priceMode`
- `hasConfigurator`
- `restaurantName`
- `restaurantLogoUrl`
- `restaurantLocation`
- `restaurantServices`
- `restaurantCuisineTypes`
- `restaurantActive`
- `productActive`
- `discoverable`
- `orderCount`
- `createdAt`
- `sourceUpdatedAt`
- `projectedAt`
- `quality`

`marketplaceFoodCategories`

Categorie globale marketplace.

Champs declares dans `MarketplaceFoodCategoryDocument` :

- `schemaVersion`
- `name`
- `slug`
- `normalizedName`
- `icon`
- `imageUrl`
- `sortOrder`
- `active`
- `aliases`

### 4.2 Collections source restaurant

`restaurants`

Utilisee par :

- marketplace restaurants historique;
- projection marketplace plats;
- page menu publique.

Sous-collections :

- `restaurants/{restaurantId}/products`
- `restaurants/{restaurantId}/categories`
- `restaurants/{restaurantId}/orders`
- `restaurants/{restaurantId}/tables`

Pour le marketplace, les sous-collections critiques sont `products` et `categories`.

### 4.3 Collections legacy/compatibilite

`restaurantSlugs`

Encore utilisee dans `src/app/r/[slug]/checkout/page.tsx`, mais la page publique moderne `/{slug}` resout directement :

```ts
collection(db, "restaurants"), where("slug", "==", slug)
```

La future architecture marketplace doit eviter de dependre de deux methodes concurrentes de resolution de slug.

## 5. Types TypeScript associes

Types marketplace :

- `MarketplaceRestaurantSource`
- `MarketplaceCategorySource`
- `MarketplaceProductSource`
- `MarketplaceDishOfferDocument`
- `MarketplaceFoodCategoryDocument`
- `MarketplaceDiscoveryQuery`
- `MarketplaceDiscoveryPage`
- `MarketplaceDiscoveryCursor`

Types presentation UI :

- `MarketplaceRestaurantPresentation`
- `MarketplaceOfferPresentation`
- `MarketplaceDishPresentation`
- `MarketplaceCategoryPresentation`
- `MarketplaceFilterPresentation`
- `MarketplaceSearchPresentation`

Types restaurant/menu :

- `src/modules/restaurant/types.ts` declare `Product` avec `id`, `name`, `basePrice`, `imageUrl`, `categoryId`, `isActive`, `preparationMode`.
- `Category` contient `id`, `name`, `order`, `isActive`.
- `src/types/index.ts` contient aussi des types historiques `MenuItem`, `MenuCategory`, `RestaurantData`.

Constantes collections :

- `src/lib/constants.ts` declare notamment `RESTAURANTS`, `PRODUCTS`, `ORDERS`, `PLATFORM_MENU_PACKS`, `PLATFORM_MENU_CATEGORIES`, `PLATFORM_MENU_PRODUCTS`.

## 6. Logique actuelle de recherche

### 6.1 Recherche marketplace plats

Preuve : `MarketplaceDishRepository.listOffers`

La recherche actuelle est une recherche prefixe sur le nom normalise du plat :

```ts
where("normalizedName", ">=", prefix)
where("normalizedName", "<=", `${prefix}\uf8ff`)
orderBy("normalizedName", "asc")
```

La normalisation est definie dans `normalizeMarketplaceSearch` :

- suppression des accents;
- passage en minuscule locale fr;
- remplacement apostrophes/tirets par espace;
- suppression des caracteres non alphanumeriques;
- compactage des espaces.

Limite importante : `searchTokens` est projete mais n'est pas utilise par `listOffers`. La recherche ne couvre donc pas encore efficacement description, restaurant, cuisine, ville ou alias de categorie.

### 6.2 Recherche marketplace restaurants

Preuve : `src/app/marketplace-client.tsx`

La recherche est entierement client-side apres chargement de tous les restaurants actifs.

Elle compare une chaine composee de :

- nom;
- description;
- localisation;
- types de cuisine.

Limite : cette approche ne passera pas proprement a plusieurs centaines ou milliers de restaurants, car elle suppose que la page charge tout avant de filtrer.

### 6.3 Recherche menu public

Preuve : `src/modules/public/PublicPage.tsx`

La recherche du menu public filtre localement les produits deja charges depuis :

```txt
restaurants/{restaurantId}/products
```

Elle compare `product.name` et `product.description`, puis filtre les categories visibles.

## 7. Logique actuelle d'affichage

### 7.1 Restaurants

`MarketplaceClient` affiche des `PublicRestaurantCard`.

La carte utilise :

- image de couverture;
- logo;
- nom;
- description ou types de cuisine;
- localisation;
- services;
- lien vers `/{slug}`.

### 7.2 Plats marketplace

`MarketplaceDishClient` affiche une liste de `MarketplaceOfferCard`.

Chaque offre contient :

- image produit;
- nom produit;
- restaurant;
- logo restaurant;
- localisation restaurant;
- description produit;
- prix;
- libelle de disponibilite;
- lien vers le menu public.

Le prix est prepare dans le view model par `formatPrice` :

- `Prix sur demande` si aucun prix.
- `Dès X devise` si prix variable/configurable.
- `X devise` si prix exact.

### 7.3 Menu public restaurant

`PublicPage` charge :

- restaurant par `slug`;
- produits actifs : `where("isActive", "==", true)`;
- categories restaurant : `limit(50)`, puis filtre `isActive !== false`;
- produit cible marketplace via `doc(restaurants/{restaurantId}/products/{productId})` si le produit n'est pas dans les 50 premiers produits.

Les produits sont regroupes par `categoryId` et tries par `orderCount` decroissant dans chaque categorie.

## 8. Donnees publiques reellement disponibles

### 8.1 Restaurant

Disponibles/projetees :

- `id`
- `name`
- `slug`
- `status`
- `isActive`
- `deletedAt`
- `logoUrl` / `logo`
- `coverImage` / variantes historiques
- `address`
- `city`
- `country`
- `currency`
- `services`
- `cuisineTypes` / `cuisineType`
- `updatedAt`

Le service de creation restaurant accepte aussi :

- `countryCode`
- `countryName`
- `timezone`
- `phone`
- `location.address`
- `location.googleMapsUrl`
- `location.lat`
- `location.lng`

Mais le read model marketplace actuel ne projette pas `lat`, `lng`, `countryCode`, `timezone`, ni une structure `location` normalisee.

### 8.2 Produit

Disponibles/projetes :

- `id`
- `name`
- `description`
- `imageUrl`
- `imageAlt`
- `categoryId`
- `marketplaceCategoryId`
- `sourceTemplateId` / `templateId`
- `price`, `basePrice`, `unitPrice`
- `sizes`
- `variants`
- `options`
- `linkedOptionGroups`
- `isActive`
- `available`
- `orderCount`
- `createdAt`
- `updatedAt`

### 8.3 Categorie restaurant

Disponibles/projetees :

- `id`
- `name`
- `marketplaceCategoryId`
- `sourceTemplateId`
- `templateId`
- `isActive`
- `updatedAt`
- `imageUrl` cote menu public.

## 9. Comment un restaurant devient visible

Aujourd'hui, il y a deux criteres proches mais pas strictement identiques selon le flux.

Marketplace restaurants historique :

- requete `where("status", "==", "active")`;
- puis exclusion si `deletedAt`;
- exclusion si `isActive === false`;
- `name` et `slug` obligatoires.

Marketplace plats :

- `projectMarketplaceDishOffer` calcule `restaurantActive` avec :

```ts
restaurant.status === "active" && restaurant.isActive !== false && !restaurant.deletedAt
```

Une offre n'est `discoverable` que si le restaurant est actif, avec nom et slug valides.

Conclusion : un restaurant devient visible s'il est actif (`status: "active"`), non desactive (`isActive !== false`), non supprime (`deletedAt` absent), avec un nom et un slug valides.

## 10. Comment un produit devient public

Preuve : `projectMarketplaceDishOffer`

Un produit devient public dans le marketplace plats lorsque sa projection `marketplaceDishOffers/{restaurantId}__{productId}` a :

- `discoverable: true`;
- `schemaVersion: 1`;
- restaurant actif;
- produit actif;
- nom produit non vide;
- nom restaurant non vide;
- slug restaurant non vide.

Le produit est considere actif si :

```ts
product.isActive !== false && product.available !== false
```

Le menu public, lui, charge principalement :

```ts
where("isActive", "==", true)
```

et `resolveMarketplaceProduct` refuse ensuite `isActive === false` ou `available === false`.

Risque actuel : un produit sans `isActive: true` mais avec `isActive` absent peut etre projetable par `projectMarketplaceDishOffer` tout en n'apparaissant pas dans la requete principale du menu public. Le fallback `targetedProductRef` peut compenser pour le produit cible marketplace, mais cette asymetrie doit etre clarifiee avant une montee en charge.

## 11. Categories globales marketplace

Le systeme a deja le champ de liaison :

- produit : `marketplaceCategoryId`;
- categorie restaurant : `marketplaceCategoryId`;
- projection : `marketplaceCategoryId`.

La projection choisit :

```ts
product.marketplaceCategoryId || category?.marketplaceCategoryId
```

Donc la categorie globale peut etre definie soit au niveau produit, soit heritee de la categorie restaurant.

Point critique : les categories restaurant restent locales et doivent le rester. Elles servent au menu du restaurant, a son ordre d'affichage et a ses images internes.

Architecture recommandee :

- conserver `restaurants/{restaurantId}/categories/{categoryId}` comme categorie locale;
- conserver `marketplaceFoodCategories/{categoryId}` comme taxonomie globale;
- ajouter/normaliser un champ de mapping `marketplaceCategoryId` sur categorie locale et/ou produit;
- ne jamais remplacer `categoryId` local par un identifiant global;
- laisser `categoryId` piloter le menu restaurant;
- laisser `marketplaceCategoryId` piloter la decouverte globale.

## 12. Indexation actuelle

`firestore.indexes.json` contient deja les index suivants pour `marketplaceDishOffers` :

- `discoverable + normalizedName + __name__`
- `discoverable + marketplaceCategoryId + normalizedName + __name__`
- `discoverable + restaurantId + normalizedName + __name__`
- `discoverable + createdAt desc + __name__ desc`
- `discoverable + orderCount desc + __name__ desc`

Et pour `marketplaceFoodCategories` :

- `active + sortOrder + __name__`

Ces index correspondent a la V1 :

- recherche par nom de plat;
- filtre categorie;
- filtre restaurant;
- tri recent;
- tri populaire.

Limite : les index ne couvrent pas encore ville, pays, services, cuisine, fourchette de prix, disponibilite horaire, livraison, geolocalisation ou recherche full-text.

## 13. Regles Firestore

Preuve : `firestore.rules`

`marketplaceDishOffers` :

```txt
allow read: if resource.data.discoverable == true
  && resource.data.schemaVersion == 1;
allow write: if false;
```

`marketplaceFoodCategories` :

```txt
allow read: if resource.data.active == true
  && resource.data.schemaVersion == 1;
allow create, update, delete: if isSuperAdmin();
```

Conclusion : le design de securite actuel est sain pour un marketplace public :

- les clients lisent uniquement des projections explicitement publiques;
- les clients n'ecrivent pas les offres;
- les categories globales sont administrables par super admin.

## 14. Localisation

### 14.1 Disponible aujourd'hui

Donnees lisibles :

- `city`
- `country`
- `address`
- `restaurantLocation` sous forme de chaine projetee.

Donnees possibles lors de la creation restaurant :

- `location.address`
- `location.googleMapsUrl`
- `location.lat`
- `location.lng`

### 14.2 Limites

Le read model marketplace ne contient pas actuellement :

- `cityNormalized`
- `countryCode`
- `location.lat`
- `location.lng`
- geohash;
- zone de livraison;
- rayon de service;
- disponibilite livraison/retrait par restaurant.

La localisation future ne doit pas etre implementee par filtrage client sur une chaine `restaurantLocation`. Il faut une projection publique structuree.

## 15. Limites actuelles

1. Recherche plat limitee a `normalizedName` en prefixe.
2. `searchTokens` existe mais n'est pas utilise.
3. Marketplace restaurants historique charge tous les restaurants actifs avant filtrage.
4. Pas de read model dedie aux restaurants populaires.
5. Pas de read model dedie aux groupes de plats populaires.
6. Popularite disponible seulement via `orderCount` produit, si le champ est correctement maintenu.
7. Pas de champ public structure pour ville/pays/GPS dans `marketplaceDishOffers`.
8. Pas de filtre prix exploitable autrement que via `displayPrice`.
9. Les categories globales existent mais l'interface de mapping semble incomplete.
10. Le menu public limite les produits charges a 50, meme si le fallback produit cible existe pour un clic marketplace.
11. Les criteres `isActive` different legerement entre projection (`!== false`) et menu public (`== true`).
12. La synchronisation runtime des projections n'est pas prouvee comme automatique partout; des scripts de backfill/rebuild existent.
13. Le feature flag peut basculer l'experience racine entre marketplace plats et marketplace restaurants.

## 16. Architecture cible recommandee

### 16.1 Principe directeur

Ne pas faire chercher le marketplace directement dans les sous-collections restaurant.

Pour plusieurs centaines de restaurants, la bonne architecture est un read model public denormalise :

```txt
restaurants/{restaurantId}
restaurants/{restaurantId}/products/{productId}
restaurants/{restaurantId}/categories/{categoryId}
        |
        | projection backend
        v
marketplaceDishOffers/{restaurantId}__{productId}
marketplaceRestaurantCards/{restaurantId}
marketplaceFoodCategories/{categoryId}
marketplaceDishGroups/{normalizedDishKey}   (optionnel phase 2/3)
```

### 16.2 MarketplaceDishOffers

Conserver et etendre progressivement `marketplaceDishOffers`.

Champs a stabiliser :

- identite offre;
- identite restaurant;
- identite produit;
- prix;
- image;
- disponibilite;
- qualite de donnees;
- categories globales;
- champs de recherche;
- champs de localisation;
- metriques de popularite.

### 16.3 MarketplaceRestaurantCards

Ajouter a terme une projection restaurant publique dediee au lieu de charger directement `restaurants`.

Objectif :

- recherche restaurant serveur;
- pagination;
- filtres service/cuisine/ville;
- tri popularite;
- exclusion des champs prives;
- coherence securite avec `marketplaceDishOffers`.

### 16.4 MarketplaceDishGroups

Pour une UX "chercher un plat" plus mature, introduire ensuite un groupement :

```txt
marketplaceDishGroups/{normalizedDishKey}
```

Ce document represente le plat generique ("pizza margherita", "burger", "poulet braise") et contient :

- nom canonique;
- aliases;
- categorie globale;
- image representative;
- nombre d'offres;
- prix minimum;
- restaurants disponibles;
- score popularite.

Les offres restent dans `marketplaceDishOffers`.

## 17. Strategie d'indexation cible

### Lot V1 robuste

Conserver :

- `discoverable + normalizedName + __name__`
- `discoverable + marketplaceCategoryId + normalizedName + __name__`
- `discoverable + restaurantId + normalizedName + __name__`
- `discoverable + createdAt desc`
- `discoverable + orderCount desc`

Ajouter si filtres exposes :

- `discoverable + cityNormalized + normalizedName`
- `discoverable + countryCode + cityNormalized + normalizedName`
- `discoverable + marketplaceCategoryId + orderCount desc`
- `discoverable + displayPrice asc`

### Lot recherche avancee

Firestore seul reste limite pour la recherche multi-mots et pertinence.

Options :

1. Etendre Firestore avec `searchTokens`/`array-contains` pour une V1 simple.
2. Ajouter une collection `marketplaceSearchIndex` denormalisee par token.
3. Ajouter un moteur externe plus tard si le volume/pertinence l'exige.

Pour plusieurs centaines de restaurants, Firestore avec read model et index composes reste suffisant si les filtres sont limites et anticipes.

## 18. Strategie categories globales

Architecture recommandee :

```txt
marketplaceFoodCategories/{globalCategoryId}
restaurants/{restaurantId}/categories/{localCategoryId}.marketplaceCategoryId
restaurants/{restaurantId}/products/{productId}.marketplaceCategoryId
```

Regles :

- `categoryId` local ne change jamais de sens.
- `marketplaceCategoryId` est une liaison globale facultative.
- le produit peut surcharger la categorie globale heritee de sa categorie locale.
- les imports de bibliotheque peuvent renseigner `sourceTemplateId`; ce champ ne doit pas remplacer la categorie globale.
- les categories globales doivent etre gerees par la plateforme.

Besoin produit :

- interface super admin pour creer/ordonner/activer les categories globales;
- interface restaurant ou plateforme pour mapper categories locales vers categories globales;
- audit des categories sans mapping;
- fallback "Autres" seulement si explicitement voulu produit.

## 19. Strategie recherche cible

### Recherche par plat

Source principale : `marketplaceDishOffers`.

V1 :

- prefixe sur `normalizedName`;
- filtre categorie globale;
- pagination par curseur.

V2 :

- tokens sur nom, description, categorie, aliases;
- score combinant correspondance, popularite, qualite image/prix, disponibilite restaurant.

### Recherche par restaurant

Source cible : `marketplaceRestaurantCards`.

Filtres :

- nom;
- ville;
- pays;
- cuisine;
- services;
- ouvert/ferme si la donnee horaire est disponible plus tard.

### Popularite restaurants

Ne pas deduire uniquement depuis le nombre de produits.

Source recommandee :

- commandes confirmees;
- vues marketplace;
- ouvertures de menu;
- clics offre;
- score decroissant avec fenetre temporelle.

Document cible :

```txt
marketplaceRestaurantCards/{restaurantId}.popularityScore
```

### Popularite plats

Source actuelle possible : `product.orderCount`.

Mieux :

- agreger commandes par `productId`;
- conserver `orderCount` ou `popularityScore` dans la projection;
- recalculer par fenetre temporelle.

## 20. Strategie localisation cible

Ajouter a la projection publique :

- `countryCode`
- `city`
- `cityNormalized`
- `addressLabel`
- `geo.lat`
- `geo.lng`
- `geohash` si recherche proximite;
- `serviceZones` si livraison;
- `deliveryEnabled`, `pickupEnabled`, `dineInEnabled` si ces donnees existent de facon canonique.

Pour une premiere version scalable :

- filtre ville/pays par champs normalises;
- pas de distance GPS tant que la collecte `lat/lng` n'est pas obligatoire.

Pour une version proximite :

- stocker coordonnees normalisees;
- utiliser geohash ou service externe;
- ne jamais calculer la proximite a partir d'une chaine adresse.

## 21. Risques

1. Divergence entre donnees sources restaurant et projections marketplace.
2. Produits projetes mais non ouvrables dans le menu public si les criteres `isActive` divergent.
3. Mapping categories globales incomplet, produisant des categories vides.
4. Recherche peu pertinente si elle reste limitee au prefixe `normalizedName`.
5. Donnees de popularite peu fiables si `orderCount` n'est pas maintenu partout.
6. Filtres client-side impossibles a maintenir si le nombre de restaurants augmente.
7. Localisation fragile si `city/address/location` restent heterogenes.
8. Necessite d'index Firestore avant exposition de nouveaux filtres.
9. Risque SEO si `/` devient trop dynamique sans structure canonique claire.
10. Risque de confusion UX entre categorie restaurant locale et categorie marketplace globale.

## 22. Roadmap d'implementation par lots

### Lot 0 - Stabilisation et preuves

- Documenter les champs sources obligatoires.
- Verifier l'etat reel des projections existantes.
- Confirmer comment les projections sont declenchees en production.
- Harmoniser les criteres `productActive` entre projection et menu public.
- Ne pas changer l'UX.

### Lot 1 - Marketplace plats V1 solide

- Conserver `marketplaceDishOffers`.
- Finaliser la pagination, recherche prefixe, categories globales.
- Ajouter les champs de localisation normalises simples.
- Ajouter les index necessaires.
- Garder le lien `/{slug}?product=...&source=marketplace`.

### Lot 2 - Restaurants marketplace scalable

- Creer `marketplaceRestaurantCards`.
- Remplacer la lecture directe de `restaurants` sur `/ ?view=restaurants`.
- Ajouter pagination et filtres serveur.
- Preparer `popularRestaurants`.

### Lot 3 - Categories globales admin

- Interface super admin de categories globales.
- Mapping categorie restaurant -> categorie globale.
- Audit des categories sans mapping.
- Reprojection des offres impactees.

### Lot 4 - Recherche avancee

- Exploiter `searchTokens` ou creer un index tokenise.
- Rechercher par plat, restaurant, categorie, ville.
- Ajouter scoring simple.

### Lot 5 - Popularite

- Definir les metriques canoniques.
- Agreger popularite plats/restaurants.
- Ajouter `popular` dans l'UI sans donnees fictives.

### Lot 6 - Localisation avancee

- Normaliser `location`.
- Ajouter geohash ou service de proximite.
- Ajouter filtres distance/zone si donnees fiables.

## 23. Decision d'architecture

L'existant doit etre etendu autour du read model `marketplaceDishOffers`, pas remplace par une lecture directe des sous-collections restaurant.

Pour les besoins cibles, l'architecture recommandee est :

- garder les menus restaurant comme source metier;
- garder `marketplaceDishOffers` comme index public des offres de plats;
- ajouter un read model restaurant public dedie;
- garder `marketplaceFoodCategories` comme taxonomie globale;
- utiliser `marketplaceCategoryId` comme liaison non destructive;
- ajouter une strategie de recherche/indexation progressive;
- ajouter la localisation seulement avec champs structures.

Conclusion : l'application possede deja une base saine pour un marketplace oriente plats, mais elle doit etre stabilisee en read models publics denormalises avant une refonte UX majeure ou une montee en charge.

## 24. ARCHITECTURE PRODUIT VALIDÉE DU MARKETPLACE

Cette section fige les decisions produit qui guideront les prochains lots marketplace.

### Vision produit validee

Le marketplace Oordera est un moteur de decouverte culinaire, pas un simple annuaire de restaurants.

L'objectif principal n'est pas seulement de lister les etablissements, mais d'aider un client a partir d'une envie alimentaire concrete : pizza, hamburger, plats africains, petit-dejeuner, boissons, etc.

### Source de verite produit

La bibliotheque de menus plateforme n'est pas la source directe du marketplace.

Le marketplace utilise uniquement les produits reellement publies dans les menus actifs des restaurants. Les modeles plateforme peuvent aider a creer les menus restaurant, mais ils ne doivent pas etre affiches directement comme offres marketplace.

### Categories marketplace globales

Les categories marketplace sont globales et distinctes des categories locales propres a chaque restaurant.

Exemples :

- Pizza
- Hamburger
- Plats africains
- Petit-dejeuner
- Boissons

Les categories locales restaurant continuent de piloter le menu interne du restaurant. Les categories globales servent uniquement a la decouverte marketplace.

### Parcours categorie valide

Parcours cible :

```txt
Marketplace
-> clic sur une categorie globale, par exemple Pizza
-> page paginee des restaurants proposant cette categorie
-> une seule carte par restaurant
-> classement par popularite, disponibilite et plus tard proximite
-> clic sur un restaurant
-> ouverture directe de son menu
-> couverture du restaurant ignoree
-> categorie locale correspondante deja selectionnee
-> affichage des produits de cette categorie
-> ajout au panier
-> commande et paiement
```

La page categorie marketplace ne doit pas afficher tous les produits de tous les restaurants. Elle doit afficher une carte par restaurant proposant la categorie globale.

Chaque carte restaurant doit afficher au minimum :

- nom du restaurant;
- logo ou image representative;
- ville, commune ou quartier;
- statut ouvert/ferme;
- nombre de produits disponibles dans la categorie;
- prix minimum;
- score de popularite futur.

### Navigation cible

Format valide :

```txt
/{restaurantSlug}?category={localCategoryId}&source=marketplace
```

La page publique doit :

- detecter `source=marketplace`;
- ignorer la couverture;
- ouvrir directement le menu;
- selectionner la categorie demandee;
- afficher les produits correspondants.

### Modele technique recommande

Conserver :

- `marketplaceDishOffers`
- `marketplaceFoodCategories`

Ajouter :

- `marketplaceRestaurantCards`
- `marketplaceRestaurantCategoryOffers`

Projection recommandee :

```ts
type MarketplaceRestaurantCategoryOffer = {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  marketplaceCategoryId: string
  localCategoryId: string
  productCount: number
  minimumPrice: number | null
  representativeImageUrl: string | null
  popularityScore: number
  cityName: string | null
  communeName: string | null
  districtName: string | null
  discoverable: boolean
  updatedAt: unknown
}
```

Regle principale : une projection `marketplaceRestaurantCategoryOffers` represente un restaurant proposant une categorie globale.

### Localisation validee

Modele de localisation cible :

```txt
Pays
-> Ville
-> Commune
-> Quartier
-> Adresse
-> Latitude/Longitude
```

La localisation servira plus tard a :

- filtrer par ville;
- afficher les restaurants proches;
- classer par distance;
- ouvrir un itineraire;
- afficher l'adresse du restaurant.

### Ordre de future implementation

1. Lot 0 - stabilisation de la synchronisation
2. Lot 1 - categories globales et mapping
3. Lot 2 - projection `marketplaceRestaurantCategoryOffers`
4. Lot 3 - projection `marketplaceRestaurantCards`
5. Lot 4 - page categorie marketplace paginee
6. Lot 5 - ouverture directe du menu sur la categorie
7. Lot 6 - recherche plats/restaurants
8. Lot 7 - popularite
9. Lot 8 - localisation et proximite
10. Lot 9 - refonte UX/UI finale

Ordre directeur :

```txt
1. Figer la feuille de route marketplace
2. Implementer la localisation structuree
3. Stabiliser la synchronisation marketplace
4. Implementer les projections necessaires
5. Refactorer le marketplace
6. Refaire l'UX/UI finale
```

### Checklist finale GO/NO-GO

- [ ] Architecture produit figee
- [ ] Modele de localisation stabilise
- [ ] Synchronisation marketplace fiable
- [ ] Categories globales administrables
- [ ] Projections publiques disponibles
- [ ] Tests valides
- [ ] Refonte UX autorisee
