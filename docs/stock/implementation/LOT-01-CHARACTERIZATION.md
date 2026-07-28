# Lot 1 — Caractérisation et filet de sécurité

## 1. Statut et objectif

Ce document constitue la baseline technique du module Inventaire existant avant sa
refonte. Il décrit ce que le système fait actuellement, y compris les comportements
incomplets ou incohérents. Il ne valide pas ces comportements comme architecture
cible et ne corrige aucune anomalie.

Le filet de sécurité repose sur :

- un registre exécutable des chemins de lecture et d’écriture ;
- des fixtures déterministes limitées à deux restaurants fictifs ;
- des tests des calculs de consommation existants ;
- des tests statiques des effets persistants ;
- un comparateur ancien/nouveau sans accès aux données ;
- un contrat d’observabilité désactivé par défaut et non raccordé à la production.

## 2. Autorité actuelle des quantités

### 2.1 Autorité principale

La valeur `inventoryItems.stockEstimated`, sous chaque restaurant, est l’autorité
actuelle utilisée par l’écran Inventaire, les recettes et le dashboard Owner.

Une seconde autorité legacy demeure active : `inventory.quantity`. Elle est
décrémentée lors du paiement par `OrderService` et lue par le dashboard Manager
général pour compter les stocks faibles.

Elle est modifiée directement par plusieurs chemins indépendants. Il n’existe pas de
registre unique permettant de reconstruire systématiquement cette valeur.

### 2.2 Valeurs secondaires

| Valeur | Usage observé | Autorité |
|---|---|---|
| `lastCountedStock` | Stock initial et certains comptages/corrections | Snapshot secondaire |
| `lastManualStock` | Dernière vérification manuelle et estimation des pertes Owner | Snapshot secondaire |
| `inventoryMovements` | Historique partiel des approvisionnements, ventes et vérifications | Non exhaustif |
| `inventoryLogs` | Déduplication par paiement et coûts/marges | Non exhaustif, chemin non raccordé |
| `inventoryAlerts` | Une alerte courante par article | Projection remplaçable |
| `orders.inventoryProcessed` | Protection du traitement Cuisine | Marqueur de traitement |

### 2.3 Conséquence

Le stock affiché ne peut pas être reconstruit de façon fiable depuis
`inventoryMovements`. Des variations légitimes ne créent aucun mouvement, certaines
opérations prévues ne sont jamais déclenchées et deux collections de quantités
peuvent diverger.

## 3. Cartographie des chemins d’écriture

Le registre exécutable correspondant se trouve dans
`src/modules/stock/diagnostics/legacy-stock-path-registry.ts`.

