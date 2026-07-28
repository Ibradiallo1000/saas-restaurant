# Lot 2 — Référentiel Articles simplifié

## 1. Statut

**Référence :** documentation officielle Stock V2  
**Périmètre :** référentiel Articles uniquement  
**Activation :** désactivée par défaut  
**Décision :** PASS sous réserve du maintien des validations listées dans ce document

Le Lot 2 fournit un référentiel indépendant des quantités. Il ne modifie aucun flux historique et ne se connecte ni au POS, ni aux Commandes, ni à la Cuisine.

# 2. Périmètre terminé

Le lot permet :

- de créer un Article ;
- de modifier un Article actif ;
- d’archiver un Article ;
- de restaurer un Article ;
- de lister, rechercher, filtrer, trier et paginer ;
- de créer, modifier et archiver des catégories ;
- d’utiliser les unités officielles ;
- de définir des conditionnements simples ;
- de définir les seuils faible et de rupture ;
- de choisir un mode de suivi ;
- de protéger le coût de référence par permission ;
- d’activer progressivement le référentiel sans remplacer l’inventaire historique.

# 3. Modèle Article V2

Un Article contient :

- son identité ;
- son restaurant ;
- son nom ;
- une description facultative ;
- une catégorie facultative ;
- une unité de suivi ;
- des conditionnements facultatifs ;
- un seuil faible ;
- un seuil de rupture ;
- un mode de suivi ;
- un coût de référence facultatif et protégé ;
- un statut actif ou archivé ;
- ses dates et auteurs ;
- des informations facultatives de traçabilité de reprise.

Il ne contient :

- aucune quantité ;
- aucun stock initial ;
- aucun solde ;
- aucun mouvement ;
- aucune recette ;
- aucun ingrédient ;
- aucun coût par plat.

# 4. Modes de suivi officiels

| Valeur | Sens |
|---|---|
| `CONTROLLED` | Quantité vérifiée principalement par contrôle physique |
| `AUTOMATIC_SIMPLE` | Future déduction simple et explicite d’un Article |
| `NONE` | Article enregistré sans suivi quantitatif actif |

`CONTROLLED` est le mode proposé par défaut.

Le mode `AUTOMATIC_SIMPLE` ne déclenche encore aucune consommation. Son raccordement appartient au Lot 5.

# 5. Audit fichier par fichier

## 5.1 Domaine

| Fichier | Statut V2 | Décision |
|---|---|---|
| `domain/article.ts` | Partiellement conforme | Adapté : trois modes officiels, catégorie facultative, suppression du premier stock |
| `domain/units.ts` | Conforme | Conservé sans modification |
| `domain/validation.ts` | Partiellement conforme | Adapté : validation du mode, catégorie facultative, retrait du premier stock |
| `domain/errors.ts` | Conforme | Conservé sans modification |
| `domain/index.ts` | Conforme | Conservé sans modification |

## 5.2 Application

| Fichier | Statut V2 | Décision |
|---|---|---|
| `application/article-service.ts` | Partiellement conforme | Adapté au mode de suivi et aux catégories facultatives ; aucun effet quantitatif |
| `application/authorization.ts` | Conforme | Conservé ; séparation des coûts maintenue |
| `application/repositories.ts` | Conforme | Conservé ; aucun contrat de quantité |
| `application/index.ts` | Conforme | Conservé |

## 5.3 Persistance et activation

| Fichier | Statut V2 | Décision |
|---|---|---|
| `infrastructure/firestore-article-repositories.ts` | Partiellement conforme | Adapté au mode de suivi et à la catégorie facultative |
| `infrastructure/index.ts` | Conforme | Conservé |
| `feature-flag.ts` | Conforme | Conservé ; activation désactivée par défaut |
| `articles/index.ts` | Trop large | Adapté : le simulateur de reprise n’est plus exporté par l’API publique du référentiel |

## 5.4 Simulation de reprise

| Fichier | Statut V2 | Décision |
|---|---|---|
| `migration/simulate-legacy-articles.ts` | Fonction future isolée | Conservé en lecture seule ; l’ancien solde devient une observation, jamais une intention appliquable |
| `migration/index.ts` | Fonction future isolée | Conservé, mais non réexporté par le module Articles |

La simulation :

- n’écrit aucune donnée ;
- ne fusionne aucun doublon ;
- ne crée aucun Article automatiquement ;
- ne crée aucun premier stock ;
- ne modifie aucune quantité historique.

## 5.5 Interface et routes

| Fichier | Statut V2 | Décision |
|---|---|---|
| `ui/ArticleReferentialScreen.tsx` | Partiellement conforme | Adapté : trois modes, catégorie facultative, suppression de la saisie du premier stock |
| `articles/page.tsx` | Conforme | Conservé |
| `articles/new/page.tsx` | Conforme | Conservé |
| `articles/[articleId]/page.tsx` | Conforme | Conservé |
| `articles/categories/page.tsx` | Conforme | Conservé |

Les écrans restent derrière le flag du Lot 2 et n’affichent aucune quantité.

## 5.6 Intégration de sécurité et navigation

| Fichier | Statut V2 | Décision |
|---|---|---|
| `firestore.rules` — périmètre Articles V2 | Partiellement conforme | Adapté au mode officiel et à la catégorie facultative ; coût toujours séparé |
| `src/app/(manager)/layout.tsx` | Conforme | Conservé ; lien visible uniquement avec activation |
| `src/lib/guards.ts` | Conforme | Conservé |
| `src/modules/stock/core/feature-flags.ts` | Conforme | Conservé ; flag inactif par défaut |

