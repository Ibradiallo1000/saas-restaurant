# Lot 4 — Pilotage quotidien du stock

## Statut

Implémentation terminée derrière le Feature Flag Stock V2. Le Lot 4 est strictement en lecture des données métier produites par le Lot 3.

## Fonctionnalités réalisées

- synthèse immédiate des articles suivis, ruptures, stocks faibles et contrôles attendus ;
- alertes dérivées et automatiquement recalculées ;
- liste priorisée des articles à réapprovisionner ;
- derniers approvisionnements ;
- derniers contrôles physiques ;
- derniers écarts ;
- dernières pertes ;
- recherche par nom, catégorie, mode de suivi et état ;
- huit filtres officiels ;
- chronologie simplifiée ;
- cinq rapports opérationnels simples ;
- actions quotidiennes masquées selon les permissions ;
- mise en page adaptée au téléphone.

Le pilotage ne crée aucune quantité, aucun mouvement et aucune seconde autorité. Toute information affichée provient des Articles, soldes et opérations validées de Stock V2.

## Écrans créés

### Stock aujourd’hui

Route : `/manager/stock`.

Présente les quatre indicateurs essentiels, les alertes actives, les actions autorisées, les dernières opérations ainsi que la recherche et les filtres.

### À réapprovisionner

Route : `/manager/stock/replenishment`.

Présente uniquement les articles en rupture ou sous leur seuil faible. La rupture est prioritaire. Cet écran ne crée ni commande ni automatisation d’achat.

### Chronologie

Route : `/manager/stock/timeline`.

Présente les approvisionnements, contrôles, pertes et corrections dans un langage opérationnel, du plus récent au plus ancien.

### Rapports simples

Route : `/manager/stock/reports`.

Permet de choisir un rapport et une période, sans coût matière, comptabilité ni analyse financière.

## Alertes

Trois types sont calculés :

- rupture : priorité critique ;
- seuil faible : priorité haute ;
- contrôle en retard : priorité moyenne.

Le délai proposé est de sept jours pour un article contrôlé et trente jours pour un article automatique simple. Un article jamais contrôlé est signalé. Un article sans suivi ou archivé ne produit pas d’alerte.

Les alertes sont des projections : elles ne sont pas stockées comme une nouvelle vérité. Après un approvisionnement, un contrôle ou une correction, le recalcul fait disparaître l’alerte devenue sans objet. Le contrat de rapprochement permet de qualifier l’état précédent comme résolu.

## Rapports disponibles

- état actuel du stock ;
- approvisionnements de la période ;
- pertes de la période ;
- contrôles réalisés ;
- écarts constatés.

Les rapports lisent exclusivement les opérations validées. Ils n’exposent aucun coût et ne modifient jamais le stock.

## Recherche et filtres

La recherche accepte les libellés usuels, avec ou sans accents, sur :

- nom ;
- catégorie ;
- mode de suivi ;
- état normal, faible ou rupture.

Filtres :

- tous ;
- rupture ;
- seuil faible ;
- normal ;
- `CONTROLLED` ;
- `AUTOMATIC_SIMPLE` ;
- `NONE` ;
- archivés.

## Permissions

La consultation exige la capacité de lire les quantités. Les raccourcis Approvisionner, Contrôler et Perte sont affichés uniquement lorsque l’utilisateur possède les capacités correspondantes du Lot 3.

Les coûts ne sont ni chargés ni affichés par les projections du Lot 4.

## Feature Flag

Le Lot 4 réutilise l’activation Stock V2 :

- `NEXT_PUBLIC_STOCK_CONTROLLED_V2_ENABLED` ;
- `NEXT_PUBLIC_STOCK_CONTROLLED_V2_RESTAURANTS`.

Lorsque le flag est désactivé, le nouveau tableau de bord ne charge aucune donnée V2 et l’ancien parcours reste inchangé.

## Tests

Les tests dédiés couvrent :

- ruptures ;
- seuils faibles ;
- calcul et priorité des alertes ;
- résolution après correction ;
- réapprovisionnement ;
- chronologie ;
- recherche ;
- filtres ;
- rapports et périodes ;
- permissions et confidentialité des coûts ;
- Feature Flag actif et inactif ;
- structure responsive ;
- absence de référence aux flux interdits.

La suite complète inclut également les tests de caractérisation historiques, les Lots 0 à 3 et les tests des règles de sécurité.

## Risques restants

- les délais de contrôle sont des valeurs produit communes ; des préférences par restaurant pourront être étudiées ultérieurement sans modifier le moteur de stock ;
- les projections chargent au maximum le périmètre courant prévu pour le pilote ; une stratégie de lecture par pages sera nécessaire pour les restaurants dépassant cent articles ou opérations consultées ;
- les alertes résolues ne constituent pas un journal persistant : seul le fait métier qui les a résolues demeure dans l’historique officiel ;
- une validation terrain sur téléphone reste nécessaire avant activation élargie.

## Conditions d’entrée du Lot 5

- toutes les validations du Lot 4 sont au vert ;
- le tableau de bord a été vérifié avec un restaurant pilote ;
- les permissions réelles du pilote ont été validées ;
- aucune divergence n’existe entre rapports et opérations du Lot 3 ;
- le Feature Flag reste limité au pilote ;
- toute future déduction automatique reste explicite, unitaire et indépendante des recettes ;
- aucune connexion POS, Cuisine ou Commandes ne peut être entreprise sans mission séparée.
