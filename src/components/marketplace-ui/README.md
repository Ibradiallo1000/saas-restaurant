# Marketplace UI

`marketplace-ui` est la couche de présentation de la Marketplace Oordera orientée plats. Elle compose les fondations de `public-ui` et ne contient ni donnée connectée, ni logique métier.

## Règles d’architecture

```text
Contrôleur Marketplace connecté (Phase 11.3+)
        ↓
View-model pur
        ↓
Contrats MarketplacePresentation
        ↓
marketplace-ui
        ↓
public-ui
```

Le module n’importe jamais Firebase, Firestore, Auth, provider, service ou mutation. Il ne recherche, ne trie, ne groupe, ne calcule et ne revalide aucune offre. Les libellés de prix, de disponibilité, de qualité et de compteur lui sont fournis déjà préparés.

## Contrats

- `MarketplaceDishPresentation` : groupe de découverte, jamais une ligne panier.
- `MarketplaceOfferPresentation` : offre réelle d’un produit par un restaurant.
- `MarketplaceRestaurantPresentation` : identité publique minimale du restaurant.
- `MarketplaceCategoryPresentation` : catégorie alimentaire publique déjà résolue.
- `MarketplaceSectionPresentation` : titre, description et mode de composition.
- `MarketplaceFilterPresentation` : filtre et état de sélection déjà décidés.
- `MarketplaceSearchPresentation` : valeur et états contrôlés de recherche.
- `MarketplaceQualityState` : `complete`, `partial`, `estimated`, `unavailable`.
- `MarketplaceDensity` : `comfortable`, `compact`.
- `MarketplaceLayoutMode` : `rail`, `grid`, `list`.

## Primitives

- `MarketplaceLayout` et `MarketplaceContainer` : canvas et largeur publique.
- `MarketplaceSearch` : composition contrôlée de `PublicSearchField`.
- `MarketplaceCategoryRail` : navigation alimentaire horizontale.
- `MarketplaceFilterList` et `MarketplaceFilterSheet` : présentation des filtres existants.
- `MarketplaceDishCard` : groupe de plat et nombre d’offres fourni.
- `MarketplaceDishGroup` : association visuelle plat/offres.
- `MarketplaceOfferCard` : offre restaurant précise.
- `MarketplaceSection` : section en rail, grille ou liste.
- `MarketplaceOfferSelector` : choix accessible d’une offre via `PublicSheet`.
- `MarketplaceFeedback` : loading, empty, error, offline, stale et unavailable.

## Garanties

- Une carte de groupe ne propose jamais un ajout direct au panier.
- Une offre ne recalcule jamais le prix ou la disponibilité.
- La qualité des données reste textuelle dans les consommateurs ; elle n’est pas déduite par la primitive.
- Les sections sans données ne créent aucun contenu fictif.
- Le responsive suit 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px.
- Les contrôles interactifs visent au moins 44 px et respectent focus visible et motion réduite.

## Exemple de composition

```tsx
<MarketplaceSection presentation={{ id: "popular", title: "Plats populaires", layout: "grid" }}>
  {dishes.map((dish) => (
    <MarketplaceDishCard key={dish.id} dish={dish} onSelect={onSelectDish} />
  ))}
</MarketplaceSection>
```

La Phase 11.2 ne raccorde aucun écran existant. L’indexation, le read model, la pagination, la recherche multi-restaurants et la navigation transactionnelle restent réservés aux phases suivantes.
