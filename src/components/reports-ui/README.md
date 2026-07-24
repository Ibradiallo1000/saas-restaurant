# Reports UI

`@/components/reports-ui` est la couche de présentation officielle des rapports et analytics internes Oordera. Elle compose `dashboard-ui` et, pour le rapport de session, `PosSessionReport`. Elle ne charge, ne transforme, ne trie et n’agrège aucune donnée.

## Règles d’intégration

- Construire les view-models dans l’écran consommateur, à partir des données déjà autorisées et calculées.
- Fournir explicitement qualité (`ReportDataQuality`) et fraîcheur (`ReportDataFreshness`) lorsqu’elles sont connues.
- Garder période, périmètre, tri et export contrôlés par le parent.
- Fournir un `caption` à chaque table et une description plus une alternative tabulaire à chaque graphique essentiel.
- Ne jamais importer Firebase, Firestore, un provider, un service, une permission ou une route dans ce module.
- Ne jamais calculer chiffre d’affaires, marge, stock, variation, pourcentage, durée ou agrégat dans une primitive.

## Composition recommandée

1. `ReportsPage` et `ReportsHeader`.
2. `ReportsPeriodFilter`, puis éventuellement `ReportsScopeSelector`.
3. `ReportsSummary` avec `ReportMetricCard` et `ReportsMetricDelta`.
4. `ReportsChartCard` avec légende, résumé textuel et table alternative.
5. `ReportsTable` pour le détail.
6. `ReportsInsightList` pour les constats déjà produits par le métier.
7. `ReportsExportMenu` seulement si de vrais callbacks d’export sont fournis.

## États de données

Les états `complete`, `partial`, `estimated`, `stale`, `unavailable` et `unknown` sont textuels. La couleur ne constitue jamais l’unique information. `ReportsLoadingState`, `ReportsEmptyState`, `ReportsErrorState`, `ReportsPartialState`, `ReportsEstimatedState`, `ReportsStaleState` et `ReportsUnavailableState` réutilisent les contrats Dashboard.

## Responsive et accessibilité

Les profils, gutters, largeurs, cibles tactiles, contrastes, couleurs de séries et durées héritent de `dashboard-ui`. La recette officielle couvre 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px. Les montants utilisent des chiffres tabulaires et ne doivent pas être tronqués. Le tri de table expose `aria-sort`; période, périmètre et exports restent accessibles au clavier. `prefers-reduced-motion` est appliqué par `ReportsPage`.

## Limite de la Phase 8.2

Aucun Dashboard Owner/Manager, écran POS ou rapport historique n’est migré. Les consommateurs seront raccordés dans une phase ultérieure dédiée.

