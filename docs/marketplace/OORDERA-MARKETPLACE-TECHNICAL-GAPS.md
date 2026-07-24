# OORDERA - Complément technique Marketplace

Date : 2026-07-23

Statut : AUDIT UNIQUEMENT - Aucune implementation applicative realisee.

Rapport de reference : `docs/marketplace/OORDERA-MARKETPLACE-ARCHITECTURE-AUDIT.md`

## 1. Comment `marketplaceDishOffers` est-il synchronise en production ?

Reponse prouvee par le code : aucun mecanisme de synchronisation production automatique n'est branche dans le code audite.

Ce qui existe :

- Script manuel/backfill : `scripts/marketplace-discovery-backfill.mjs`
- Script manuel/rebuild : `scripts/marketplace-discovery-rebuild.mjs`
- Fonctions library non appelees ailleurs : `src/lib/marketplace-discovery/marketplace-discovery-sync.ts`
- Scripts npm : `package.json`
  - `marketplace:backfill`
  - `marketplace:rebuild`
  - `marketplace:load-test`

Ce qui n'a pas ete trouve :

- aucun dossier `functions` local;
- aucune importation de `firebase-functions`;
- aucun trigger `functions.firestore`, `onDocumentCreated`, `onDocumentUpdated`, `onDocumentWritten`;
- aucune reference appelee a `syncMarketplaceDishOffer(...)`, `deleteMarketplaceDishOffer(...)` ou `disableMarketplaceRestaurantOffers(...)` en dehors de leur fichier de definition.

Conclusion : d'apres le code present, `marketplaceDishOffers` est alimente par script manuel/backfill, pas par Cloud Function ni par service applicatif branche aux ecritures produits.

## 2. Quels evenements declenchent aujourd'hui la creation, mise a jour ou suppression d'une offre marketplace ?

Evenements reels prouves :

- Execution manuelle de `npm run marketplace:backfill`
  - fichier : `scripts/marketplace-discovery-backfill.mjs`
  - effet : parcourt `restaurants`, puis `restaurants/{restaurantId}/products`, lit la categorie locale et ecrit `marketplaceDishOffers/{restaurantId}__{productId}`.
- Execution manuelle de `npm run marketplace:rebuild`
  - fichier : `scripts/marketplace-discovery-rebuild.mjs`
  - effet : supprime les offres obsoletes dont le produit source n'existe plus, puis recommande de relancer le backfill.

Fonctions prevues mais non branchees :

- `syncMarketplaceDishOffer(...)`
  - fichier : `src/lib/marketplace-discovery/marketplace-discovery-sync.ts`
  - effet : `set(projection, { merge: false })`.
- `deleteMarketplaceDishOffer(...)`
  - effet : suppression directe d'une projection.
- `disableMarketplaceRestaurantOffers(...)`
  - effet : passe `restaurantActive: false`, `discoverable: false`, `quality: "unavailable"` sur les offres d'un restaurant.

Evenements non prouves :

- creation produit restaurant;
- modification produit;
- desactivation produit;
- suppression produit;
- modification categorie locale;
- modification restaurant;
- suspension restaurant.

Ces evenements existent dans l'application, mais ils ne declenchent pas actuellement la synchronisation marketplace d'apres les appels trouves.

## 3. Risque qu'un produit modifie, desactive ou supprime reste visible dans `marketplaceDishOffers`

Oui, risque eleve.

Preuves :

- Modification produit via manager :
  - fichier : `src/app/(dashboard)/manager/components/ManagerClient.tsx`
  - fonctions : `handleSaveProduct`, `handleToggleProduct`, `handleDeleteProduct`
  - ecritures : `updateDoc`, `addDoc`, `deleteDoc` sur `restaurants/{restaurantId}/products`
  - aucune synchronisation marketplace appelee.
- Modification produit via ancien editeur :
  - fichier : `src/components/menu/ProductEditor.tsx`
  - ecritures : `updateDoc`, `addDoc` sur `restaurants/{restaurantId}/products`
  - aucune synchronisation marketplace appelee.
- Backfill :
  - fichier : `scripts/marketplace-discovery-backfill.mjs`
  - met a jour seulement si le script est execute.
