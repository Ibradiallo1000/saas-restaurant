# Rapport d’implémentation — Dashboard Owner / Gérant

## Périmètre et architecture

La Phase 3 refond uniquement la composition de `src/app/owner/page.tsx`. Les requêtes, providers, listeners, formules, permissions, routes, statuts et mutations restent inchangés.

La page conserve trois couches :

1. **Données** : hooks `useCollection`, providers restaurant/tenant/live et filtre temporel existants.
2. **View-model** : `buildBusinessDashboardData` et ses helpers existants préparent KPI, variations, alertes, stock, trésorerie, analyse, tendance, résumé et live sans changement de formule.
3. **UI** : compositions Owner alimentées par les primitives de `src/components/dashboard-ui`.

Les anciennes cartes, sections décorativement colorées, tooltips locaux de 16 px et graphiques locaux ont été retirés. Aucun second rendu Owner n’est conservé.

## Ordre final

1. Header et filtre temporel.
2. Tendance commerciale, résumé et alertes prioritaires.
3. Réserve de données partielles ou état vide éventuel.
4. Quatre KPI principaux.
5. Évolution du chiffre d’affaires et des commandes.
6. Trésorerie et stock/impact business.
7. Analyse business.
8. Activité « Maintenant ».
9. Demandes de caisse.

## Header et période

`DashboardHeader`, `DashboardToolbar` et `DashboardFilters` composent « Tableau de bord », sa description, la période exacte et le `GlobalTimeFilterBar` existant. Aujourd’hui, semaine, mois, personnalisé, les deux dates et tous leurs callbacks restent identiques.

## Synthèse et alertes

Le statut existant est présenté comme **tendance commerciale**, pas comme score global. La synthèse affiche le statut calculé, la tendance du CA, le nombre d’alertes et le résumé existant. Les trois premières alertes remontent avant les KPI avec gravité, titre, description et destination. Une situation normale reste neutre.

## Quatre KPI principaux

1. Chiffre d’affaires.
2. Commandes.
3. Panier moyen.
4. Trésorerie validée.

Les variations existantes précisent désormais « par rapport à la période précédente ». Les valeurs financières séparent montant et unité, utilisent des chiffres tabulaires et ne sont pas tronquées. Les routes existantes et la query courante sont conservées.

## Évolution

Les mêmes points et la même granularité alimentent deux `DashboardChartCard`. Aucun type de graphique ni bibliothèque n’est ajouté. Chaque graphique possède un titre, le contexte de période, un résumé accessible, une table alternative, un état loading, un état vide et une réserve `partial` éventuelle.

## Trésorerie

Un widget regroupe sans recalcul le solde validé, les dépenses, les transferts, les sessions ouvertes, les ventes non clôturées et l’anomalie existante. Le stock d’argent, les mouvements et les anomalies sont visuellement distingués.

## Stock et impact

Un widget neutre regroupe la valeur estimée du stock, le coût consommé, les pertes estimées et les produits critiques. La dépendance aux coûts renseignés est visible ; une alerte `missing_cost` existante déclenche une réserve. Aucun calcul d’inventaire ne change.

## Analyse

Produits les plus vendus, jours performants et insights existants sont conservés. Les widgets vides ne sont pas affichés et la section disparaît entièrement si aucune analyse utile n’est disponible.

## Temps réel

La section « Maintenant » conserve commandes actives, activité cuisine, retards et valeur active. Elle est identifiée comme activité immédiate dans les données chargées et ne domine pas la vue stratégique. Les mêmes listeners sont utilisés, sans ajout ni suppression.

## Demandes de caisse

`OwnerCashSessionRequests` reste un widget métier isolé. Recherche de session, création, mises à jour, timestamps, rôles, callbacks Valider/Refuser, validations et messages sont strictement conservés. Seule sa présentation utilise les primitives dashboard.

## États par domaine

- Chargement initial : `DashboardLoadingState`.
- Restaurant absent : `DashboardErrorState`.
- Période vide : `DashboardEmptyState`.
- KPI et tendances : chargement local depuis l’état existant des commandes.
- Live : chargement local depuis les états commandes/sessions.
- Demandes de caisse : état vide local.

Aucune requête supplémentaire n’est créée.

## Limite de 500 commandes

La requête conserve `limit(500)`. Lorsque 500 éléments sont reçus, le dashboard signale des données **potentiellement partielles** dans le header, une alerte, les KPI et les graphiques. Ce signal est prudent : il indique une saturation possible sans prétendre connaître le total. La correction par agrégats ou pagination reste un chantier data séparé.

## Responsive

Structure prévue pour 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px : une colonne mobile, colonnes progressives, quatre KPI lorsque l’espace le permet, montants complets, tendances sans grille fixe fragile et contenu plafonné. La recette visuelle authentifiée sur appareils réels reste à effectuer avec des données représentatives.

## Accessibilité

- Un seul H1, H2 par section.
- Focus visible sur les cartes-liens.
- Actions de caisse d’au moins 40 px.
- Suppression du tooltip local de 16 px.
- Montants complets et tabulaires.
- Alertes critiques et états annoncés.
- Graphiques nommés, résumés et assortis d’une table alternative.
- Couleur accompagnée d’un libellé, signe ou contexte.
- Compatibilité reduced motion et clair/sombre héritée des primitives.

La validation instrumentée lecteur d’écran/contraste avec thèmes extrêmes reste une recette dédiée.

## Performance

Les composants visuels locaux dupliqués sont supprimés, le calcul principal reste mémorisé avec les mêmes dépendances, et aucun cache improvisé, listener ou package n’est ajouté. Les états secondaires ne bloquent plus systématiquement les données déjà disponibles.

## Primitives utilisées

`DashboardPage`, `DashboardHeader`, `DashboardToolbar`, `DashboardFilters`, `DashboardPanel`, `DashboardSection`, `DashboardStat`, `DashboardAlert`, `DashboardAlertList`, `MetricGroup`, `MetricCard`, `MetricDelta`, `DashboardChartCard`, `DashboardChart`, `DashboardTrend`, `DashboardWidget`, `DashboardWidgetHeader`, `DashboardLoadingState`, `DashboardEmptyState` et `DashboardErrorState`.

## Éléments reportés à la Phase 4 ou à un chantier dédié

- Dashboard Manager ;
- unification des shells Owner/Manager ;
- correction data de la limite 500 ;
- décision sur l’ancien `/dashboard` ;
- agrégats serveur et fraîcheur horodatée ;
- recette visuelle authentifiée et accessibilité instrumentée.

## Non-régression métier

Collections, chemins, clauses `where`, `orderBy`, `limit`, providers, calculs, statuts, routes, permissions et mutations sont identiques. Aucun fichier Firestore/Firebase, Manager, POS, Cuisine, Rapport, Paramètre ou Administration n’est modifié par cette phase.