| ID | Déclencheur | Autorité actuelle | Lectures principales | Écritures principales | Effet observé | Risque |
|---|---|---|---|---|---|---|
| `inventory-item-create` | Création depuis Inventaire | `InventoryService.createInventoryItem` | Aucune quantité préalable | `inventoryItems`, `inventoryAlerts` | Crée l’article et initialise trois snapshots | P1 |
| `inventory-stock-add` | « Ajouter au stock » | `InventoryService.addInventoryStock` | Article pour alertes après écriture | `inventoryItems`, `inventoryAlerts` | Incrémente `stockEstimated`, sans mouvement | P1 |
| `inventory-stock-replace` | « Corriger stock » | `InventoryService.adjustInventoryStock` | Article pour alertes | `inventoryItems`, `inventoryAlerts` | Remplace `stockEstimated`, sans mouvement | P0 |
| `inventory-cost-update` | Modification du coût | `InventoryService.updateInventoryCost` | Article pour alertes | `inventoryItems`, `inventoryAlerts` | Remplace `costPerUnit` | P2 |
| `inventory-threshold-update` | Appel de service | `InventoryService.updateInventoryMinThreshold` | Article pour alertes | `inventoryItems`, `inventoryAlerts` | Remplace le seuil | P3 |
| `inventory-tracking-mode-update` | Changement manuel/auto | `InventoryService.updateTrackingMode` | Aucune | `inventoryItems` | Active ou bloque la consommation automatique | P1 |
| `inventory-physical-verification` | « Vérifier stock » | `InventoryService.verifyInventoryStock` | `inventoryItems` | `inventoryItems`, `inventoryMovements` | Remplace le stock et tente d’écrire l’écart signé | P0 |
| `inventory-reconciliation` | Appel de service | `InventoryService.reconcileStock` | Article pour alertes | `inventoryItems`, `inventoryAlerts` | Remplace stock et snapshot de comptage, sans mouvement | P1 |
| `inventory-consumption-statistics` | Après consommation par paiement | `InventoryService.updateConsumptionStats` | `inventoryItems` | `inventoryItems`, `inventoryAlerts` | Met à jour moyenne et cumul consommés | P2 |
| `kitchen-order-consumption` | Statut commande `preparing` | `OrderService` puis `InventoryService.handleOrderSentToKitchen` | `orders`, `products`, `inventoryItems` | `orders`, `inventoryItems`, `inventoryMovements` | Décrémente les recettes et marque la commande traitée | P0 |
| `legacy-payment-product-stock` | Paiement d’une commande | `OrderService.decrementStockForOrderItems` | `orders`, `orderItems`, `inventory` | `inventory` | Décrémente chaque document lié au produit avec plancher à zéro | P0 |
| `payment-order-consumption` | Aucun appel actif identifié | `InventoryService.handleOrderPaid` | `products`, `inventoryItems`, `inventoryLogs` | `inventoryItems`, `inventoryMovements`, `inventoryLogs`, snapshot de coût, alertes | Décrément et coûts par paiement si appelé | P0 |
| `supply-expense-reception` | Dépense de type approvisionnement | `SupplyExpenseService.createExpense` | Articles, fournisseur, compte de trésorerie, journal de dépense | Articles, mouvements, dépense, fournisseur, trésorerie, journaux | Incrémente stock, recalcule coût moyen et gère paiement/dette | P0 |
| `inventory-seed-service` | Appel explicite du service | `InventoryService.seedInventoryItems` | Aucune | `inventoryItems`, `inventoryAlerts` | Crée Poulet, Huile et Pain avec identifiants automatiques | P3 |
| `inventory-seed-script` | Script administrateur manuel | `scripts/seed-inventory-items.js` | Environnement et authentification administrateur | `inventoryItems` | Fusionne trois articles aux identifiants fixes | P1 |

### 3.1 Création et modification d’article

- La création initialise `stockEstimated`, `lastCountedStock` et
  `lastManualStock` à la même valeur normalisée.
- Les unités acceptées sont `pièce`, `kg` et `litre`.
- Une valeur initiale invalide ou négative devient zéro.
- Le coût, le seuil et le taux de perte sont stockés directement sur l’article.
- Il n’existe pas de méthode de modification générale : chaque donnée possède son
  propre chemin, sauf le nom et l’unité qui ne sont pas modifiables depuis le
  service observé.

### 3.2 Entrées et approvisionnements

Deux entrées distinctes existent :

1. l’ajout direct incrémente seulement la quantité ;
2. la dépense d’approvisionnement incrémente la quantité, crée un mouvement,
   recalcule le coût moyen pondéré et agit aussi sur la trésorerie et la dette.

Le coût moyen pondéré actuel est :

`((ancien stock × ancien coût) + (quantité reçue × coût reçu)) / nouveau stock`.

Le stock négatif historique est ramené à zéro pour ce calcul par la normalisation
positive, ce qui peut modifier implicitement la base de coût.

### 3.3 Sorties et consommation

Deux déclencheurs actifs affectent deux représentations différentes :

- le passage à `preparing` décrémente `inventoryItems` selon la recette ;
- le paiement décrémente `inventory` selon les produits liés.

Pour `inventoryItems`, la recette est calculée à partir :

- de la recette de base ;
- de la variante sélectionnée ;
- de son multiplicateur ;
- des suppléments sélectionnés ;
- de la quantité commandée.

Les articles en mode `manual` sont ignorés. Les articles absents sont également
ignorés. Le stock peut devenir négatif.

