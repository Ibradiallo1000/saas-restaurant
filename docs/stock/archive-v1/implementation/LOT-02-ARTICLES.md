# Lot 2 — Référentiel Articles

## 1. Statut

Le Lot 2 introduit le référentiel canonique des Articles de stock sans devenir
l’autorité des quantités.

Les flux historiques `inventoryItems` et `inventory` restent inchangés. Le nouveau
référentiel est désactivé par défaut et n’est connecté ni aux Commandes, ni au POS,
ni à la Cuisine, ni aux réceptions.

## 2. Périmètre réalisé

- entité Article ;
- catégories propres au restaurant ;
- unités de base officielles ;
- conditionnements propres à chaque Article ;
- validation des conversions ;
- création, consultation, modification, archivage et restauration ;
- recherche, tri, filtrage et pagination ;
- coût de référence facultatif et protégé ;
- intention de premier stock sans écriture de quantité ;
- repositories indépendants des modèles legacy ;
- persistance compatible avec l’infrastructure actuelle ;
- activation globale ou limitée à certains restaurants ;
- simulation de migration non destructive ;
- liste, création, fiche, modification, archivage, restauration, catégories et
  conditionnements ;
- tests de domaine, d’application, de permissions et de compatibilité.

## 3. Éléments explicitement absents

- quantité courante ;
- stock initial appliqué ;
- mouvement de stock ;
- réception ;
- comptage ;
- perte ;
- recette ;
- consommation ;
- synchronisation avec les collections legacy ;
- migration automatique ;
- suppression destructive.

Ces responsabilités appartiennent aux lots ultérieurs.

## 4. Architecture introduite

```text
src/modules/stock/articles/
├── application/
│   ├── article-service.ts
│   ├── authorization.ts
│   ├── repositories.ts
│   └── index.ts
├── domain/
│   ├── article.ts
│   ├── errors.ts
│   ├── units.ts
│   ├── validation.ts
│   └── index.ts
├── infrastructure/
│   ├── firestore-article-repositories.ts
│   └── index.ts
├── migration/
│   ├── simulate-legacy-articles.ts
│   └── index.ts
├── ui/
│   └── ArticleReferentialScreen.tsx
├── feature-flag.ts
└── index.ts
```

Le domaine ne dépend pas de l’interface ni de la persistance. Le service
d’application reçoit les repositories, l’horloge et le générateur d’identifiants
par dépendances.

## 5. Entité Article

Un Article contient :

- identifiant ;
- restaurant ;
- nom ;
- description facultative ;
- catégorie ;
- unité de base ;
- conditionnements ;
- seuil de stock faible ;
- seuil de rupture ;
- activation du suivi ;
- coût de référence facultatif ;
- statut actif ou archivé ;
- création, modification et auteurs ;
- métadonnées de migration facultatives.

Il ne contient aucun champ de quantité, stock courant, stock initial ou solde.

## 6. Catégorie

Une catégorie contient :

- identifiant ;
- restaurant ;
- nom ;
- description facultative ;
- ordre ;
- statut ;
- dates et auteurs.

Les catégories sont créées par chaque restaurant. Aucun catalogue global n’est
imposé.

Une catégorie archivée reste lisible mais ne peut pas être utilisée pour créer ou
modifier un Article. La restauration d’un Article exige également une catégorie
active.

## 7. Unités et conversions

Unités acceptées :

| Code | Libellé |
|---|---|
| `unit` | unité |
| `kg` | kilogramme |
| `g` | gramme |
| `l` | litre |
| `ml` | millilitre |

Dimensions :

- `unit` : comptage ;
- `kg`, `g` : masse ;
- `l`, `ml` : volume.

Règles :

1. une conversion reste dans la même dimension ;
2. masse/volume est interdite ;
3. unité/masse ou unité/volume est interdite ;
4. le facteur doit être explicite ;
5. le facteur doit être strictement positif ;
6. la quantité ne peut pas être négative.

Les facteurs officiels exposés sont :

- kg vers g : 1000 ;
- g vers kg : 0,001 ;
- l vers ml : 1000 ;
- ml vers l : 0,001 ;
- même unité : 1.

## 8. Conditionnements

Types supportés :

- carton ;
- pack ;
- sac ;
- bidon ;
- autre.

Chaque conditionnement porte :

- identifiant local ;
- type ;
- nom ;
- quantité ;
- unité cible ;
- facteur de conversion ;
- statut actif.

Les conditionnements sont stockés dans l’Article. Ils ne constituent pas un
référentiel global et ne peuvent pas créer de quantité.

## 9. Invariants

