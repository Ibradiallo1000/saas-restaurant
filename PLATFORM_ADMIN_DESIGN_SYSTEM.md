# Design System Platform Admin Oordera

## Statut

Référence fondatrice de la Phase 10.2. Le module `src/components/platform-ui` est créé mais n’est connecté à aucun écran. Il normalise uniquement la couche de présentation de la future Administration plateforme.

## Architecture officielle

```text
Contrôleur connecté (données, permissions, mutations)
        ↓
View-model pur (libellés et contrats de présentation)
        ↓
Vue métier Platform
        ↓
src/components/platform-ui (présentation pure)
```

Les composants Platform ne doivent importer ni Firebase, Firestore, Auth, Cloudinary, service, provider ou mutation. Ils ne calculent aucun KPI, revenu, MRR, statut, permission, tri, filtre, pagination ou état de provisioning.

## Fondation visuelle

Platform UI réutilise les primitives internes validées : layout et métriques Dashboard, conteneur de tableau Dashboard, formulaire et confirmations Settings. Les tokens `--platform-*` isolent la sémantique Platform sans créer une seconde charte.

Surfaces : canvas, sidebar, panel, elevated, muted, highlight et danger. Bordures : border, divider, focus et danger. Chaque état métier est présenté par texte, fond, premier plan et bordure; la couleur n’est jamais l’unique information.

Les modes clair et sombre disposent de contrastes sémantiques dédiés pour la qualité des données et les états positifs, informatifs, d’avertissement, dangereux et neutres.

## Contrats d’état

- Qualité : complet, partiel, estimé, indicatif, ancien, indisponible, inconnu.
- Permission : modifiable, lecture seule, refusé, masqué, indisponible, inconnu.
- Restaurant : actif, inactif, suspendu, provisioning, erreur, inconnu.
- Abonnement : essai, actif, impayé, expiré, annulé, suspendu, inconnu.
- Monitoring : opérationnel, dégradé, incident, inconnu.

Les unions additionnelles couvrent provisioning, offres, facturation, utilisateurs, support et audit. Elles sont des contrats d’affichage; elles ne remplacent et ne renomment aucune valeur persistée.

## Composants officiels

- Structure : `PlatformPage`, `PlatformHeader`, `PlatformSidebar`, `PlatformSecondaryNavigation`, `PlatformSection`.
- Décision : `PlatformDataQualityBadge`, `PlatformMetricCard`, `PlatformMetricGrid`.
- Restaurants : `PlatformRestaurantTable`, `PlatformRestaurantCard`, `PlatformRestaurantDetail`, `PlatformProvisioningStatus`.
- Commercial : `PlatformPlanCard`, `PlatformPlanGrid`, `PlatformSubscriptionTable`, `PlatformSubscriptionStatus`, `PlatformBillingSummary`, `PlatformBillingTable`.
- Opérations : `PlatformMediaLibrary`, `PlatformMediaCard`, `PlatformSettingsForm`, `PlatformUserTable`, `PlatformSupportTable`, `PlatformAuditLog`, `PlatformMonitoringPanel`.
- Sécurité et feedback : `PlatformPermissionNotice`, `PlatformDangerZone`, `PlatformConfirmationDialog`, états loading/empty/error/unavailable/permission denied.

Le support est limité à une table générique de présentation afin de couvrir les demandes de contact déjà relevées par l’audit; aucune route, workflow ou action support n’est créée.

## Règles de données

Une métrique doit recevoir sa valeur et sa qualité depuis l’extérieur. Les placeholders sont explicitement marqués `placeholder`; l’absence devient `unavailable` ou `unknown`. Les tableaux reçoivent leur ordre final et ne proposent aucun tri implicite. Une action n’existe visuellement que si son callback autorisé est fourni par la couche connectée.

## Responsive

Recette obligatoire : 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Mobile : navigation secondaire scrollable, tables dans une région scrollable, cartes en grille simple. Desktop : sidebar 16 rem, grilles adaptatives et largeur de contenu plafonnée à 90 rem. Toute cible interactive vise 44 px minimum.

## Accessibilité

Hiérarchie de titres transmise explicitement, caption de tableau obligatoire, en-têtes avec `scope=col`, focus visible, `aria-current` pour la navigation active, état textuel pour chaque badge, annonces de chargement et erreur sémantiques. Les confirmations réutilisent Radix via Settings : focus trap, Escape, description et retour du focus. Le reduced motion hérite des fondations Dashboard.

## Permissions et danger

La permission reste autoritative dans le contrôleur. Platform UI affiche `readOnly`, `denied`, `unavailable` ou `unknown` sans inférer depuis un rôle. La zone dangereuse ne contient que des actions réellement raccordées. La confirmation reçoit conséquence, loading, verrou et éventuel texte de confirmation sans effectuer la mutation.

## Gouvernance

Les écrans Platform devront importer depuis l’index public. Une extension doit être générique, documentée, sans dépendance métier et réutiliser une primitive interne existante lorsqu’elle couvre le besoin. Aucun écran actuel n’est migré pendant cette phase.

## Validation de Phase 10.2

- Fondations Platform créées.
- Tokens clair/sombre ajoutés.
- API centralisée et documentée.
- Aucune connexion métier, route ou écran modifié.
- Aucune nouvelle dépendance.

Prêt pour une future phase de migration connectée, après validation explicite.