- Rebuild :
  - fichier : `scripts/marketplace-discovery-rebuild.mjs`
  - supprime seulement les projections dont le produit source n'existe plus, et seulement si le script est execute.

Cas concrets :

- Produit renomme : l'ancien nom peut rester dans `marketplaceDishOffers` jusqu'au prochain backfill.
- Produit desactive : `discoverable` peut rester `true` jusqu'au prochain backfill ou sync.
- Produit supprime : l'offre peut rester presente jusqu'au prochain rebuild.
- Restaurant suspendu : les offres peuvent rester visibles sauf si une sync/rebuild les desactive.

## 4. Le champ `orderCount` est-il réellement maintenu automatiquement ?

Non prouve. Aucun ecrivain persistant de `product.orderCount` n'a ete trouve.

Lectures/usages :

- `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
  - `projectMarketplaceDishOffer` lit `product.orderCount` et le copie dans la projection.
- `src/lib/marketplace-discovery/marketplace-discovery-repository.ts`
  - `listOffers({ order: "popular" })` trie par `orderCount`.
- `src/modules/public/PublicPage.tsx`
  - trie localement les produits par `(b.orderCount || 0) - (a.orderCount || 0)`.

Occurrences non pertinentes comme maintien produit :

- `src/app/(dashboard)/dashboard/tables/page.tsx`
- `src/app/(dashboard)/pos/components/POSClient.tsx`
- `src/app/(manager)/manager/caisse/page.tsx`

Ces occurrences calculent des compteurs UI/session, pas `restaurants/{restaurantId}/products/{productId}.orderCount`.

Conclusion : la popularite par `orderCount` existe dans le schema et l'affichage, mais aucun flux automatique ne maintient ce champ sur les produits d'apres le code existant.

## 5. Fiabilite des champs restaurant publics

### `city`

Existe, partiellement fiable.

Preuves :

- `src/services/restaurant.service.ts` exige `city` dans `RestaurantData` et l'ecrit lors de `createRestaurantForOwner`.
- `src/app/platform/restaurants/[restaurantId]/components/PlatformRestaurantDetailClient.tsx` permet de modifier `city`.
- `src/app/page.tsx` utilise `city` dans `toPublicRestaurant`.
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts` inclut `city` dans `restaurantLocation`.

Limite : certains flux historiques peuvent avoir `city` vide ou absent.

### `country`

Existe mais non fiable comme source unique.

Preuves :

- `src/app/page.tsx` tente `country`.
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts` tente `country`.
- `src/types.ts` declare `country`.

Limite : les flux recents utilisent surtout `countryCode`/`countryName`; le document fourni par l'utilisateur montrait `country: ""` et `countryCode: "ML"`.

### `address`

Existe mais heterogene.

Preuves :

- `src/app/page.tsx` lit `data.address`.
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts` lit `restaurant.address`.
- `src/services/restaurant.service.ts` ecrit plutot `location.address`.

Limite : la projection actuelle ne lit pas `restaurant.location.address`, seulement `restaurant.address`.

### `location.lat` / `location.lng`

Existe dans le service de creation, mais non exploite par le marketplace.

Preuves :

- `src/services/restaurant.service.ts` accepte et nettoie `location.lat` et `location.lng`.

Limites :

- `src/app/page.tsx` ne les lit pas.
- `src/lib/marketplace-discovery/marketplace-discovery-core.ts` ne les projette pas.
- aucun index geographique n'existe dans `firestore.indexes.json`.

### `cuisineTypes`

Existe dans le type source marketplace, mais fiabilite non prouvee.

Preuves :

- `src/lib/marketplace-discovery/marketplace-discovery-types.ts` declare `cuisineTypes` et `cuisineType`.
- `src/app/page.tsx` lit `cuisineTypes ?? cuisineType`.
- `projectMarketplaceDishOffer` projette `restaurantCuisineTypes`.

Limite : aucune interface lue ne semble administrer clairement ce champ dans les ecrans restaurant audites.

### `services`

Existe dans le type source marketplace, mais fiabilite non prouvee.

Preuves :

- `src/lib/marketplace-discovery/marketplace-discovery-types.ts` declare `services`.
- `src/app/page.tsx` lit `services`.
- `projectMarketplaceDishOffer` projette `restaurantServices`.
- `src/app/marketplace-client.tsx` filtre les restaurants par `services`.