## 5.7 Tests

| Fichier | Statut V2 | Décision |
|---|---|---|
| `article-domain.test.mjs` | Partiellement conforme | Adapté ; modes officiels, catégorie facultative et absence de premier stock |
| `article-application.test.mjs` | Conforme | Conservé ; permissions, coûts et isolation |
| `article-compatibility.test.mjs` | Partiellement conforme | Adapté ; observation legacy, règles et modes V2 |
| `article-test-kit.mjs` | Conforme | Conservé |

# 6. Éléments conservés

- séparation entre domaine, application, persistance et interface ;
- entité Article indépendante des quantités ;
- catégories propres au restaurant ;
- cinq unités officielles ;
- conditionnements simples ;
- seuils ;
- archivage et restauration ;
- recherche, filtrage et pagination ;
- coût facultatif séparé ;
- permissions par capacité ;
- isolation entre restaurants ;
- feature flag ;
- routes distinctes de l’inventaire historique ;
- tests existants utiles ;
- simulation de reprise non destructive.

# 7. Éléments simplifiés

- `trackingEnabled` est remplacé par un mode métier explicite ;
- la catégorie n’est plus obligatoire ;
- le mode Contrôlé est proposé par défaut ;
- le parcours ne demande plus de premier stock ;
- un conditionnement ne demande plus un facteur distinct de sa quantité ;
- l’ancien stock détecté par le simulateur est une observation sans effet ;
- le simulateur n’appartient plus à l’API publique du référentiel ;
- les libellés d’interface reprennent le vocabulaire V2.

# 8. Éléments reportés

Sont reportés :

- premier stock par approvisionnement ou contrôle : Lot 3 ;
- quantités et mouvements : Lot 3 ;
- pertes, corrections et historique quantitatif : Lot 3 ;
- alertes et rapports : Lot 4 ;
- déduction automatique simple effective : Lot 5 ;
- revue humaine et transition des données historiques : Lot 5.

# 9. Éléments abandonnés

Pour le MVP :

- booléen technique de suivi ;
- premier stock saisi pendant la création de l’Article ;
- intention de stock retournée par la création ;
- catégorie obligatoire ;
- export public du simulateur de migration ;
- toute préparation à une recette détaillée ou à un coût matière par plat.

Aucun fichier utile n’a été supprimé. La précédente documentation du Lot 2 reste archivée.

# 10. Garanties

1. Une création d’Article n’écrit aucune quantité.
2. Aucun repository Article ne référence les autorités historiques.
3. Aucune double écriture n’existe.
4. Aucun flux POS, Commandes ou Cuisine n’est importé.
5. Aucun Article d’un autre restaurant n’est accessible.
6. Le coût n’est chargé que pour un principal autorisé.
7. Une modification sans droit de coût conserve le coût caché.
8. Un Article archivé reste lisible mais n’est pas utilisable pour une nouvelle opération.
9. Une catégorie archivée ne peut pas être affectée à une nouvelle opération.
10. Le flag reste désactivé par défaut.

# 11. Validations

- Typecheck : PASS ;
- tests ciblés Lot 2 : 25/25 PASS ;
- tests existants : PASS ;
- build : PASS ;
- contrôle des différences : PASS ;
- aucune quantité écrite : PASS ;
- aucune recette introduite : PASS ;
- aucun flux historique modifié : PASS ;
- aucune exposition de coût sans permission : PASS ;
- isolation inter-restaurant : PASS.

# 12. Risques résiduels

## R1 — Référentiel encore désactivé

Les écrans ne sont pas disponibles par défaut. Toute activation exige une validation indépendante et ne donne aucune autorité sur les quantités.

## R2 — Simulation historique

La simulation reste disponible par import direct pour une future revue. Elle ne doit pas être exposée comme outil de migration automatique.

## R3 — Pagination

La persistance actuelle filtre et trie les Articles du restaurant avant pagination. Une optimisation pourra être nécessaire pour un très grand catalogue sans modifier le contrat métier.

## R4 — Rôles applicatifs

Le socle représente les rôles Responsable stock et Responsable achats, mais leur exposition complète dans l’application globale reste future.

## R5 — Changement d’unité

Le Lot 2 autorise encore la modification d’unité puisqu’aucun mouvement V2 n’existe. Le Lot 3 devra interdire ou encadrer ce changement dès qu’un historique quantitatif sera créé.

# 13. Conditions d’entrée du Lot 3

Le Lot 3 ne peut commencer que si :

1. les quatre documents V2 restent les références officielles ;
2. les tests du Lot 1 et du Lot 2 restent verts ;
3. le référentiel reste sans quantité ;
4. les trois modes gardent leur sens officiel ;
5. le mode automatique ne produit encore aucun effet ;
6. le coût reste séparé et protégé ;
7. le flag reste désactivé par défaut ;
8. aucune donnée historique n’est migrée automatiquement ;
9. le futur premier stock passe uniquement par un approvisionnement ou un contrôle ;
10. un plan distinct du Lot 3 est validé avant tout développement.

# 14. Décision

Le Référentiel Articles simplifié est conforme au périmètre du Lot 2 V2.

Il peut servir de base au Lot 3 après une mission et un GO explicites. Il ne doit pas être activé comme autorité de stock et ne produit actuellement aucun effet quantitatif.
