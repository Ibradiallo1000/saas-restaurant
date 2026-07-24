# OORDERA - Feuille de route produit Marketplace

Date : 2026-07-23

Statut : ROADMAP PRODUIT VALIDEE - Documentation uniquement.

## Vision produit

Le marketplace Oordera est un moteur de decouverte culinaire.

Il ne doit pas fonctionner comme un simple annuaire de restaurants. Son role est d'aider le client a partir d'une envie alimentaire claire, puis a trouver rapidement les restaurants capables d'y repondre.

Exemples d'entrees utilisateur :

- Pizza
- Hamburger
- Plats africains
- Petit-dejeuner
- Boissons

La bibliotheque de menus plateforme n'est pas la source directe du marketplace. Le marketplace utilise uniquement les produits reellement publies dans les menus actifs des restaurants.

## Parcours utilisateurs valides

### Parcours categorie globale

```txt
Marketplace
-> clic sur une categorie globale
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

### Parcours restaurant

```txt
Marketplace
-> recherche ou selection d'un restaurant
-> ouverture du menu public
-> parcours menu normal
-> ajout au panier
-> commande et paiement
```

### Parcours recherche future

```txt
Marketplace
-> recherche par plat ou restaurant
-> resultats pagines
-> filtres categorie, ville, disponibilite, prix et plus tard proximite
-> ouverture directe du restaurant ou de la categorie locale correspondante
```

## Architecture des pages

### Page marketplace accueil

Role :

- presenter les categories globales;
- proposer une recherche plat/restaurant;
- mettre en avant des restaurants ou categories populaires quand les donnees seront fiables.

### Page categorie marketplace

Role :

- afficher les restaurants proposant une categorie globale;
- ne pas afficher tous les produits de tous les restaurants;
- garder une carte unique par restaurant.

Chaque carte restaurant affiche au minimum :

- nom du restaurant;
- logo ou image representative;
- ville, commune ou quartier;
- statut ouvert/ferme;
- nombre de produits disponibles dans la categorie;
- prix minimum;
- score de popularite futur.

### Page menu public restaurant

Navigation cible depuis le marketplace :

```txt
/{restaurantSlug}?category={localCategoryId}&source=marketplace
```

Comportement attendu :

- detecter `source=marketplace`;
- ignorer la couverture;
- ouvrir directement le menu;
- selectionner la categorie locale demandee;
- afficher les produits correspondants.

## Projections necessaires

### Projections a conserver

`marketplaceDishOffers`

Role :

- representer une offre produit publiee par un restaurant;
- alimenter la recherche par plat;
- conserver les donnees publiques produit/restaurant minimales.

`marketplaceFoodCategories`

Role :

- representer la taxonomie globale marketplace;
- rester distincte des categories locales restaurant.

### Projections a ajouter

`marketplaceRestaurantCards`

Role :

- representer une carte publique restaurant;
- eviter de lire directement la collection `restaurants` sur la marketplace;
- exclure tous les champs prives.

`marketplaceRestaurantCategoryOffers`

Role :

- representer un restaurant proposant une categorie globale;
- alimenter les pages categories marketplace;
- permettre la pagination, le prix minimum, le nombre de produits, l'image representative et le score futur.

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

## Localisation cible

Modele valide :

```txt
Pays
-> Ville
-> Commune
-> Quartier
-> Adresse
-> Latitude/Longitude
```

Usages futurs :

- filtrer par ville;
- afficher les restaurants proches;
- classer par distance;
- ouvrir un itineraire;
- afficher l'adresse du restaurant.

## Lots d'implementation

### Lot 0 - Stabilisation de la synchronisation

Objectif :

- garantir que les projections marketplace restent coherentes avec les menus actifs.

Statut 2026-07-23 :

- source de verite de publiabilite centralisee;
- scripts backfill/rebuild alignes sur cette source de verite;
- helpers backend reutilises par les triggers;
- Cloud Functions branchees dans `functions/src/index.ts`;
- aucun deploy Firebase execute.

### Lot 1 - Categories globales et mapping

Objectif :

- administrer `marketplaceFoodCategories`;
- relier categories locales et produits aux categories globales sans remplacer `categoryId`.

Statut 2026-07-23 :

- page Super Admin `Catégories marketplace` ajoutée;
- `marketplaceFoodCategories` stabilise `name`, `slug`, `imageUrl`, `sortOrder` et `active`;
- `restaurants/{restaurantId}/categories/{categoryId}.marketplaceCategoryId` ajouté comme mapping local optionnel;
- la bibliothèque de menus conserve le mapping lors de l'import;
- `marketplaceDishOffers` exige désormais un mapping global pour être `discoverable`;
- aucune UX publique marketplace refondue;
- `marketplaceRestaurantCategoryOffers` reste réservé au Lot 2.

### Lot 2 - Projection `marketplaceRestaurantCategoryOffers`

Objectif :

- construire la source de donnees des pages categories marketplace.

Statut 2026-07-23 :

- collection `marketplaceRestaurantCategoryOffers` ajoutee;
- projection unique par `restaurantId + marketplaceCategoryId`;
- agregation depuis `marketplaceDishOffers.discoverable == true`;
- synchronisation automatique branchee sur les triggers produit, categorie et restaurant;
- backfill idempotent ajoute;
- vrai logo restaurant resolu sans utiliser `coverImage`;
- aucune interface publique marketplace modifiee.

### Lot 3 - Projection `marketplaceRestaurantCards`

Objectif :

- remplacer progressivement la lecture directe de `restaurants` pour la marketplace.

### Lot 4 - Page categorie marketplace paginee

Objectif :

- afficher une carte par restaurant proposant la categorie globale.

### Lot 5 - Ouverture directe du menu sur la categorie

Objectif :

- supporter `/{restaurantSlug}?category={localCategoryId}&source=marketplace`;
- ignorer la couverture;
- selectionner la categorie locale.

### Lot 6 - Recherche plats/restaurants

Objectif :

- rechercher les plats et les restaurants de facon paginee et fiable.

### Lot 7 - Popularite

Objectif :

- definir et projeter un score fiable;
- ne pas dependre d'un `orderCount` non maintenu.

### Lot 8 - Localisation et proximite

Objectif :

- stabiliser les champs geographiques;
- preparer le filtrage ville et la proximite.

### Lot 9 - Refonte UX/UI finale

Objectif :

- refondre l'interface uniquement lorsque les donnees et projections sont fiables.

## Criteres GO/NO-GO

GO seulement si :

- [ ] Architecture produit figee
- [ ] Modele de localisation stabilise
- [x] Synchronisation marketplace fiable
- [x] Categories globales administrables
- [ ] Projections publiques disponibles
- [x] Projection restaurant-categorie disponible
- [ ] Tests valides
- [ ] Refonte UX autorisee

NO-GO si :

- les projections peuvent rester stale apres modification produit;
- les categories globales ne sont pas administrables;
- `marketplaceRestaurantCategoryOffers` n'existe pas;
- l'ouverture directe du menu sur categorie n'est pas fiable;
- la popularite affichee n'est pas calculee depuis des donnees reelles;
- la localisation reste une chaine libre non normalisee.

## Ordre directeur

```txt
1. Figer la feuille de route marketplace
2. Implementer la localisation structuree
3. Stabiliser la synchronisation marketplace
4. Implementer les projections necessaires
5. Refactorer le marketplace
6. Refaire l'UX/UI finale
```
