# Design System — Marketplace Oordera orientée plats

## Statut

Référence de présentation préparée en Phase 11.2. Aucun écran public n’est migré et aucune source de données n’est raccordée dans cette phase.

## Principe

La Marketplace aide d’abord l’utilisateur à choisir quoi manger. Elle distingue strictement :

1. le **plat de découverte**, qui peut représenter plusieurs offres ;
2. l’**offre restaurant**, qui référence un produit précis ;
3. le **menu restaurant**, qui reste la source transactionnelle avant configuration et panier.

`marketplace-ui` étend `public-ui` sans créer un Design System parallèle. Boutons, prix, surfaces, badges, recherche, sheets, focus, typographie et motion proviennent des fondations publiques.

## Architecture

Les futurs contrôleurs connectés fourniront des view-models purs. `marketplace-ui` reçoit exclusivement des contrats de présentation. Il lui est interdit d’importer Firebase, Firestore, un provider, un service ou une mutation, et d’effectuer recherche, agrégation, normalisation, calcul de prix ou décision de disponibilité.

## Hiérarchie officielle

1. Header public.
2. Recherche alimentaire.
3. Catégories alimentaires.
4. Plats populaires lorsque la qualité le permet.
5. Nouveautés lorsque la date est fiable.
6. Offres lorsque la promotion existe réellement.
7. Restaurants partenaires.
8. Accès à tous les restaurants.

Une section sans données réelles est absente ou reçoit un état explicite. Aucun contenu promotionnel, score, délai, avis ou compteur n’est inventé.

## Contrats officiels

Les contrats exportés sont `MarketplaceDishPresentation`, `MarketplaceOfferPresentation`, `MarketplaceRestaurantPresentation`, `MarketplaceCategoryPresentation`, `MarketplaceSectionPresentation`, `MarketplaceFilterPresentation`, `MarketplaceSearchPresentation`, `MarketplaceQualityState`, `MarketplaceDensity` et `MarketplaceLayoutMode`.

Les prix et compteurs sont des libellés déjà préparés. L’absence d’une valeur se traduit par son absence visuelle, pas par une estimation locale.

## Grille et responsive

- conteneur maximum : 1200 px via le token public marketing ;
- gutter : 12 px en compact, 16 px en mobile, 24 px dès 640 px, 32 px dès 1024 px ;
- grille : une colonne en mobile, deux dès 640 px, trois dès 1024 px ;
- rails : scroll horizontal borné, snap non bloquant et contenu utilisable au clavier ;
- listes : une colonne afin de protéger les informations d’offre ;
- sheet : shell `PublicSheet`, safe area et largeur publique existante.

Viewports de recette : 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px.

## Surfaces et bordures

Les tokens `--marketplace-surface-*` et `--marketplace-border-*` sont des alias sémantiques des fondations publiques. Ils garantissent les modes clair et sombre sans modifier les écrans existants. Les médias absents emploient une surface neutre de dimensions stables.

## Catégories alimentaires

Les couleurs de catégories sont des accents optionnels : pizza, burger, poulet, grillades, dessert et boisson. Le libellé reste obligatoire et l’état actif utilise aussi bordure et fond. Une catégorie métier ne doit être déduite ni de la couleur ni du nom par une primitive.

## Qualité des données

- `complete` : source complète selon son contrat ;
- `partial` : informations réelles mais incomplètes ;
- `estimated` : valeur explicitement qualifiée par la source ;
- `unavailable` : source indisponible.

La qualité est fournie par le futur contrôleur. Les composants ne la calculent pas. Les tokens de qualité ne doivent jamais être l’unique moyen de transmettre l’état.

## Recherche et filtres

`MarketplaceSearch` reste contrôlé. Le futur moteur est responsable de la saisie, des suggestions, du debounce, de l’annulation, des résultats et des erreurs. `MarketplaceFilterList` reçoit des filtres déjà disponibles et sélectionnés ; aucun filtre n’est généré depuis des données absentes.

Sur mobile, les filtres complexes utilisent `MarketplaceFilterSheet`. Sur desktop, la même liste peut être affichée inline. Les états de sélection utilisent `aria-pressed`.

## Cartes et sélection d’offre

`MarketplaceDishCard` représente un groupe de découverte. Elle ne permet jamais l’ajout direct au panier. `MarketplaceOfferCard` représente une offre réelle et affiche uniquement les informations fournies. `MarketplaceOfferSelector` compose `PublicSheet` et délègue la navigation au callback du contrôleur.

Le prix, la disponibilité et le restaurant devront être revalidés par le futur parcours connecté avant tout acte transactionnel.

## Accessibilité

- H1/H2/H3 fournis par la page et les sections ;
- recherche labellisée et région de recherche sémantique ;
- états de filtres et catégories annoncés ;
- boutons nommés et cibles de 44 px ;
- focus visible avec `--focus-ring` ;
- `PublicSheet` pour focus trap, Escape et restauration du focus ;
- feedback loading via `role="status"`, erreur via la primitive publique ;
- zoom 200 % préparé, contenu non dépendant de la couleur ;
- animations supprimées avec `prefers-reduced-motion`.

## Motion

Les durées Marketplace référencent les tokens publics : micro-interaction 150 ms, transition standard 200 ms et overlay 250 ms. La classe `marketplace-reduced-motion` neutralise animation, transition et smooth scroll lorsque l’utilisateur demande une motion réduite.

## États

Les états officiels sont loading, empty, error, offline, stale et unavailable. Ils restent distincts. Une donnée périmée n’est pas présentée comme fraîche ; un zéro résultat n’est pas présenté comme une panne.

## Interdictions

- aucun accès Firebase/Firestore ;
- aucune recherche, requête, pagination ou listener ;
- aucun timer ou effet métier ;
- aucun calcul de prix, promotion, note, popularité ou disponibilité ;
- aucun panier multi-restaurant ;
- aucune dépendance supplémentaire ;
- aucune migration des écrans existants en Phase 11.2.

## Préparation de la Phase 11.3

Le module est prêt à recevoir un read model via des contrats de présentation. La Phase 11.3 restera responsable de l’identité des plats, de la projection publique, de la sécurité, de l’indexation, de la synchronisation, de la pagination et de la qualité des données.