1. Le nom est obligatoire.
2. Le restaurant est obligatoire.
3. L’auteur est obligatoire.
4. L’unité doit appartenir au vocabulaire officiel.
5. Les seuils sont positifs ou nuls.
6. Le seuil de rupture ne dépasse pas le seuil faible.
7. Un coût absent reste absent.
8. Un coût égal à zéro reste explicitement égal à zéro.
9. Un facteur de conditionnement est strictement positif.
10. La conversion reste dans la dimension de l’unité de base.
11. Un Article archivé reste consultable.
12. Un Article archivé est refusé pour toute nouvelle opération.
13. Une catégorie archivée ne peut plus être affectée.
14. Toutes les opérations sont limitées au restaurant du principal.
15. Deux restaurants peuvent utiliser le même nom.
16. L’archivage remplace la suppression.
17. Aucun premier stock n’est persisté comme quantité.

## 10. Services d’application

Le service Article fournit :

- créer un Article ;
- modifier un Article ;
- archiver ;
- restaurer ;
- consulter ;
- lister ;
- rechercher et filtrer via la requête de liste ;
- déclarer qu’un Article est utilisable dans une nouvelle opération ;
- créer une catégorie ;
- modifier une catégorie ;
- archiver une catégorie ;
- lister les catégories.

La gestion des conditionnements est incluse dans la création et la modification de
l’Article. La validation des conversions reste un service de domaine autonome.

## 11. Permissions

Les autorisations utilisent les capacités du Lot 0.

| Action Article | Capacités requises |
|---|---|
| Consulter | `stock.items.read` |
| Créer | `stock.items.create` |
| Modifier | `stock.items.update` |
| Archiver/restaurer | `stock.items.archive` |
| Voir le coût | `stock.costs.read` |
| Modifier le coût | `stock.items.update` et `stock.costs.read` |
| Gérer les catégories | `stock.settings.manage` |
| Gérer les conditionnements | `stock.items.update` |

Le service vérifie à la fois les capacités et le restaurant.

La Cuisine peut recevoir une lecture du référentiel sans accès aux coûts. Les
Owners et Managers disposent des capacités de gestion dans la matrice actuelle.
Les futurs rôles Magasinier et Achats sont déjà représentables par les capacités du
socle.

## 12. Persistance

Trois sources dédiées sont introduites sous chaque restaurant :

- `stockItemsV2` : données de l’Article hors coût ;
- `stockItemCostsV2` : coût de référence et traçabilité associée ;
- `stockItemCategoriesV2` : catégories.

Le coût est séparé afin qu’une lecture de l’Article ne révèle jamais indirectement
le coût à un rôle non autorisé.

Les repositories ajoutent le coût au modèle métier uniquement lorsque la
permission correspondante a été vérifiée.

La liste applique recherche, catégorie, statut, tri et pagination. L’adaptateur
actuel réalise ces opérations sur le jeu isolé du restaurant ; une optimisation de
requête pourra être introduite ultérieurement sans modifier le contrat.

## 13. Règles d’accès

- toute lecture est limitée au restaurant courant ;
- les coûts utilisent une règle plus restrictive que les Articles ;
- les écritures exigent un Owner, Manager ou administrateur autorisé ;
- les champs persistés sont limités par liste blanche ;
- aucun champ de quantité n’est accepté dans le document Article ;
- `restaurantId`, auteur et date de création sont immuables après création ;
- aucune suppression d’Article ou catégorie n’est autorisée ;
- le coût peut être retiré uniquement par un rôle autorisé.

## 14. Interface

Routes ajoutées :

- `/manager/stock/articles` ;
- `/manager/stock/articles/new` ;
- `/manager/stock/articles/{articleId}` ;
- `/manager/stock/articles/categories`.

Écrans :

### Liste

- recherche ;
- filtre par catégorie ;
- filtre actif/archivé ;
- pagination ;
- coût uniquement si autorisé ;
- accès à la fiche ;
- état vide, chargement, erreur et permission refusée.

### Création

- informations générales ;
- unité ;
- seuils ;
- coût selon permission ;
- suivi actif ;
- conditionnements ;
- intention de premier stock ;
- confirmation explicite qu’aucune quantité n’est écrite.

### Fiche et modification

- consultation d’un Article actif ou archivé ;
- modification si autorisée ;
- conditionnements ;
- archivage ;
- restauration ;
- avertissement bloquant pour un Article archivé.

### Catégories

- liste ;
- création ;
- ordre ;
- archivage ;
- consultation des catégories archivées.

Les composants existants du Design System sont utilisés. Les mises en page sont
responsives.

## 15. Feature flag et compatibilité

Le flag contractuel `stock.itemsV2.enabled` est désactivé par défaut.

