# Design System interne Oordera — Owner / Manager

## Statut

Cette documentation décrit les fondations opt-in du Design System interne. Aucun écran métier n’est migré pendant cette phase. Le point d’entrée stable est :

```tsx
import { DashboardPage, MetricCard } from "@/components/dashboard-ui"
```

Les primitives sont indépendantes de Firebase, Firestore, des permissions, de la navigation et des calculs métier.

## Architecture

| Couche | Responsabilité | Fichiers |
|---|---|---|
| Tokens CSS | Couleurs, typographie, dimensions, rayons, ombres et motion | `src/app/globals.css` |
| Constantes | Profils responsive, contrastes, cibles, palette et valeurs de recette | `dashboard-foundations.ts` |
| Layout | Page, header, section, toolbar, filtres et séparateur | `dashboard-layout.tsx` |
| Données | KPI, delta, groupe, statistique et tendance | `dashboard-metrics.tsx` |
| Widgets | Panel, widget, header/footer et action rapide | `dashboard-widget.tsx` |
| Feedback | Alertes et états empty/error/loading | `dashboard-feedback.tsx` |
| Visualisation | Cadre de graphique et carte de graphique | `dashboard-chart.tsx` |
| Tableau | Région scrollable et focusable | `dashboard-table-container.tsx` |
| Export | API publique interne unique | `index.ts` |

## Inventaire des fondations existantes

| Primitive générique | État observé | Décision Phase 2 |
|---|---|---|
| Card | Rayon générique 8 px, padding réparti entre sous-composants | Conservée ; `DashboardPanel/Widget` portent le contrat interne |
| Button | 4 hauteurs, focus générique, rayon 6–8 px | Conservé ; aucune migration |
| Badge | 4 variantes, statut parfois interactif visuellement | Conservé ; futurs badges dashboard devront rester textuels |
| Alert | Seulement default/destructive, `role=alert` systématique | Conservée ; `DashboardAlert` distingue ton et annonce urgente |
| Sheet | Radix, 4 côtés, durées 300/500 ms | Conservée ; tokens drawer préparés |
| Dialog | Radix, focus et Escape natifs, motion 200 ms | Conservé ; tokens dialog préparés |
| Tooltip | Radix disponible ; plusieurs tooltips locaux existent | Primitive générique à privilégier lors des migrations |
| Table | Structure sémantique et styles génériques | Conservée ; conteneur dashboard ajoute région et overflow |
| Tabs | Radix, focus visible | Conservés |
| Skeleton | Une seule variante `animate-pulse` | Conservé ; `DashboardLoadingState` couvre l’état annoncé |
| Spinner | Aucun composant générique officiel ; implémentations locales | `DashboardLoadingState` devient le contrat dashboard |

Doublons majeurs à traiter dans de futures phases, sans action ici : `DashboardSection` Owner/Manager, quatre familles de cartes KPI, alertes locales, graphiques Owner/Recharts, sidebars Owner/Manager et états de chargement disparates.

## Tokens officiels

### Surfaces

- `--dashboard-canvas` : arrière-plan de la zone de travail.
- `--dashboard-surface` : carte ou panneau standard.
- `--dashboard-section` : surface secondaire discrète.
- `--dashboard-elevated` : contenu flottant.

### Texte

- `--dashboard-title`, `--dashboard-subtitle`, `--dashboard-label`, `--dashboard-value`, `--dashboard-muted`.
- Les valeurs et montants utilisent `font-variant-numeric: tabular-nums` via les primitives ou `.dashboard-tabular-nums`.

### Données et graphiques

- `--data-positive`, `--data-negative`, `--data-neutral`, `--data-warning`, `--data-info`.
- Six séries : `--dashboard-chart-1` à `--dashboard-chart-6`.
- Positif/négatif exprime le sens métier, jamais uniquement une couleur. Un signe, une direction et un texte sont nécessaires.

### KPI, bordures et élévation

- KPI : `--metric-background`, `--metric-border`, `--metric-hover`.
- Bordures : `--dashboard-border`, `--dashboard-divider`.
- Ombres autorisées uniquement : `--shadow-dashboard-surface`, `--shadow-dashboard-floating`, `--shadow-dashboard-overlay`.

### Rayons

| Usage | Token | Valeur initiale |
|---|---|---:|
| Card | `--radius-dashboard-card` | 12 px |
| Widget | `--radius-dashboard-widget` | 12 px |
| Button | `--radius-dashboard-button` | 8 px |
| Input | `--radius-dashboard-input` | 8 px |
| Overlay | `--radius-dashboard-overlay` | 16 px |
| Chart | `--radius-dashboard-chart` | 8 px |

## Typographie