Limite : aucune interface lue ne semble administrer clairement ce champ dans les ecrans restaurant audites.

## 6. Combien de restaurants actuels possedent ces champs correctement renseignes ?

Non determinable a partir du code seul.

Le repository ne contient pas d'export Firestore local des documents `restaurants`. Sans acces runtime a Firestore ou sans dump de donnees, le code permet d'identifier les champs lus/ecrits, mais pas de compter les documents actuellement renseignes.

Requete de verification recommandee, sans implementation dans cette mission :

```txt
restaurants
  count total actifs
  count city non vide
  count country non vide
  count countryCode non vide
  count address non vide
  count location.address non vide
  count location.lat/location.lng numeriques
  count cuisineTypes tableau non vide
  count services tableau non vide
```

Constat minimal prouve par donnees fournies dans la conversation : le restaurant `Univers Food` possede `city: "Bamako"` et `countryCode: "ML"`, mais `country: ""`. Cela illustre deja l'heterogeneite `country`/`countryCode`.

## 7. Creation et administration de `marketplaceFoodCategories` et `marketplaceDishOffers`

### `marketplaceDishOffers`

Creation/mise a jour :

- Script : `scripts/marketplace-discovery-backfill.mjs`
  - collection cible : `marketplaceDishOffers`
  - ecriture : `writeBatch.set(..., projection, { merge: false })`
- Fonction non branchee : `syncMarketplaceDishOffer`
  - fichier : `src/lib/marketplace-discovery/marketplace-discovery-sync.ts`
  - ecriture : `set(projection, { merge: false })`

Suppression/desactivation :

- Script : `scripts/marketplace-discovery-rebuild.mjs`
  - supprime les offres dont le produit source n'existe plus.
- Fonction non branchee : `deleteMarketplaceDishOffer`.
- Fonction non branchee : `disableMarketplaceRestaurantOffers`.

Administration client :

- interdite par regles Firestore.
- `firestore.rules` : `allow write: if false`.

### `marketplaceFoodCategories`

Lecture publique :

- `MarketplaceDishRepository.listActiveCategories`
  - collection : `marketplaceFoodCategories`
  - filtre : `where("active", "==", true)`
  - tri : `orderBy("sortOrder", "asc")`

Administration :

- `firestore.rules` autorise `create, update, delete` uniquement a `isSuperAdmin()`.

Interface :

- aucune interface dediee `marketplaceFoodCategories` n'a ete trouvee dans `src/app/platform` ou `src/modules`.
- le code plateforme existant administre `platformMenuPacks`, `platformMenuCategories`, `platformMenuProducts`, pas `marketplaceFoodCategories`.

Conclusion : la collection globale est prevue dans les regles et le repository, mais son interface d'administration n'est pas presente dans le code audite.

## 8. Interface de liaison categorie locale -> categorie globale marketplace

Aucune interface existante trouvee.

Preuves :

