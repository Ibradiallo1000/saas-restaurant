# Lot 5 — Automatique simple et transition vers une autorité unique

## Statut

Implémentation du dernier lot du MVP Stock V2. L’activation reste désactivée par défaut et aucun déploiement n’est réalisé.

## Périmètre réalisé

- associations Produit–Article simples ;
- déduction d’articles `AUTOMATIC_SIMPLE` sur paiement confirmé ;
- idempotence par commande, association et article ;
- compensation explicite et traçable ;
- anomalie non bloquante lorsque le stock est insuffisant ;
- historique enrichi ;
- permissions dédiées ;
- activation par restaurant et par article ;
- comparaison en lecture seule entre les deux autorités historiques et Stock V2 ;
- écrans de gestion des associations et de simulation de transition.

Aucune recette, nomenclature, consommation en grammes par plat ou calcul de coût matière n’est introduit.

## Associations Produit–Article

Une association contient le restaurant, le produit, l’article, une quantité simple, l’unité, un statut et sa traçabilité.

Une association est acceptée seulement si :

- le produit existe dans le même restaurant ;
- l’article existe dans le même restaurant ;
- l’article est actif ;
- l’article est en mode `AUTOMATIC_SIMPLE` ;
- l’unité correspond à l’unité de base ;
- la quantité est strictement positive.

L’identifiant stable associe un produit et un article. Une désactivation conserve l’association dans l’historique.

## Événement de déclenchement retenu

Le point unique est la transition du document Commande d’un paiement non confirmé vers un statut confirmé :

- `paid` ;
- `paye` ;
- `verified` ;
- `validated`.

Cette transition est observée à un seul emplacement côté serveur, indépendamment de l’interface ayant confirmé le paiement. Elle est retenue car le projet possède plusieurs interfaces qui écrivent le statut de paiement, alors qu’aucune fonction cliente unique ne couvre tous les parcours.

Sont rejetés :

- création et consultation ;
- brouillon ;
- paiement en attente ;
- paiement échoué ;
- changement Cuisine vers « en préparation » ;
- annulation antérieure à la confirmation ;
- nouvelle écriture d’un statut déjà confirmé.

La clé stable est construite avec la commande et l’association. Un rejeu du même événement retrouve l’écriture existante.

## Déduction automatique

La quantité vendue multiplie la quantité simple de l’association. Pour chaque article :

1. l’association active est relue ;
2. le mode et l’état de l’article sont vérifiés ;
3. le solde V2 et la clé d’idempotence sont lus ;
4. une opération `AUTOMATIC_DEDUCTION` et le nouveau solde sont écrits atomiquement ;
5. la quantité avant, la variation, la quantité après, le produit et la commande sont conservés.

Les articles `CONTROLLED`, `NONE`, archivés ou hors périmètre pilote sont ignorés ou signalés, sans déduction.

## Compensation

L’opération initiale n’est jamais modifiée ni supprimée. Une compensation produit `AUTOMATIC_COMPENSATION`, restaure la quantité et contient l’identifiant de la déduction initiale.

La compensation automatique n’est pas reliée à une annulation globale dans ce lot : l’audit confirme que les annulations et remboursements existants ne constituent pas encore un événement central et fiable. Inventer ce branchement créerait un risque de double restauration.

La compensation est donc explicite, réservée aux utilisateurs autorisés et idempotente. À défaut, une correction manuelle autorisée reste disponible.

## Stock insuffisant

Une vente confirmée n’est jamais bloquée.

Si le solde V2 est insuffisant :

- aucune quantité négative n’est créée ;
- aucune déduction partielle n’est appliquée à l’article concerné ;
- une anomalie `INSUFFICIENT_STOCK` est enregistrée ;
- le responsable doit effectuer un contrôle ou une correction.

## Idempotence et concurrence

- identifiant stable dérivé de la commande et de l’association ;
- vérification de la clé avant écriture ;
- transaction atomique par article ;
- version du solde incrémentée ;
- rejeu sans second effet ;
- compensation identifiée par l’opération initiale.

Un produit associé à plusieurs articles produit une transaction indépendante par article. Après une interruption, un rejeu complète les articles manquants et ignore ceux déjà traités.

## Permissions

Les capacités sont distinguées pour :

- consulter les associations ;
- créer, modifier et désactiver ;
- consulter l’historique ;
- compenser.

Les coûts ne sont jamais chargés par le moteur automatique ni par les écrans de ce lot.

## Règles Firestore

Les règles ajoutées :

- isolent les associations par restaurant ;
- vérifient produit, article, mode, état, unité et quantité ;
- interdisent la suppression ;
- rendent les anomalies non inscriptibles depuis le client ;
- acceptent les deux nouveaux types d’opération uniquement sur un article automatique simple ;
- maintiennent l’immutabilité de l’historique et la séparation des coûts.

Le déclencheur serveur utilise une transaction privilégiée, mais applique les mêmes validations métier.

## Activation progressive

Deux ensembles de variables existent, pour l’interface et le déclencheur serveur :

- activation globale ;
- restaurants pilotes ;
- articles sélectionnés.

L’activation d’un article exige :

- un article actif `AUTOMATIC_SIMPLE` ;
- un solde V2 existant ;
- au moins une association active ;
- aucune association ambiguë ;
- présence dans le restaurant et la liste d’articles pilotes.

## Comparaison ancien/V2

L’écran `/manager/stock/transition` lit :

- `inventory.quantity` ;
- `inventoryItems.stockEstimated` ;
- les soldes Stock V2.

Il produit uniquement :

- correspondances ;
- divergences ;
- doublons ;
- éléments non associés.

Aucune donnée n’est modifiée, fusionnée ou migrée. Les éléments d’un autre restaurant sont exclus.

## Stratégie de retour arrière

1. désactiver le Feature Flag serveur ;
2. désactiver le Feature Flag d’interface ;
3. conserver les opérations V2 déjà produites ;
4. ne supprimer aucune association ni aucun historique ;
5. réaliser un contrôle physique avant une nouvelle activation.

La désactivation arrête les nouvelles déductions V2 sans bloquer les ventes.

## Tests

Quarante scénarios dédiés couvrent associations, compatibilité, isolation, quantités, déductions, idempotence, événements ignorés, compensations, stock insuffisant, permissions, historique, comparaison, activation, rollback, absence de double écriture et règles de sécurité.

La suite globale conserve les tests historiques et les Lots 0 à 4.

## Risques résiduels

- avant activation d’un article, l’équipe doit vérifier que son ancien lien de déduction est retiré du périmètre opérationnel afin d’éviter deux autorités actives ;
- la compensation automatique attend un futur événement central d’annulation explicitement validé ;
- une commande contenant plusieurs associations est atomique par article, pas comme groupe global ; le rejeu idempotent assure la convergence ;
- la comparaison de `inventoryItems` reste non associée lorsqu’aucune correspondance explicite n’existe ;
- l’activation nécessite une validation pilote et un contrôle physique initial.

## État final du MVP Stock

Le MVP couvre :

- articles contrôlés, automatiques simples et non suivis ;
- approvisionnements ;
- contrôles ;
- pertes et corrections ;
- alertes et réapprovisionnement ;
- rapports opérationnels ;
- associations simples ;
- déductions sur paiement confirmé ;
- compensations explicites ;
- comparaison non destructive ;
- activation et retour arrière progressifs.

Les anciennes collections sont conservées. Aucune migration automatique ni aucun déploiement n’est effectué.
