# Design System interne — Reports & Analytics Oordera

## Statut

Ce document définit les fondations de présentation créées en Phase 8.2. Elles sont disponibles depuis `@/components/reports-ui`. Aucun écran Owner, Manager, POS ou historique n’est migré pendant cette phase.

## Architecture

| Fichier | Responsabilité |
|---|---|
| `reports-foundations.ts` | Contrats UI, profils, palette et constantes héritées |
| `reports-layout.tsx` | Page, header et périmètre contrôlé |
| `reports-period.tsx` | Périodes prédéfinies et intervalle personnalisé contrôlés |
| `reports-summary.tsx` | KPI, comparaison, qualité et fraîcheur |
| `reports-chart.tsx` | Surface de graphique, légende, résumé et alternative |
| `reports-table.tsx` | Table sémantique et tri contrôlé |
| `reports-insight.tsx` | Insights déjà calculés |
| `reports-export.tsx` | Menu visuel uniquement quand des callbacks existent |
| `reports-feedback.tsx` | Loading, empty, error, partial, estimated, stale et unavailable |
| `reports-compositions.tsx` | Rapports session, stock, produit et paiement |
| `index.ts` | Point d’entrée public unique |

## Principes

1. La couche UI reçoit des valeurs déjà calculées et formatées.
2. La qualité, la fraîcheur, la période et le périmètre sont visibles et explicites.
3. Une couleur, une flèche ou une forme ne porte jamais seule le sens.
4. Un graphique essentiel possède un nom, une description et une alternative tabulaire.
5. Le tri, la pagination, l’export et les filtres restent contrôlés par le consommateur.
6. Les primitives Dashboard sont réutilisées avant toute nouvelle structure.
7. Aucun accès aux données, permission, mutation ou calcul métier n’est autorisé.

## Contrats officiels

| Dimension | Valeurs |
|---|---|
| Qualité | `complete`, `partial`, `estimated`, `stale`, `unavailable`, `unknown` |
| Fraîcheur | `live`, `recent`, `delayed`, `historical`, `unknown` |
| Comparaison | `positive`, `negative`, `neutral`, `unavailable` |
| État métrique | `ready`, `loading`, `empty`, `error`, `unavailable` |
| Graphique | `line`, `bar`, `area`, `donut`, `pie`, `composed`, `other` |
| Sévérité insight | `info`, `positive`, `warning`, `critical` |
| Densité | `comfortable`, `compact` |

Ces contrats sont des view-models de présentation. Ils ne remplacent aucun statut ni champ stocké.

## Tokens

### Surfaces et structure

- `--reports-canvas`, `--reports-panel`, `--reports-chart`, `--reports-table`, `--reports-muted`, `--reports-highlight` ;
- `--reports-border`, `--reports-divider`, `--reports-focus`.

Tous héritent des tokens Dashboard et suivent automatiquement les modes clair/sombre. Aucun nouveau rayon, aucune nouvelle ombre et aucune typographie concurrente n’est introduit.

### Données

- qualité : paires `--reports-quality-{complete|partial|estimated|stale|unavailable|unknown}-{bg|fg}` ;
- comparaison : `--reports-comparison-positive`, `negative`, `neutral` ;
- fraîcheur : `--reports-freshness-live`, `recent`, `delayed`, `historical`, `unknown` ;
- graphiques : les six `--dashboard-chart-*` via `REPORTS_CHART_COLORS`.

## Composants

- `ReportsPage`, `ReportsHeader`, `ReportsPeriodFilter`, `ReportsScopeSelector` ;
- `ReportsSummary`, `ReportMetricCard`, `ReportsMetricDelta` ;
- `DataQualityBadge`, `FreshnessIndicator` ;
- `ReportsChartCard`, `ReportsChartLegend`, `ReportsChartSummary` ;
- `ReportsTable`, `ReportsTableToolbar` ;
- `ReportsInsightList`, `ReportsExportMenu` ;
- états Reports ;
- `ReportsSessionSummary`, `ReportsStockSummary`, `ReportsProductSummary`, `ReportsPaymentSummary`.

`ReportsSessionSummary` compose le contrat POS existant. Les trois autres résumés sont des surfaces de slots : ils n’inventent aucune formule.

## Responsive

Le module hérite de la grille Dashboard : une colonne sur compact/mobile, deux colonnes possibles sur tablette, jusqu’à quatre KPI sur desktop selon la largeur utile, contenu plafonné à 1440 px. Les tables disposent d’une région horizontalement scrollable. Les contrôles de période et périmètre défilent sans casser la page.

Recette obligatoire : 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px, puis zoom 200 %.

## Accessibilité

- un H1 par page et hiérarchie de sections cohérente ;
- cibles de 40 px minimum, 44 px recommandées ;
- contraste 4,5:1 pour le texte normal et 3:1 pour grands textes, graphiques et focus ;
- tables avec `caption`, `th`, `scope` et `aria-sort` ;
- graphiques nommés et décrits, avec alternative textuelle/tabulaire ;
- montants complets et chiffres tabulaires ;
- états et qualité exprimés textuellement ;
- focus visible officiel et navigation clavier ;
- reduced motion hérité et appliqué au shell Reports.

## Interdictions

- importer Firebase, Firestore, providers, services, permissions ou routes ;
- agréger, trier, paginer, filtrer ou calculer dans une primitive ;
- déclencher un export sans callback explicite ;
- inventer une donnée, une comparaison ou un niveau de qualité ;
- migrer un écran avant sa phase dédiée ;
- dupliquer les primitives Dashboard ou POS existantes.

## Validation future des migrations

Chaque écran consommateur devra prouver : conservation des requêtes et formules, équivalence des valeurs, représentation des données partielles/indisponibles, navigation clavier, clair/sombre, reduced motion et recette multi-viewport. La Phase 8.2 prépare le langage commun ; elle ne valide pas encore ces écrans.