Configuration du parcours :

- `NEXT_PUBLIC_STOCK_ARTICLES_V2_ENABLED=true` active la capacité ;
- `NEXT_PUBLIC_STOCK_ARTICLES_V2_RESTAURANTS` peut contenir une liste de
  restaurants autorisés séparés par des virgules ;
- liste vide avec flag actif signifie activation globale ;
- flag inactif affiche un retour vers `/manager/inventory`.

Le nouvel écran possède une route distincte. L’écran historique n’est ni remplacé
ni importé par le nouveau module.

Il n’existe aucune double écriture vers `inventoryItems` ou `inventory`.

## 16. Premier stock

Le premier stock saisi à la création produit un `FirstStockIntent` contenant :

- Article ;
- restaurant ;
- quantité ;
- unité ;
- auteur ;
- date ;
- destination future : réception ou comptage.

Cette intention est retournée au demandeur mais n’est reliée à aucun mécanisme
persistant ni à aucune quantité dans le Lot 2.

## 17. Migration

L’outil de migration est exclusivement un simulateur.

Entrées possibles :

- documents `inventoryItems` ;
- documents `inventory`.

Sorties :

- candidats Article sans quantité ;
- coût facultatif ;
- intention de premier stock séparée ;
- unités legacy converties vers le vocabulaire officiel ;
- anomalies ;
- groupes de doublons.

Garanties :

- mode toujours égal à `simulation` ;
- `writesPerformed` toujours égal à zéro ;
- aucune fusion ;
- tous les candidats sont conservés ;
- doublons regroupés par nom normalisé et unité ;
- unités inconnues signalées ;
- coûts et quantités invalides signalés.

Aucun script d’application automatique n’est fourni, puisqu’aucune migration réelle
n’est nécessaire pour rendre le référentiel utilisable manuellement.

## 18. Tests

Les tests couvrent :

- création valide ;
- champs obligatoires ;
- unités invalides ;
- seuils ;
- conditionnements ;
- facteurs nuls et négatifs ;
- conversions compatibles et incompatibles ;
- coût absent et coût nul ;
- modification ;
- archivage et consultation ;
- refus d’utilisation d’un Article archivé ;
- isolation entre restaurants ;
- permissions de lecture, création et coût ;
- pagination ;
- recherche ;
- filtrage ;
- catégories ;
- premier stock sans quantité ;
- feature flag global et limité ;
- simulation de migration ;
- doublons ;
- absence de référence aux deux autorités legacy ;
- séparation des coûts dans les règles ;
- conservation du parcours historique.

## 19. Risques résiduels

### R1 — Indexation et volumétrie

La pagination actuelle est contractuelle mais l’adaptateur charge les Articles du
restaurant avant filtrage. Une pagination native optimisée sera nécessaire pour les
très gros référentiels.

### R2 — Rôles avancés

Le domaine sait représenter Magasinier et Responsable Achats, mais les profils
applicatifs actuels ne les exposent pas encore complètement.

### R3 — Catégorie utilisée puis archivée

L’archivage reste autorisé même si des Articles actifs utilisent la catégorie. Les
Articles existants restent lisibles ; une décision de validation croisée pourra être
ajoutée sans suppression.

### R4 — Intention de premier stock

Elle n’est pas persistée dans ce lot. L’interface confirme sa préparation, mais son
engagement attend obligatoirement un lot Réception ou Comptage.

### R5 — Données legacy

Le simulateur détecte les ambiguïtés mais aucune correspondance n’est validée. Une
revue humaine reste nécessaire avant toute reprise.

### R6 — Deux autorités de quantité

`inventory` et `inventoryItems` restent volontairement actives. Le Lot 2 ne réduit
pas leur divergence.

## 20. Conditions d’entrée du Lot 3

Le Lot 3 peut commencer uniquement si :

1. les tests du domaine Article restent verts ;
2. la suite globale reste verte ;
3. le référentiel reste sans quantité ;
4. aucune écriture legacy n’a été ajoutée ;
5. le flag reste désactivé par défaut ;
6. le coût reste séparé et protégé ;
7. les ambiguïtés de migration ne sont pas fusionnées ;
8. l’identité canonique Article est retenue comme référence future ;
9. le registre de mouvements du Lot 3 est conçu comme unique autorité des
   variations ;
10. aucune bascule de quantité ne commence sans plan de coexistence et de
    réconciliation validé.

## 21. Décision du Lot 2

Le référentiel Article est utilisable indépendamment du stock et respecte les
frontières prévues. Il peut être activé progressivement pour créer et administrer
des Articles sans affecter les opérations historiques.