Pour `inventory`, chaque document dont `linkedProductIds` contient le produit vendu
est décrémenté de la quantité de produit, avec un plancher à zéro. Ce calcul ne
consulte aucune recette et peut donc produire une valeur différente.

### 3.4 Ajustements et comptages

- « Corriger stock » remplace la quantité sans mouvement.
- « Vérifier stock » remplace la quantité et tente de créer un mouvement
  `manual_adjustment`.
- Une vérification est refusée si la précédente date de moins de dix secondes.
- `reconcileStock` remplace la quantité et le snapshot de comptage, sans mouvement.
- Il n’existe aucun inventaire multi-lignes, brouillon, validation ou clôture.

### 3.5 Pertes, casse, annulations et remboursements

- Aucun chemin dédié de perte ou casse n’existe.
- Une correction négative peut représenter une perte, mais sans motif ni preuve.
- Les annulations et remboursements POS ne restaurent pas le stock.
- Aucun lien stock n’a été trouvé dans les transactions d’annulation et remboursement.

### 3.6 Imports et synchronisations

- L’import de bibliothèque de menus peut transporter une recette dans les produits,
  mais ne modifie pas directement les quantités.
- Le script de seed écrit directement les articles.
- Aucun autre import ou synchroniseur de quantité n’a été identifié.

## 4. Cartographie des chemins de lecture

| ID | Consommateur | Sources | Représentation |
|---|---|---|---|
| `manager-inventory` | Écran Inventaire Manager | `inventoryItems`, `inventoryLogs`, `inventoryAlerts` | Quantités, coûts, marges, jours restants et alertes |
| `legacy-manager-dashboard` | Dashboard Manager général | `inventory` | Nombre de documents dont `quantity <= threshold` |
| `manager-expenses` | Écran Dépenses | Articles, fournisseurs, dépenses, comptes | Saisie d’approvisionnement et historique financier |
| `manager-product-editor` | Menu/éditeur produit Manager | Articles, alertes, produits | Recettes, options, coût estimé et alertes |
| `owner-dashboard` | Dashboard Owner | Articles, alertes, journaux de paiement | Valeur de stock, coûts consommés, pertes estimées, criticité |
| `manager-suppliers` | Écran Fournisseurs | Fournisseurs | Soldes et paiements |
| `order-consumption` | Service Inventaire | Commandes, produits, articles, journaux | Consommation de recette et calcul de coût |

### 4.1 Calcul du stock affiché

L’écran Inventaire affiche directement `stockEstimated`. Les valeurs manquantes,
invalides ou non numériques sont présentées comme zéro par ses fonctions de
formatage.

### 4.2 Alertes

Une seule alerte documentée par article est conservée. Les contrôles sont évalués
dans cet ordre :

1. stock négatif ;
2. moins de deux jours restants ;
3. stock inférieur ou égal au seuil ;
4. coût manquant ;
5. résolution de l’alerte.

Une anomalie plus prioritaire masque donc les autres anomalies du même article.

### 4.3 Rapport Owner

- Valeur du stock : somme de `max(stockEstimated, 0) × max(costPerUnit, 0)`.
- Coût consommé : somme des lignes de `inventoryLogs` ayant un coût complet.
- Pertes estimées : écart positif entre `stockEstimated` et
  `lastManualStock`, valorisé au coût courant.
- Produits critiques : articles couverts par des alertes actives de niveau moyen
  ou élevé.

Le rapport combine donc des données temps réel et des snapshots dont les dates et
origines ne sont pas homogènes.

## 5. Collections et structures utilisées

