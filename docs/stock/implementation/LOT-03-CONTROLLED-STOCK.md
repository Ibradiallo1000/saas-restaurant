# Lot 3 — Stock contrôlé et opérations essentielles

## Statut

Implémentation isolée de la V2, protégée par activation progressive et sans remplacement du module historique.

## Périmètre livré

- quantité courante par article ;
- approvisionnement ;
- contrôle physique ;
- perte ;
- correction positive ou négative ;
- historique immuable et paginé ;
- filtrage de l’historique par article, type et période ;
- protection des actions et des coûts selon les capacités ;
- isolation stricte par restaurant ;
- prévention des soldes négatifs ;
- idempotence et détection des conflits concurrents.

Seuls les articles actifs en mode `CONTROLLED` ou `AUTOMATIC_SIMPLE` acceptent une opération. Le mode `NONE` est explicitement refusé. Ce lot n’ajoute aucune déduction automatique.

## Règles de quantité

Une opération validée écrit atomiquement un mouvement immuable et le nouveau solde. Le solde courant n’est jamais une seconde autorité indépendante : il est la projection du dernier mouvement validé.

- Approvisionnement : quantité strictement positive, ajoutée au solde.
- Contrôle physique : quantité observée positive ou nulle ; elle devient la nouvelle référence.
- Perte : quantité strictement positive, motif obligatoire, retrait sans solde négatif.
- Correction : quantité strictement positive, sens et justification obligatoires.

La quantité de création d’un article reste interdite. Le premier solde provient d’un approvisionnement ou d’un contrôle.

## Unités et conditionnements

Les unités officielles du référentiel Articles sont réutilisées. Un conditionnement d’approvisionnement est converti vers l’unité de base de l’article. Une unité d’une autre famille est refusée.

## Atomicité, concurrence et idempotence

Chaque écriture vérifie la version et la quantité précédentes. Une opération, son solde, sa clé d’idempotence et son coût facultatif sont enregistrés comme un ensemble indivisible.

Un rejeu avec la même clé et le même contenu retourne le résultat existant. Une même clé réutilisée pour un autre contenu est refusée. Une écriture fondée sur une version dépassée est refusée et doit être recommencée après rechargement.

## Coûts

Le coût d’un approvisionnement est facultatif, y compris la valeur zéro. Il est conservé séparément du journal opérationnel et n’est retourné qu’aux rôles disposant de la capacité de lecture des coûts.

## Interfaces

- `/manager/stock` : liste des articles suivis et quantité courante ;
- `/manager/stock/[articleId]` : détail et opérations récentes ;
- `/manager/stock/[articleId]/supply` : approvisionnement ;
- `/manager/stock/[articleId]/control` : contrôle physique ;
- `/manager/stock/[articleId]/loss` : perte ;
- `/manager/stock/[articleId]/correction` : correction ;
- `/manager/stock/history` et historique par article : journal des opérations.

Les écrans prévoient les états de chargement, vide, erreur, succès et accès indisponible. Ils utilisent exclusivement le Design System existant.

## Activation

Le lot est désactivé par défaut.

- activation globale : `NEXT_PUBLIC_STOCK_CONTROLLED_V2_ENABLED=true` ;
- déploiement limité : `NEXT_PUBLIC_STOCK_CONTROLLED_V2_RESTAURANTS`, liste d’identifiants séparés par des virgules.

Sans activation, aucun lien de navigation V2 n’est affiché et les écrans refusent l’usage. L’ancien module demeure inchangé.

## Hors périmètre confirmé

- aucune recette ou consommation détaillée ;
- aucune connexion au POS, aux Commandes ou à la Cuisine ;
- aucun fournisseur complet ni bon de commande ;
- aucun inventaire multi-article ;
- aucune valorisation avancée ;
- aucune alerte persistée ;
- aucune migration ou double écriture ;
- aucun remplacement du stock historique.

## Collections isolées

Le lot utilise uniquement les espaces V2 dédiés au solde courant, aux opérations immuables, aux clés d’idempotence et aux coûts d’opération. Les règles interdisent les quantités négatives, les modifications ou suppressions de l’historique et les opérations sur un article sans suivi.

## Tests

Les tests du lot couvrent les 36 scénarios obligatoires : approvisionnements, conversions, coûts, idempotence, concurrence, isolation, contrôles, pertes, corrections, historique, permissions, modes de suivi, activation, atomicité et pagination. Des contrôles dédiés vérifient également la protection des espaces de données V2.

## Risques résiduels

- les rôles applicatifs historiques sont moins fins que la matrice métier V2 ; l’activation doit rester limitée aux restaurants pilotes ;
- l’historique est paginé après lecture du périmètre V2 ; une optimisation de lecture pourra être réalisée sans changer le contrat ;
- les alertes visuelles reposent dans ce lot sur les seuils du référentiel et la quantité courante, sans moteur de notifications.

## Conditions d’entrée du lot suivant

- validations techniques du présent lot au vert ;
- pilote explicitement activé ;
- matrice de rôles du restaurant pilote vérifiée ;
- aucune connexion automatique aux ventes ;
- le Lot 4 ne doit consommer que les contrats V2 et ne doit pas écrire dans les structures historiques.
