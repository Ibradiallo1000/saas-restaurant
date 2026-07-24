# Marketplace Discovery — Read Model public des plats

## 1. Statut et décision

La Phase 11.3 retient pour le MVP **l’Option A : une collection Firestore dédiée** nommée `marketplaceDishOffers`. Elle est simple, compatible avec l’infrastructure existante, paginable, reconstruisible et suffisante pour 100 à 1 000 restaurants lorsque les requêtes sont bornées.

L’Option B — Algolia, Typesense ou Meilisearch — est rejetée pour le MVP : elle ajouterait fournisseur, coût, secrets, synchronisation et exploitation alors que la recherche initiale peut accepter un préfixe normalisé limité. L’Option C hybride reste la cible d’évolution si les mesures réelles démontrent un besoin de tolérance aux fautes, synonymes, facettes avancées ou classement éditorial.

Aucun moteur externe, aucune dépendance et aucun déploiement ne sont introduits.

## 2. Sources auditées

| Source | Champs publics candidats | Fiabilité observée | Champs exclus |
|---|---|---|---|
| `restaurants/{id}` | nom, slug, statut, logo, localisation publique, devise, services, cuisines | nom/slug/statut nécessaires ; aliases legacy pour logo/localisation | email, téléphone interne, owner, abonnement, paiement, personnel |
| `restaurants/{id}/products/{id}` | nom, description, image, catégorie, prix/basePrice, variantes, activité, dates, orderCount | schémas hétérogènes ; prix et dates parfois absents | coût, marge, stock, recette, fournisseurs, production |
| `restaurants/{id}/categories/{id}` | nom, identifiant, lien Marketplace explicite éventuel | catégorie locale, jamais globale par défaut | données internes sans utilité publique |
| bibliothèque globale | modèle, catégorie de modèle, image, basePrice | lien au produit non garanti ; recettes/composants présents | recette, composants, audit et auteurs |
| paramètres plateforme | aucun champ requis au MVP | aucun flag Marketplace existant | secrets, branding interne, support |
| statistiques produit | `orderCount` seulement lorsqu’il existe | sémantique et couverture incomplètes | statistiques privées et scores inventés |

Les types existants sont partiels et divergent entre `src/types.ts`, `src/modules/restaurant/types.ts`, les formulaires Manager et la bibliothèque. Le mapper accepte donc des sources inconnues, valide chaque valeur et ne propage que la liste blanche.

## 3. Schéma versionné

Collection : `marketplaceDishOffers/{restaurantId__productId}`.

`schemaVersion` vaut `1`. L’identifiant déterministe garantit upsert, idempotence et absence de doublon pour un couple restaurant/produit.

### Liste blanche complète

| Groupe | Champs |
|---|---|
| Identité | `schemaVersion`, `restaurantId`, `restaurantSlug`, `productId`, `categoryId`, `marketplaceCategoryId`, `sourceTemplateId` |
| Plat | `name`, `normalizedName`, `searchTokens`, `description`, `imageUrl`, `imageAlt`, `currency`, `displayPrice`, `priceMode`, `hasConfigurator` |
| Restaurant | `restaurantName`, `restaurantLogoUrl`, `restaurantLocation`, `restaurantServices`, `restaurantCuisineTypes` |
| Disponibilité | `restaurantActive`, `productActive`, `discoverable` |
| Classement/diagnostic | `orderCount`, `createdAt`, `sourceUpdatedAt`, `projectedAt`, `quality` |

Le test de liste blanche échoue si un champ supplémentaire est produit. Les champs interdits couvrent notamment coûts, marges, stocks, recettes, ingrédients internes, fournisseurs, owners, utilisateurs, emails, téléphones, paiement, secrets, tokens, permissions et logs.

## 4. Prix de découverte

Le mapper cherche la première valeur positive parmi `basePrice`, `price` et `unitPrice`, puis compare les prix positifs de `sizes` et `variants`.

- `exact` : prix positif et aucun configurateur détecté ;
- `from` : options, groupes liés, tailles ou variantes présents, avec minimum réel disponible ;
- `unavailable` : aucune valeur positive fiable ; `displayPrice` vaut `null`, jamais zéro.

`hasConfigurator` est uniquement un indicateur de présentation. Les options ne sont jamais recalculées dans la projection. Le menu/configurateur existant doit revalider produit, activité, options, disponibilité et prix avant ajout au panier.

## 5. Taxonomie

La collection prévue est `marketplaceFoodCategories/{categoryId}` avec : `schemaVersion`, `name`, `slug`, `normalizedName`, `icon`, `imageUrl`, `sortOrder`, `active`, `aliases`.

Aucune catégorie n’est créée ou déduite dans cette phase. Le rattachement accepte, par ordre de confiance :

1. `marketplaceCategoryId` explicite sur le produit ;
2. lien explicite porté par une catégorie ou un modèle réellement associé ;
3. mapping administré futur ;
4. `null`, interprété comme non classé.