| Source | Champs déterminants observés | Rôle actuel |
|---|---|---|
| `restaurants/{restaurantId}/inventoryItems` | `stockEstimated`, snapshots manuels, coût, seuil, mode, consommation | Autorité des quantités |
| `inventoryMovements` | article, type, quantité, référence, stocks avant/après selon chemin | Historique partiel |
| `inventoryLogs` | paiement, commande, coûts, marges, date | Déduplication paiement et rapports |
| `inventoryAlerts` | type, article, message, sévérité, résolution | Projection d’alerte unique |
| `products` | recette legacy ou composants | Source des besoins matière |
| `orders` | lignes, statut, `inventoryProcessed` | Déclencheur et déduplication Cuisine |
| `orders/{id}/costSnapshot` | coûts et marges par paiement | Snapshot financier non raccordé |
| `expenses` | type, lignes, montants, fournisseur | Document d’approvisionnement financier |
| `expenseLogs` | identifiant de dépense | Marqueur de traitement |
| `suppliers` | identité, solde | Dette fournisseur |
| `supplierPayments` | montant et fournisseur | Historique de paiement fournisseur |
| `treasuryAccounts` | solde | Source financière |
| `cashMovements` | montant, sens et référence | Historique de trésorerie |

La collection legacy `inventory` reste une autorité parallèle active : elle est
écrite lors du paiement et lue par `AnalyticsService`.

## 6. Dépendances intermodules

| Module | Information fournie au stock | Information reçue du stock |
|---|---|---|
| Commandes | Identité, produits, quantités, statut | Marqueur `inventoryProcessed` |
| Cuisine | Passage indirect au statut `preparing` | Aucun retour bloquant |
| POS | Annulations et remboursements | Aucun effet stock |
| Produits/Menu | Recettes, variantes, suppléments, prix | Articles disponibles et coût estimé |
| Dépenses | Lignes achetées, coût, fournisseur, paiement | Quantité et coût actualisés |
| Fournisseurs | Identité et dette | Dette créée par approvisionnement |
| Trésorerie | Compte et solde disponibles | Mouvement et débit lors de l’achat |
| Dashboard Manager | Aucun | `inventoryItems` et alertes dans le dashboard métier ; `inventory` dans le dashboard général |
| Dashboard Owner | Aucun | Stock valorisé, coûts, pertes estimées, criticité |

## 7. Jeux de données de référence

Les fixtures sont dans `tests/stock/fixtures/legacy-stock-fixtures.ts`.

Elles comprennent :

- deux restaurants distincts partageant volontairement le même identifiant article ;
- un article complet ;
- un produit avec recette legacy ;
- une ligne de commande ;
- un scénario de stock initial, entrée, vente et ajustement négatif.

Toutes les identités sont fictives. Aucune donnée cloud, aucun secret et aucune
donnée client ne sont utilisés.

## 8. Baseline reproductible

### 8.1 Quantités

| Restaurant | Article | Initial | Opérations | Résultat |
|---|---|---:|---|---:|
| A | Poulet | 10 | Approvisionnement `+5`, vente `-1` | 14 |
| B | Poulet | 7 | Ajustement `-2` | 5 |

### 8.2 Consommation

- Une recette de `0,5 pièce` sur une ligne commandée deux fois produit une sortie
  totale de `1 pièce`.
- Les alias legacy `itemId`, `ingredientId` et `qty` restent acceptés.
- Une variante multiplie la base et les suppléments.
- L’arithmétique flottante JavaScript n’est pas arrondie dans le calcul existant.
- Un coût manquant est traité comme zéro dans l’estimation affichée.

### 8.3 Rejeu

- Le chemin Cuisine utilise `orders.inventoryProcessed`.
- Le chemin legacy de paiement est précédé par la transition atomique du statut de
  paiement, qui refuse les statuts déjà payés ; son batch stock reste toutefois un
  effet secondaire postérieur à cette transaction.
- Le chemin paiement utilise un document `inventoryLogs/{paymentId}`.
- Le chemin dépense teste `expenseLogs/{expenseId}`, mais l’identifiant de dépense
  est créé avant chaque appel : répéter la commande fonctionnelle crée un nouvel
  identifiant et n’est donc pas dédupliqué par une clé métier externe.
- L’ajout direct et la correction n’ont aucune protection de rejeu.

## 9. Comportements caractérisés

