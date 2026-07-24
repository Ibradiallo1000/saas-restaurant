# Rapport d’implémentation — Dashboard Manager / Gérant

## Périmètre

La Phase 4 refond uniquement le Dashboard réellement utilisé sous `/manager/dashboard`. Les autres modes contenus dans `ManagerClient.tsx` — catalogue, menu, produits, catégories, formulaires et commandes — conservent leurs composants, props, hooks, callbacks et rendu.

Les requêtes Firestore, providers, listeners, formules financières, statuts, permissions, routes et workflows restent inchangés.

## Architecture finale

1. **Couche données** : `ManagerDashboardPage` dans `ManagerClient.tsx` conserve tous les hooks, requêtes et providers existants.
2. **View-model** : les valeurs déjà calculées — compteurs commandes, résumé financier, inventaire, sessions et demandes — sont transmises sous forme de props.
3. **Présentation** : `ManagerDashboardView.tsx` est un composant pur, sans Firebase, Firestore, provider, permission ni calcul métier.

## Ordre final des sections

1. Header et contexte temporel.
2. Interventions prioritaires.
3. Quatre KPI « Maintenant ».
4. Commandes et activité.
5. Caisse et encaissements.
6. Stock et ruptures.

La liste générique de cinq accès rapides est supprimée car ses destinations sont déjà portées par les widgets et la navigation existante.

## Quatre KPI principaux

1. Commandes actives.
2. Commandes en retard.
3. Commandes à encaisser.
4. Solde de caisse.

Les cartes utilisent `MetricGroup` et `MetricCard`, conservent les nombres complets, la devise séparée et un focus visible. Chaque destination existante approfondit précisément la valeur.

## Alertes prioritaires

Les alertes sont construites uniquement à partir de signaux déjà disponibles :

- commandes en retard ;
- encaissements en attente ;
- ruptures ;
- validations de caisse ;
- demandes d’ouverture de caisse ;
- anomalie de solde ;
- stock faible lorsqu’aucune rupture plus grave n’est déjà affichée.

Aucun score ni seuil supplémentaire n’est créé. Les valeurs nulles ne deviennent pas des alertes rouges. Sans intervention, un état calme indique « Aucune intervention prioritaire ».

## Commandes

Le widget conserve les compteurs existants : actives, en attente, en préparation, prêtes, retards et terminées. Les cinq premiers représentent l’état opérationnel actuel. Les commandes terminées restent explicitement rattachées à la période sélectionnée. La liste détaillée reste dans `/manager/commandes`.

## Caisse et encaissements

Le widget distingue :

- encaissé aujourd’hui ;
- dépenses aujourd’hui ;
- solde de caisse ;
- état de la session ;
- demandes d’ouverture ;
- caisses à valider ;
- anomalie financière existante.

Le solde est décrit comme solde de caisse : il utilise la session ouverte lorsqu’elle existe, sinon le périmètre global déjà appliqué par le calcul historique. Il n’est pas présenté comme trésorerie globale.

## Stock

Ruptures, stock faible et valeur estimée sont regroupés dans un seul widget actionnable. Il n’existe plus simultanément deux KPI, deux alertes et un raccourci portant la même information. Le détail des produits reste dans `/manager/inventory`.

## Actions rapides

Les cinq boutons historiques Commandes, Caisse, Trésorerie, Dépenses et Inventaire sont supprimés du dashboard, sans supprimer leurs routes. Les actions restantes sont contextuelles :

- commandes dans le header seulement lorsqu’une intervention opérationnelle existe ;
- commandes dans le widget Commandes ;
- caisse dans le widget Caisse ;
- inventaire dans le widget Stock ;
- boutons « Traiter » sur les alertes réelles.

## Temporalités

- **Maintenant / en direct** : actives, pending, préparation, prêtes, retards et à encaisser issus des requêtes opérationnelles.
- **Aujourd’hui** : dépôts et dépenses calculés selon la journée métier et le fuseau du restaurant.
- **Période sélectionnée** : commandes terminées issues de la plage du filtre global.
- **Session ou global** : solde de caisse selon l’existence d’une session ouverte.

Le filtre existant reste dans le layout Manager avec les mêmes périodes, dates et callbacks. Aucune donnée live n’est artificiellement filtrée pour uniformiser l’affichage.

## États

- Erreur commandes : message utilisateur compréhensible, sans référence à la console ; les autres sources restent visibles.
- Loading activité : `DashboardLoadingState` local dans les KPI et le widget Commandes.
- Aucune intervention : `DashboardAlert` neutre.
- Stock sans valeur : `DashboardEmptyState` local.

Aucun retry ni requête supplémentaire n’est inventé.

## Design System

La présentation utilise `DashboardPage`, `DashboardHeader`, `DashboardSection`, `DashboardAlert`, `DashboardAlertList`, `DashboardErrorState`, `DashboardEmptyState`, `DashboardLoadingState`, `MetricGroup`, `MetricCard`, `DashboardWidget`, `DashboardWidgetHeader` et `DashboardStat`.

Les surfaces sont neutres. Danger, warning, positif et information sont réservés à leurs rôles sémantiques.

## Responsive

La structure est conçue pour 320, 360, 375, 390, 412, 430, 768, 1024 et 1440 px :

- une colonne mobile, urgences avant KPI ;
- grilles progressives sans troncature des montants ;
- deux colonnes secondaires uniquement à très grande largeur pour tenir compte de la sidebar ;
- quatre KPI sur une ligne uniquement lorsque la largeur réelle le permet ;
- contenu plafonné par `DashboardPage` ;
- réserves existantes pour header et navigation basse inchangées.

Une recette visuelle authentifiée avec données représentatives reste nécessaire pour une validation pixel et appareil réelle.

## Accessibilité

- H1 unique dans `DashboardHeader` et H2 par section.
- Ordre DOM identique à l’ordre visuel.
- Cartes-liens et boutons avec focus visible.
- Cibles d’action d’au moins 40 px.
- Montants complets et tabulaires.
- Temporalité textuelle sur chaque domaine.
- Alertes accompagnées de titres et descriptions, jamais couleur seule.
- Loading et erreurs annoncés par les primitives.
- Compatibilité clair/sombre, zoom et reduced motion héritée du Design System.

## Performance et protection des autres vues

- Aucun listener, requête, cache ou package ajouté.
- Les calculs `useMemo` existants sont conservés.
- Le rendu dashboard pur est extrait du fichier monolithique.
- Les anciens composants locaux uniquement utilisés par le dashboard sont supprimés.
- Aucun composant catalogue, produit, catégorie, recette ou commande n’est modifié.

## Éléments reportés

- unification complète des shells Owner/Manager ;
- refonte de la gestion détaillée des commandes ;
- Cuisine et POS ;
- Rapports et Paramètres ;
- Administration plateforme ;
- recette visuelle authentifiée et validation accessibilité instrumentée.

## Non-régression métier

Les mêmes données sont chargées, les mêmes commandes et retards sont comptés, les mêmes calculs caisse/finance et inventaire sont utilisés, et les mêmes routes/permissions restent actives. Aucun fichier Firestore, Firebase, service, règle ou autre vue métier n’est modifié.