| Rôle | Taille / interligne | Règle |
|---|---|---|
| Display | 36 / 40 px | Exception analytique majeure |
| Page title | 28 / 34 px | Un `h1` par page |
| Section title | 18 / 24 px | `h2` ou `h3` selon structure |
| Metric value | 28 / 32 px | Gras, chiffres tabulaires, jamais tronquée |
| Metric label | 12 / 16 px | Semibold, capitales modérées |
| Description | 14 / 20 px | Information essentielle |
| Caption | 12 / 16 px | Période, fraîcheur, précision |

## Responsive

| Profil | Largeur | Gutter | Colonnes recommandées | Gap |
|---|---:|---:|---:|---:|
| Compact | 320–359 | 12 px | 1 | 8 px |
| Mobile | 360–767 | 16 px | 1 | 12 px |
| Tablet | 768–1023 | 24 px | 2 | 16 px |
| Desktop | 1024–1439 | 32 px | jusqu’à 4 | 16 px |
| Wide | ≥1440 | 32 px | jusqu’à 4 | 16 px |

Largeur maximale dashboard : 1440 px. Largeur de lecture : 960 px. Les recettes doivent couvrir 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Une migration future devra raisonner sur la largeur disponible après sidebar ; quatre colonnes ne sont jamais obligatoires si le contenu ne tient pas.

## Motion

| Usage | Durée |
|---|---:|
| Hover | 150 ms |
| Focus | 120 ms |
| Loading | 1200 ms |
| Chart | 300 ms |
| Drawer | 250 ms |
| Dialog | 200 ms |

Courbe standard : `cubic-bezier(0.2, 0, 0, 1)`. Aucune animation décorative. `prefers-reduced-motion: reduce` supprime transitions et animations non indispensables ; le feedback fonctionnel reste textuel.

## Accessibilité

- Texte normal : contraste minimal 4,5:1 ; grand texte, graphiques et focus : 3:1.
- Cible tactile : 40 px minimum absolu, 44 px recommandés.
- Les tableaux possèdent `caption`, en-têtes `th` et scopes appropriés. `DashboardTableContainer` rend la zone scrollable focusable mais ne remplace pas la sémantique du tableau.
- `DashboardChart` exige un nom et une description ; une table ou liste alternative doit être fournie pour toute donnée essentielle.
- Les tooltips complètent une information mais ne contiennent jamais l’unique libellé. Ils doivent être accessibles au clavier et au tactile.
- Dialogues et drawers utilisent les primitives Radix existantes : titre, description, focus trap, Escape et restauration du focus obligatoires.
- Le focus visible repose sur `--focus-ring`, largeur 2 px et offset 2 px.
- Les alertes non urgentes ne prennent pas `role=alert`. Utiliser `announce` seulement pour un changement qui exige une annonce immédiate.

## Catalogue des primitives

| Primitive | Usage |
|---|---|
| `DashboardPage` | Conteneur, gutters et max-width |
| `DashboardHeader` | Titre, description, meta et actions |
| `DashboardSection` | Domaine analytique avec action optionnelle |
| `MetricCard`, `MetricDelta`, `MetricGroup` | KPI et comparaison |
| `DashboardChart`, `DashboardChartCard` | Graphique accessible et surface associée |
| `DashboardAlert`, `DashboardAlertList` | Intervention et liste priorisée |
| `DashboardEmptyState`, `DashboardErrorState`, `DashboardLoadingState` | États de widget |
| `DashboardToolbar`, `DashboardFilters` | Commandes et filtres |
| `DashboardQuickAction` | Action non dupliquée par une KPI |
| `DashboardPanel` | Surface de composition libre |
| `DashboardDivider` | Séparation discrète |
| `DashboardStat`, `DashboardTrend` | Valeur compacte et tendance accessible |
| `DashboardTableContainer` | Région de tableau responsive |
| `DashboardWidget`, `DashboardWidgetHeader`, `DashboardWidgetFooter` | Composition de widget |

## Règles d’utilisation

1. Les primitives reçoivent des données déjà calculées ; aucun calcul financier, prix ou statut ne leur appartient.
2. Aucun import Firebase, Firestore, provider métier, permission ou route n’est autorisé dans `dashboard-ui`.
3. Une KPI affiche valeur, unité, période/fraîcheur et delta lorsque pertinent.
4. Ne pas rendre toute une surface cliquable sans élément natif `a` ou `button` explicite.
5. Ne pas utiliser la couleur de marque comme statut positif.
6. Ne pas multiplier les ombres, rayons ou tailles via `className` ; faire évoluer le contrat partagé si le besoin est récurrent.
7. Aucun écran existant ne doit être migré avant une phase dédiée et une recette de non-régression.

## Validation manuelle future

- Clair, sombre, couleur de marque claire et sombre.
- Navigation clavier et zoom 200 %.
- Données vides, erreurs, valeurs longues, valeurs négatives et données partielles.
- Graphiques avec alternative et sans animation en reduced motion.
- Tableaux à 320 px, sticky headers si requis par le métier, et focus visible de la région scrollable.