| Comportement obligatoire | Couverture | Nature |
|---|---|---|
| Création d’article | Oui | Contrat statique du service |
| Modification d’article | Oui | Contrat statique des méthodes spécialisées |
| Initialisation de quantité | Oui | Trois snapshots caractérisés |
| Entrée directe | Oui | Incrément sans mouvement |
| Sortie | Oui | Calcul de recette et chemin Cuisine |
| Sortie legacy au paiement | Oui | Décrément produit lié avec plancher à zéro |
| Ajustement positif | Oui | Projection de baseline et remplacement caractérisé |
| Ajustement négatif | Oui | Projection de baseline et remplacement caractérisé |
| Perte/casse | Absence caractérisée | Aucun comportement dédié |
| Consommation commande | Oui | Calcul pur et déclencheur actif |
| Annulation/remboursement | Absence caractérisée | Aucun effet stock |
| Isolation restaurants | Oui | Fixtures et clés composites |
| Rejeu | Oui | Marqueurs présents et lacunes recensées |
| Stock affiché | Oui | Lecture de `stockEstimated` |
| Historique/rapport | Oui | Sources et formules statiques |
| Données anciennes/manquantes | Oui | Alias recette et coûts manquants |

Les tests statiques protègent les signatures et effets observés sans appeler les
services Firestore. Ils signaleront tout changement de comportement, mais ne
démontrent pas qu’une opération est autorisée à l’exécution par les règles.

## 10. Comportements non caractérisables en intégration isolée

### 10.1 Vérification physique

- Raison : le service écrit un mouvement de type `manual_adjustment`, alors que les
  règles autorisent seulement `supply`, `adjustment` et `sale`.
- Risque : transaction refusée et stock réel non enregistré pour un client normal.
- Fichiers concernés : service Inventaire et règles.
- Stratégie ultérieure : test d’intégration dédié sur émulateur avant toute
  migration, puis décision métier explicite dans le lot concerné.

### 10.2 Pertes et casse

- Raison : aucun service ni document métier dédié.
- Risque : pertes confondues avec corrections, absence de motif et de traçabilité.
- Fichier concerné : écran et service Inventaire.
- Stratégie ultérieure : conserver l’absence comme baseline, puis introduire le
  domaine officiel uniquement dans le lot Pertes.

### 10.3 Annulations et remboursements

- Raison : les transactions POS n’accèdent pas au stock.
- Risque : une commande consommée puis annulée reste déduite.
- Fichier concerné : service de sécurité POS.
- Stratégie ultérieure : scénarios de compensation dans le lot Consommation, après
  définition de l’événement d’engagement.

### 10.4 Consommation au paiement

- Raison : la méthode existe mais aucun appel actif n’a été identifié.
- Risque : code dormant, ou futur double décrément s’il est raccordé en plus du
  chemin Cuisine.
- Fichier concerné : service Inventaire.
- Stratégie ultérieure : conserver ce chemin inactif et comparer ses résultats en
  mode lecture seule avant toute décision de bascule.

### 10.5 Historique complet

- Raison : ajout direct, correction et réconciliation ne produisent pas tous un
  mouvement.
- Risque : stock non reconstructible et opérations inexpliquées.
- Sources concernées : articles et mouvements.
- Stratégie ultérieure : comparer la valeur courante à la somme des mouvements
  disponibles, sans considérer l’écart comme une erreur de migration automatique.

### 10.6 Suppression

- Raison : aucune suppression applicative d’article n’a été identifiée ; les règles
  la réservent au super-administrateur.
- Risque : impact des suppressions administratives non observable localement.
- Stratégie ultérieure : inclure les éléments archivés et suppressions historiques
  dans l’audit de migration du référentiel.

## 11. Risques classés P0 à P4

### P0 — Bloquant avant autorité du nouveau stock

1. Deux autorités de quantité, `inventoryItems` et `inventory`, sont actives et
   utilisent des règles de consommation différentes.
2. Plusieurs écritures directes pilotent les quantités sans registre commun.
3. Le mouvement `manual_adjustment` est incompatible avec les règles actuelles.
4. Le stock peut être décrémenté à la mise en préparation, mais n’est jamais
   compensé lors d’une annulation ou d’un remboursement.
5. Trois implémentations de consommation existent ; en raccorder la méthode paiement
   dormante à `inventoryItems` pourrait produire un double effet.