Le nom d’une catégorie locale ne provoque jamais une fusion silencieuse.

## 6. Identité des plats

Le MVP choisit **les offres individuelles**. Chaque produit restaurant reste une offre distincte. `normalizedName` sert à rechercher et trier, jamais à fusionner.

Des groupes ne pourront être créés que lorsqu’une identité commune explicite existe : modèle global conservé, identifiant éditorial administré ou contrat taxonomique dédié. Cette évolution est hors Phase 11.3.

## 7. Normalisation et recherche

`normalizeMarketplaceSearch` applique NFKD, suppression des diacritiques, minuscules françaises, normalisation des apostrophes et tirets, suppression de la ponctuation non alphanumérique et réduction des espaces. `searchTokens` contient la phrase normalisée puis ses mots uniques, avec un maximum borné.

La recherche MVP du repository porte sur un **préfixe de `normalizedName`**. Limites assumées :

- aucune tolérance aux fautes ;
- aucun synonyme ;
- ordre des mots significatif ;
- aucune translittération linguistique avancée ;
- aucun infixe arbitraire ;
- `searchTokens` est préparé mais aucune requête multi-token n’est annoncée comme plein texte.

## 8. Disponibilité

Une offre est découvrable seulement si : restaurant au statut `active`, restaurant non désactivé/supprimé, produit non désactivé/indisponible, nom restaurant, nom produit et slug présents.

- produit désactivé : projection conservée avec `discoverable = false` ;
- produit supprimé : suppression idempotente de l’offre ;
- restaurant désactivé/suspendu : toutes ses offres découvrables passent à `false` par lots bornés ;
- restaurant réactivé : backfill/synchronisation réécrit les mêmes identifiants ;
- slug, logo, services, cuisine ou catégorie modifiés : reprojection des offres concernées.

La projection ne remplace jamais la validation transactionnelle.

## 9. Synchronisation

Le module fournit :

- `syncMarketplaceDishOffer` : upsert déterministe et remplacement complet ;
- `deleteMarketplaceDishOffer` : suppression d’une offre source supprimée ;
- `disableMarketplaceRestaurantOffers` : désactivation bornée des offres d’un restaurant.

Le projet ne possède actuellement aucun dossier Cloud Functions ni pipeline de triggers. Aucun trigger n’a donc été inventé ou déployé. Le raccordement automatique devra utiliser ultérieurement soit des triggers backend idempotents, soit le service central d’écriture, avec journalisation et retry sûr. Jusqu’à cette activation, les scripts QA/émulateur assurent la reconstruction contrôlée.

Événements à raccorder : création/modification/activation/suppression produit ; modification/suppression catégorie ; activation, suspension, suppression, slug, logo, services et cuisines du restaurant.

## 10. Backfill et reconstruction

### Backfill

Commande : `npm run marketplace:backfill -- [options]`.

Options : `--restaurant-id`, `--limit`, `--cursor`, `--batch-size`, `--allow-global`, `--write`. Sans `--write`, le mode est dry-run. Toute lecture est refusée hors émulateur, QA ou staging. Une écriture exige une limite explicite et, pour le global, `--allow-global`.

Le résumé JSON compte restaurants lus, produits lus, projetés, invalides, désactivés, erreurs, écritures et curseur de reprise. Le batch est plafonné à 400.

### Reconstruction

Commande : `npm run marketplace:rebuild -- --restaurant-id ...` ou `--allow-global`, avec les mêmes protections d’environnement et d’écriture. Elle identifie les offres dont le produit source n’existe plus, les supprime seulement avec `--write`, puis demande un backfill séparé du même périmètre. Cette séparation permet comparaison avant/après et évite une suppression globale implicite.

Les scripts n’écrivent jamais dans `restaurants`, `products` ou `categories`.

## 11. Règles Firestore

Les règles ajoutées :

- autorisent la lecture de `marketplaceDishOffers` seulement si `discoverable == true` et `schemaVersion == 1` ;
- interdisent toute écriture client sur cette collection ; les écritures backend utilisent Admin SDK ;
- autorisent la lecture des catégories actives version 1 ;
- réservent leur administration au `super_admin` existant.

Elles n’élargissent aucune règle existante de produits. Les tests locaux présents vérifient le contrat textuel. Les tests d’autorisation réels par rôle nécessitent `@firebase/rules-unit-testing` et l’émulateur Firestore, absents du projet ; ils restent obligatoires avant déploiement.

## 12. Index et requêtes

Les index ajoutés couvrent uniquement :

- offres découvrables par nom + identifiant ;
- catégorie + nom + identifiant ;
- restaurant + nom + identifiant ;
- nouveautés par `createdAt` ;
- popularité par `orderCount` ;
- catégories actives par ordre.

