# Platform UI

Fondations de présentation pour l’administration plateforme Oordera. Ce module est volontairement sans Firebase, Firestore, Auth, service, provider, requête, mutation ni règle de permission.

## Principes

- Le contrôleur métier reste la source de vérité pour les données, permissions, états, tris et actions.
- Le view-model fournit des contrats déjà normalisés et des callbacks autorisés.
- `platform-ui` affiche ces contrats sans calcul, jointure, filtrage, pagination ou provisionnement.
- Un état inconnu ou indisponible reste explicite. Une donnée absente n’est jamais inventée.
- Les confirmations destructrices réutilisent l’AlertDialog Settings éprouvé.
- Les tableaux reposent sur `DashboardTableContainer`; les métriques reposent sur `MetricCard`.

## API

Les exports couvrent les shells (`PlatformPage`, `PlatformHeader`, `PlatformSidebar`, `PlatformSecondaryNavigation`, `PlatformSection`), la qualité des données, les métriques, restaurants, provisionnement, offres, abonnements, facturation, médias, formulaires, utilisateurs, support, audit, monitoring, permissions, danger, confirmation et états de feedback.

Les tables sont génériques. Elles reçoivent obligatoirement leurs lignes, colonnes et clés; elles ne trient ni ne chargent rien. Les composants d’état reçoivent leur message et leur action depuis l’appelant.

## États et tokens

Les attributs `data-quality`, `data-family` et `data-state` sélectionnent les tokens Platform. Les palettes clair et sombre sont définies dans `globals.css`. Le texte accompagne toujours la couleur.

Qualité : `complete`, `partial`, `estimated`, `placeholder`, `stale`, `unavailable`, `unknown`.

Permissions : `editable`, `readOnly`, `denied`, `hidden`, `unavailable`, `unknown`.

Les autres unions exportées décrivent les états restaurant, provisioning, plan, abonnement, facturation, utilisateur, support, audit et monitoring sans imposer de valeur persistée.

## Responsive et accessibilité

Largeurs de recette : 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Cible interactive recommandée : 44 px. Les tables restent dans une région scrollable au clavier, la navigation expose `aria-current`, les chargements utilisent `role=status`, les erreurs `role=alert`, et les dialogs héritent du focus trap, d’Escape et de la restauration du focus Radix.

## Limite de la Phase 10.2

Aucun écran ne consomme encore ce module. Toute migration, connexion métier ou correction des constats d’audit appartient aux phases suivantes.