6. L’approvisionnement mêle stock, coût, dette et trésorerie dans une transaction
   unique dont l’idempotence dépend d’un identifiant nouvellement généré.

### P1 — Élevé

1. Ajouts, corrections et réconciliations ne produisent pas un historique complet.
2. Les articles manuels sont silencieusement exclus des consommations.
3. Les produits ou articles absents sont ignorés sans blocage de la commande.
4. Le script de seed écrit directement avec fusion et des identifiants différents
   de ceux du seed applicatif.
5. Les permissions d’inventaire reposent sur des capacités legacy larges.

### P2 — Important

1. Une seule alerte par article masque les anomalies secondaires.
2. Les statistiques de consommation ne sont actualisées que par le chemin paiement
   non raccordé, pas par le chemin Cuisine actif.
3. Les coûts manquants sont traités comme zéro ou exclus selon le rapport.
4. Les marges dépendent de `inventoryLogs`, qui n’est pas alimenté par le chemin
   actif Cuisine.
5. Le rapport de pertes compare deux snapshots dont la chronologie peut diverger.

### P3 — Modéré

1. Les noms et unités ne disposent pas d’un parcours de modification identifié.
2. Les unités sont limitées à trois valeurs et utilisent des libellés localisés.
3. La protection de dix secondes du comptage dépend de l’horloge du client.
4. La collection legacy `inventory` reste autorisée sans usage actif recensé.

### P4 — Faible ou documentaire

1. Des noms de collections sont parfois centralisés et parfois écrits en littéral.
2. Plusieurs formats legacy de recettes sont conservés.
3. Les avertissements de stock anormal sont des journaux console non structurés.

## 12. Stratégie de comparaison ancien/nouveau

Le comparateur `legacy-stock-comparison.ts` est pur et en lecture seule.

Entrées :

- snapshot initial par restaurant et article ;
- opérations signées munies d’un identifiant ;
- quantités observées.

Sorties :

- quantités attendues ;
- quantités obtenues ;
- écarts signés ;
- identifiants d’opération dupliqués ;
- clés observées sans origine expliquée.

Règles d’utilisation futures :

1. toujours inclure le restaurant dans la clé ;
2. ne jamais corriger automatiquement un écart ;
3. conserver les opérations dupliquées dans le rapport ;
4. distinguer absence de donnée et quantité zéro à la source ;
5. comparer sur une fenêtre temporelle figée ;
6. enregistrer la version de la recette utilisée ;
7. ne connecter cet outil à aucune écriture.

## 13. Observabilité préparée

Le contrat `legacy-stock-observation.ts` prévoit :

- origine ;
- restaurant ;
- article ;
- opération ;
- identifiant métier ;
- quantité avant ;
- quantité après ;
- différence ;
- résultat ;
- code d’erreur.

Il est désactivé par défaut, n’a aucun sink concret et n’est importé par aucun flux
de production.

Le contrat exclut les noms de clients, coordonnées, contenu de commande, moyens de
paiement, secrets, jetons et payloads complets.

## 14. Conditions d’entrée du Lot 2

Le Lot 2 peut commencer uniquement si :

1. les 23 tests de caractérisation du Lot 1 restent verts ;
2. la suite globale existante reste verte ;
3. le typecheck et le build passent ;
4. le registre des chemins est revu avant toute nouvelle écriture identifiée ;
5. aucune correction P0 n’est incorporée silencieusement au Lot 2 ;
6. le futur référentiel Article ne devient pas encore l’autorité des quantités ;
7. les identifiants restaurant et article restent présents dans toute comparaison ;
8. les données historiques manquantes sont traitées comme inconnues, pas comme zéro ;
9. les contrats du Lot 0 restent inchangés ou font l’objet d’une décision de
   gouvernance explicite ;
10. aucune activation de production n’est effectuée.

## 15. Décision du Lot 1

La caractérisation fournit un filet de sécurité suffisant pour détecter les
changements des chemins identifiés et comparer ultérieurement des quantités.

Elle ne rend pas les comportements legacy corrects. Les risques P0 doivent rester
visibles et être traités uniquement dans leurs lots métier respectifs.