Le repository plafonne une page à 30 (24 par défaut), demande un élément supplémentaire pour déterminer la suite et utilise un curseur base64url contenant valeur de tri et identifiant. Les combinaisons popularité/nouveauté avec filtres sont refusées en version 1 afin de ne pas nécessiter d’index spéculatif.

Les sections d’accueil futures devront demander 6 à 12 éléments. `popular` ne doit être consommé que si `orderCount` est qualifié ; `recent` seulement si `createdAt` est fiable. Aucune requête Promotions n’existe.

## 13. Repository serveur

`MarketplaceDishRepository` utilise Admin Firestore côté serveur. Il expose `listOffers` et `listActiveCategories`. Il applique taille bornée, filtres autorisés, ordre stable, curseur validé et sérialisation explicite. Il n’est importé par aucun composant ni par la page `/`.

## 14. Fraîcheur et qualité

Chaque document porte `projectedAt`, `sourceUpdatedAt`, `schemaVersion` et `quality`. Le mapper émet `complete`, `partial` ou `unavailable`; `stale` et `unknown` sont réservés aux diagnostics de synchronisation futurs. L’UI ne doit pas exposer ces détails sauf incidence utilisateur.

## 15. Feature flag

Le flag serveur `MARKETPLACE_DISH_DISCOVERY_ENABLED` est désactivé par défaut et n’est vrai que si sa valeur est exactement `true`. Aucun écran ne le consomme en Phase 11.3. La route `/` reste donc inchangée, indépendamment de la présence éventuelle de projections.

## 16. Navigation et revalidation futures

Contrat candidat, non implémenté : `/{restaurantSlug}?product={productId}&source=marketplace`.

La Phase 11.5 devra valider slug, restaurant actif, produit appartenant au restaurant, produit actif, catégorie, prix et configurateur, puis retomber sur le menu si le ciblage est invalide. Aucun ajout direct depuis la projection n’est autorisé.

## 17. Observabilité

Les scripts émettent du JSON structuré : événement, identifiants techniques, résultat, compteurs et erreur normalisée. Aucun document source complet ni donnée personnelle n’est journalisé. Les métriques prévues sont créations/mises à jour, désactivations, erreurs, retard et progression ; aucun système de monitoring absent n’a été créé.

## 18. Tests et charge

Les tests unitaires couvrent normalisation, tokens, identifiant, prix, configurateur, liste blanche, données privées, activité, catégorie inconnue, version, idempotence et curseur. Les tests de règles statiques vérifient les blocs dédiés.

Le test local génère 40 produits par restaurant :

| Restaurants | Projections | Calcul pur | Taille moyenne JSON | Volume JSON |
|---:|---:|---:|---:|---:|
| 10 | 400 | 9,80 ms | 750 o | 299 800 o |
| 100 | 4 000 | 66,92 ms | 752 o | 3 008 800 o |
| 500 | 20 000 | 162,33 ms | 755 o | 15 096 800 o |
| 1 000 | 40 000 | 345,15 ms | 755 o | 30 206 800 o |

Ces mesures concernent exclusivement le mapping en mémoire. Elles ne mesurent pas Firestore, réseau, index, règles ou facturation. Aucun test d’intégration distant ou émulateur n’a été exécuté faute d’émulateur configuré.

## 19. Coûts prudents

Une reconstruction complète effectue au minimum une lecture par restaurant, une lecture par produit, éventuellement une lecture de catégorie par produit dans le script actuel, puis une écriture par projection. Le coût réel dépend des tarifs Firestore, de la région, du nombre de produits et de la fréquence de synchronisation. Le cache de catégories par restaurant devra être ajouté avant un backfill de grande taille pour réduire les lectures. Les index augmentent stockage et coût d’écriture. Aucun montant monétaire n’est annoncé sans région, volumétrie et grille tarifaire validées.

## 20. Rollback

1. laisser `MARKETPLACE_DISH_DISCOVERY_ENABLED` absent ou faux ;
2. conserver la page `/` actuelle ;
3. arrêter scripts et futur mécanisme de synchronisation ;
4. ne toucher à aucun produit source ;
5. retirer les règles/index ajoutés seulement via un déploiement autorisé ;
6. supprimer ou reconstruire la projection en environnement contrôlé ;
7. réactiver uniquement après tests de règles, index, pagination et fraîcheur.

Le rollback n’exige aucune restauration des données métier.

## 21. Limites avant activation

- pas de triggers automatiques ;
- pas d’émulateur ni tests de règles par identité réelle ;
- pas de backfill QA ;
- pas d’index déployé ;
- pas de taxonomie peuplée ;
- recherche préfixe seulement ;
- qualité de `orderCount` et `createdAt` non garantie ;
- backfill à optimiser par cache catégories ;
- aucune consommation par la Marketplace.

Ces limites interdisent l’activation en production mais n’affectent pas l’expérience actuelle.