- `marketplaceCategoryId` est declare dans :
  - `src/lib/marketplace-discovery/marketplace-discovery-types.ts`
  - `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
- `projectMarketplaceDishOffer` lit `product.marketplaceCategoryId || category?.marketplaceCategoryId`.

Mais :

- `src/app/(dashboard)/manager/components/ManagerClient.tsx` ne renseigne pas `marketplaceCategoryId` lors de la creation/modification de categories ou produits.
- `src/components/menu/ProductEditor.tsx` ne renseigne pas `marketplaceCategoryId`.
- `src/modules/menu-library/MenuLibraryImportDialog.tsx` ne copie pas `marketplaceCategoryId`.
- `src/app/platform/menu-library/components/PlatformMenuLibraryClient.tsx` ne gere pas `marketplaceCategoryId` dans les templates.

Conclusion : le champ est supporte par la projection, mais il n'existe pas d'outil UI prouve pour l'administrer.

## 9. Import depuis la bibliotheque : champs conserves

Lors d'un import depuis la bibliotheque, le restaurant conserve :

- `source: "platform_menu_library"`
- `sourceTemplateId`
- `categoryId` local remappe.

Il ne conserve pas `marketplaceCategoryId`.

Preuves :

- `src/modules/menu-library/MenuLibraryImportDialog.tsx`
  - categories creees avec `sourceTemplateId: category.id`
  - produits crees avec `sourceTemplateId: product.id`
  - produits crees avec `categoryId: mappedCategoryId`
  - aucun champ `marketplaceCategoryId` dans le payload.
- `src/modules/menu-library/types.ts`
  - `PlatformMenuCategoryTemplate` ne declare pas `marketplaceCategoryId`.
  - `PlatformMenuProductTemplate` ne declare pas `marketplaceCategoryId`.
- `src/app/platform/menu-library/components/PlatformMenuLibraryClient.tsx`
  - payload categorie/produit ne contient pas `marketplaceCategoryId`.

Conclusion : l'import conserve l'origine template, mais pas la liaison vers une categorie globale marketplace.

## 10. Peut-on creer `marketplaceRestaurantCards` sans modifier les menus restaurant ni les flux de commande ?

Oui.

Justification :

- Le marketplace restaurants actuel lit deja `restaurants` et transforme les donnees en `PublicRestaurantSummary` dans `src/app/page.tsx`.
- Cette transformation peut devenir une projection separee sans changer :
  - `restaurants/{restaurantId}/products`
  - `restaurants/{restaurantId}/categories`
  - `restaurants/{restaurantId}/orders`
  - checkout
  - panier
  - suivi commande
  - POS
  - cuisine

La projection cible peut etre purement publique :

```txt
marketplaceRestaurantCards/{restaurantId}
```

Champs possibles issus du code actuel :

- `restaurantId`
- `name`
- `slug`
- `logoUrl`
- `coverUrl`
- `description`
- `city`
- `countryCode`
- `countryName`
- `restaurantLocation`
- `cuisineTypes`
- `services`
- `status`
- `discoverable`
- `schemaVersion`
- `updatedAt`

Attention : il faut exclure les champs prives listes en section 11.

## 11. Champs prives `restaurants` a ne jamais copier dans une projection publique

Champs explicitement sensibles ou non necessaires, observes dans le code ou dans les donnees :

- `ownerEmail`
- `ownerId`
- `email`
- `phone` sauf decision produit explicite pour telephone public
- `paymentConfig`
- `paymentMethods`
- `cloudinarySecret`
- `token`
- `permissions`
- `logs`
- `auditLogs`
- `staff`
- `subscription`
- `settings` complet
- `theme` complet si des donnees non visuelles y sont ajoutees plus tard
- `createdBy`
- `updatedBy`
- tout identifiant utilisateur interne

Preuve de philosophie existante :

- `src/lib/marketplace-discovery/marketplace-discovery-core.ts`
  - `MARKETPLACE_DISCOVERY_PUBLIC_FIELDS` liste explicitement les champs autorises.
  - `MARKETPLACE_DISCOVERY_FORBIDDEN_FIELDS` interdit notamment `costPrice`, `margin`, `stockQuantity`, `recipe`, `ingredients`, `supplier`, `ownerId`, `userId`, `email`, `phone`, `paymentConfig`, `cloudinarySecret`, `token`, `permissions`, `logs`.
- `tests/marketplace-discovery/marketplace-discovery.test.mjs`
  - verifie que `ownerId`, `costPrice`, `recipe` ne sortent pas dans la projection.

## 12. Mecanisme de synchronisation le plus coherent

Recommandation : combinaison de trois mecanismes.

### Mecanisme principal : Cloud Functions Firestore triggers

Le plus coherent pour la production, car les ecritures produits/categories/restaurants sont dispersees.

Triggers recommandes :

- `restaurants/{restaurantId}` onWrite
  - met a jour/desactive les offres du restaurant;
  - met a jour `marketplaceRestaurantCards`.
- `restaurants/{restaurantId}/products/{productId}` onWrite
  - cree/met a jour/desactive/supprime `marketplaceDishOffers/{restaurantId}__{productId}`.
- `restaurants/{restaurantId}/categories/{categoryId}` onWrite
  - reprojette les produits de la categorie si `name`, `marketplaceCategoryId`, `isActive` ou `updatedAt` changent.

### Mecanisme secondaire : fonctions appelees par services existants

Possible en complement, mais insuffisant seul car les ecritures sont deja dispersees :

- `ManagerClient`
- `ProductEditor`
- `MenuLibraryImportDialog`
- scripts et anciens flux.

### Mecanisme de securite : rebuild/backfill planifie

Conserver :

- `marketplace:backfill`
- `marketplace:rebuild`

Usage :

- correction d'ecarts;
- migration de schema;
- recalcul de scores;
- verification periodique.

Conclusion : Cloud Functions comme source de synchro temps reel, scripts comme filet de securite, services applicatifs seulement en optimisation ou apres refonte de tous les writers.

## 13. Index Firestore necessaires

### Index existants

`firestore.indexes.json` contient deja :

- `marketplaceDishOffers`: `discoverable + normalizedName + __name__`
- `marketplaceDishOffers`: `discoverable + marketplaceCategoryId + normalizedName + __name__`
- `marketplaceDishOffers`: `discoverable + restaurantId + normalizedName + __name__`
- `marketplaceDishOffers`: `discoverable + createdAt desc + __name__ desc`
- `marketplaceDishOffers`: `discoverable + orderCount desc + __name__ desc`
- `marketplaceFoodCategories`: `active + sortOrder + __name__`

### Ville

Pour `marketplaceDishOffers` :

- `discoverable ASC`
- `cityNormalized ASC`
- `normalizedName ASC`
- `__name__ ASC`

Pour `marketplaceRestaurantCards` :

- `discoverable ASC`
- `cityNormalized ASC`
- `normalizedName ASC`
- `__name__ ASC`

### Categorie globale

Existe deja pour recherche nom :

- `discoverable ASC`
- `marketplaceCategoryId ASC`
- `normalizedName ASC`
- `__name__ ASC`

A ajouter pour popularite par categorie :

- `discoverable ASC`
- `marketplaceCategoryId ASC`
- `orderCount DESC` ou `popularityScore DESC`
- `__name__ DESC`

### Popularite

Existe pour `orderCount` global :

- `discoverable ASC`
- `orderCount DESC`
- `__name__ DESC`

A terme preferer :

- `discoverable ASC`
- `popularityScore DESC`
- `__name__ DESC`

### Prix

Pour filtres ou tri prix :

- `discoverable ASC`
- `displayPrice ASC`
- `__name__ ASC`

Avec categorie :

- `discoverable ASC`
- `marketplaceCategoryId ASC`
- `displayPrice ASC`
- `__name__ ASC`

### Recherche par restaurant

Pour offres d'un restaurant :

- deja existant : `discoverable + restaurantId + normalizedName + __name__`.

Pour une projection restaurant cible :

- `discoverable ASC`
- `normalizedName ASC`
- `__name__ ASC`

Avec ville :

- `discoverable ASC`
- `cityNormalized ASC`
- `normalizedName ASC`
- `__name__ ASC`

Avec popularite :

- `discoverable ASC`
- `popularityScore DESC`
- `__name__ DESC`

## 14. Tests existants et tests manquants

### Tests existants

`tests/marketplace-discovery/marketplace-discovery.test.mjs`

Couvre :

- feature flag exact `MARKETPLACE_DISH_DISCOVERY_ENABLED`;
- normalisation recherche;
- generation d'identifiant offre;
- resolution prix;
- projection whitelist;
- exclusion champs prives;
- restaurant/produit inactif -> `discoverable: false`;
- categorie globale non inventee;
- curseur encode/decode.

`tests/marketplace-discovery/firestore-rules.test.mjs`

Couvre :

- presence des regles `marketplaceDishOffers`;
- lecture publique conditionnee;
- ecriture publique interdite;
- lecture categories actives.

`tests/marketplace-transaction/marketplace-offer-navigation.test.mjs`

Couvre :

- construction URL `/{slug}?product=...&source=marketplace`;
- preservation parametres transactionnels;
- rejet slug/product invalides;
- resolution produit cible;
- produit absent/desactive.

`tests/marketplace-transaction/marketplace-cart-isolation.test.mjs`

Couvre :

- isolation paniers par restaurant;
- persistence apres refresh;
- migration ancienne cle localStorage.

### Tests manquants avant refonte

Synchronisation :

- produit cree -> projection creee;
- produit modifie -> projection mise a jour;
- produit desactive -> `discoverable: false`;
- produit supprime -> projection supprimee ou desactivee;
- restaurant suspendu -> offres desactivees;
- categorie locale modifiee -> produits reprojetes.

Backfill/rebuild :

- backfill dry-run;
- backfill write avec restaurant cible;
- rebuild supprime uniquement les offres obsoletes;
- garde-fous environnement (`FIRESTORE_EMULATOR_HOST`, `MARKETPLACE_DISCOVERY_ENV`).

Recherche :

- prefixe `normalizedName`;
- filtre categorie globale;
- pagination stable;
- tri populaire avec `orderCount`;
- recherche restaurant future.

Mapping categories :

- produit herite `category.marketplaceCategoryId`;
- produit surcharge `product.marketplaceCategoryId`;
- categorie sans mapping reste sans mapping, sans categorie fictive.

Securite :

- rules test reel avec emulator pour `read allowed` si `discoverable/schemaVersion`;
- `read denied` si `discoverable: false`;
- `write denied` client;
- categories globales write super admin uniquement.

Localisation :

- projection `cityNormalized`;
- absence de lat/lng invalide;
- filtre ville.

Donnees privees :

- restaurant phone/email/owner/payment jamais copies dans `marketplaceRestaurantCards`;
- produit cost/recipe/stock jamais copies dans `marketplaceDishOffers`.

## 15. Recommandation finale sur l'ordre technique d'implementation

Ordre recommande :

1. Stabiliser le contrat de projection actuel.
   - Verrouiller champs publics/prives.
   - Harmoniser `isActive === true` vs `isActive !== false`.
   - Ajouter tests manquants de projection pure.

2. Ajouter la synchronisation production.
   - Priorite : Cloud Functions Firestore triggers.
   - Brancher `restaurants/{restaurantId}/products/{productId}`.
   - Brancher `restaurants/{restaurantId}/categories/{categoryId}`.
   - Brancher `restaurants/{restaurantId}`.
   - Conserver scripts backfill/rebuild.

3. Creer ou finaliser l'administration des categories globales.
   - Interface `marketplaceFoodCategories`.
   - Mapping categorie locale -> categorie globale.
   - Mapping produit -> categorie globale facultatif.
   - Ne pas remplacer `categoryId` local.

4. Corriger l'import bibliotheque.
   - Ajouter `marketplaceCategoryId` aux templates si la taxonomie globale est prete.
   - Copier `marketplaceCategoryId` lors de l'import.
   - Garder `sourceTemplateId`.

5. Creer `marketplaceRestaurantCards`.
   - Projection publique restaurant.
   - Exclusion stricte champs prives.
   - Remplacement progressif de `renderRestaurantMarketplace()`.

6. Ajouter champs localisation normalises.
   - `cityNormalized`
   - `countryCode`
   - `location` publique structuree si fiable.
   - Index Firestore correspondants.

7. Ajouter popularite fiable.
   - Ne pas utiliser `orderCount` comme verite si non maintenu.
   - Creer un agregat de ventes/clics/vues.
   - Projeter `popularityScore`.

8. Ameliorer la recherche.
   - Exploiter `searchTokens`.
   - Ajouter index tokenise ou service de recherche plus tard.
   - Garder Firestore tant que le volume reste "centaines de restaurants".

Decision finale : ne pas refondre l'UX marketplace avant d'avoir corrige la synchronisation et le mapping global. L'UI peut etre premium, mais sans projection fiable elle affichera vite des produits stale, des categories vides et une popularite non prouvee.

## 16. ARCHITECTURE PRODUIT VALIDÉE DU MARKETPLACE

Cette section fige les decisions produit retenues pour transformer le marketplace en moteur de decouverte culinaire.

### Decisions produit

1. Le marketplace est un moteur de decouverte culinaire, pas un simple annuaire de restaurants.

2. La bibliotheque de menus plateforme n'est pas la source directe du marketplace. Le marketplace utilise uniquement les produits reellement publies dans les menus actifs des restaurants.

3. Les categories marketplace sont globales et restent distinctes des categories locales propres a chaque restaurant.

Exemples de categories globales :

- Pizza
- Hamburger
- Plats africains
- Petit-dejeuner
- Boissons

### Parcours categorie valide

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

La page categorie marketplace ne doit pas afficher tous les produits de tous les restaurants.

Chaque carte restaurant doit afficher au minimum :

- nom du restaurant;
- logo ou image representative;
- ville, commune ou quartier;
- statut ouvert/ferme;
- nombre de produits disponibles dans la categorie;
- prix minimum;
- score de popularite futur.

### Navigation cible

```txt
/{restaurantSlug}?category={localCategoryId}&source=marketplace
```

La page publique doit :

- detecter `source=marketplace`;
- ignorer la couverture;
- ouvrir directement le menu;
- selectionner la categorie demandee;
- afficher les produits correspondants.

### Modele technique valide

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

Regle principale : une projection represente un restaurant proposant une categorie globale.

### Localisation validee

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

### Ordre technique fige

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

## 17. Lot 0 - Stabilisation de synchronisation appliquée

Rapport détaillé : `docs/marketplace/LOT-0-MARKETPLACE-PROJECTION-SYNC.md`

Résultat technique :

- règle unique de publiabilité ajoutée dans `marketplace-discovery-core.ts`;
- `marketplace-discovery-sync.ts` expose désormais les opérations backend ciblées par produit, catégorie et restaurant;
- `marketplace-discovery-backfill.mjs` et `marketplace-discovery-rebuild.mjs` réutilisent la logique centrale;
- infrastructure Firebase Functions minimale ajoutée dans `functions/`;
- triggers Firestore ajoutés pour `restaurants`, `categories` et `products`;
- les triggers réutilisent `syncMarketplaceProductById`, `syncMarketplaceCategoryProducts`, `syncMarketplaceRestaurantProducts`, `deleteMarketplaceDishOffer` et `deleteMarketplaceRestaurantOffers`;
- aucun trigger n'écoute `marketplaceDishOffers`, ce qui évite une boucle de projection;
- tests marketplace mis à jour pour couvrir la règle unique, les produits désactivés, les catégories désactivées et les données minimales.

Limite restante :

- les Functions sont branchées dans le code mais n'ont pas été déployées;
- la validation runtime Firebase devra être faite dans l'environnement cible avant exposition production.

## 18. Lot 1 - Categories globales et mapping appliques

Rapport détaillé : `docs/marketplace/LOT-1-MARKETPLACE-CATEGORIES-MAPPING.md`

Résultat technique :

- interface Super Admin créée pour `marketplaceFoodCategories`;
- règles Firestore ajustées pour permettre au Super Admin de gérer aussi les catégories inactives;
- `marketplaceCategoryId` ajouté aux catégories locales restaurant et aux catégories modèles de la bibliothèque;
- import bibliothèque mis à jour pour copier le mapping disponible sans faire de la bibliothèque une source marketplace;
- projection `marketplaceDishOffers` rend une offre non découvrable lorsqu'aucun mapping global n'existe;
- tests marketplace mis à jour pour couvrir le mapping obligatoire.

Limite restante :

- `marketplaceRestaurantCategoryOffers` n'est pas encore créé;
- aucune refonte UX publique marketplace;
- aucun déploiement Firebase.

## 19. Lot 2 - Projection restaurant-categorie appliquee

Rapport détaillé : `docs/marketplace/LOT-2-MARKETPLACE-RESTAURANT-CATEGORY-OFFERS.md`

Résultat technique :

- `marketplaceRestaurantCategoryOffers` ajouté comme projection publique agrégée;
- identifiant stable `restaurantId__marketplaceCategoryId`;
- projection calculée uniquement depuis `marketplaceDishOffers` découvrables;
- suppression des projections orphelines lorsqu'une catégorie ne contient plus aucun produit découvrable;
- synchronisation automatique branchée après les triggers produit, catégorie et restaurant;
- backfill idempotent ajouté;
- vrai logo restaurant corrigé au niveau de la projection produit et de l'agrégat;
- règles Firestore et indexes ajoutés.

Limite restante :

- pas encore de `marketplaceRestaurantCards`;
- pas de page catégorie marketplace publique;
- aucun déploiement Firebase.
