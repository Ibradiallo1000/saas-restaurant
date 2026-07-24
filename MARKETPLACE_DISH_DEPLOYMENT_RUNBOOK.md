# Marketplace orientée plats — Runbook de déploiement contrôlé

## Principes

- Ne jamais utiliser les commandes ci-dessous contre la production sans validation explicite.
- Le flag `MARKETPLACE_DISH_DISCOVERY_ENABLED` reste absent ou `false` jusqu’à la fin de la recette staging.
- Utiliser des identifiants de projet explicites et vérifier `firebase use` avant chaque commande.
- Conserver un export/snapshot staging avant les écritures de reconstruction.

## Prérequis

1. Node et dépendances du projet installés.
2. Firebase CLI authentifiée par un compte autorisé.
3. Projet Emulator/QA/Staging isolé, jamais le projet production par défaut.
4. Variables `FIREBASE_PROJECT_ID` et, selon le cas, `FIRESTORE_EMULATOR_HOST` ou `MARKETPLACE_DISCOVERY_ENV=staging`.
5. Fixtures A/B et cas inactive/stale décrits dans le rapport QA.

## Niveau 1 — Local / Emulator

PowerShell :

```powershell
npm run typecheck
npm run test:marketplace-discovery
npm run test:marketplace-transaction
npm run marketplace:load-test -- --products=40
$env:FIREBASE_PROJECT_ID='oordera-marketplace-emulator'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
firebase emulators:start --only firestore --project $env:FIREBASE_PROJECT_ID
```

Dans un second terminal, après chargement des fixtures :

```powershell
$env:FIREBASE_PROJECT_ID='oordera-marketplace-emulator'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
npm run marketplace:backfill -- --dry-run --restaurant-id qa-restaurant-a --limit 2 --batch-size 20
npm run marketplace:backfill -- --write --restaurant-id qa-restaurant-a --limit 2 --batch-size 20
npm run marketplace:rebuild -- --restaurant-id qa-restaurant-a --limit 50
```

Répéter le backfill écrit et comparer les documents pour prouver l’idempotence. Tester ensuite recherche, catégorie, pages, fin de liste, désactivation et règles par rôle avec l’outil officiel de tests de règles si ajouté.

## Niveau 2 — Staging

Définir explicitement le projet :

```powershell
$env:FIREBASE_PROJECT_ID='<PROJECT_ID_STAGING>'
$env:MARKETPLACE_DISCOVERY_ENV='staging'
firebase use $env:FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules --project $env:FIREBASE_PROJECT_ID
firebase deploy --only firestore:indexes --project $env:FIREBASE_PROJECT_ID
```

Attendre que tous les index soient construits. Exécuter d’abord un dry-run puis un périmètre borné :

```powershell
npm run marketplace:backfill -- --dry-run --restaurant-id '<RESTAURANT_ID_QA>' --limit 1 --batch-size 20
npm run marketplace:backfill -- --write --restaurant-id '<RESTAURANT_ID_QA>' --limit 1 --batch-size 20
npm run marketplace:rebuild -- --restaurant-id '<RESTAURANT_ID_QA>' --limit 100
```

Pour reprendre une passe de lecture globale bornée :

```powershell
npm run marketplace:backfill -- --dry-run --limit 10 --batch-size 50 --cursor '<LAST_RESTAURANT_ID>'
```

Ne pas utiliser `--allow-global --write` avant validation des compteurs, erreurs, invalides et projections obsolètes.

## Functions et synchronisation

Aucune Firebase Function Marketplace n’existe actuellement ; aucune commande Functions n’est à exécuter. Avant activation, choisir et valider explicitement un mécanisme de synchronisation. Tant qu’il n’est pas raccordé, exécuter uniquement des reconstructions/backfills contrôlés et considérer la projection comme potentiellement stale.

## Vérification staging

1. Comparer produits sources et projections sans modifier les sources.
2. Vérifier la liste blanche et les refus d’écriture public/restaurant/owner.
3. Activer le flag uniquement dans un déploiement staging :

```powershell
$env:MARKETPLACE_DISH_DISCOVERY_ENABLED='true'
npm run build
```

4. Tester recherche, pagination, URL partagée, Cover, produit simple/configurable/stale.
5. Tester panier A→B, B→A, refresh B et vérifier le `restaurantId` du payload checkout sans paiement réel.
6. Recetter 320 à 1440 px, zoom 200 %, clavier, lecteur d’écran, clair/sombre, reduced motion et offline.

## Niveau 3 — Production interne (autorisation distincte obligatoire)

1. Déployer règles et index explicitement sur l’identifiant production.
2. Attendre la construction complète des index.
3. Dry-run sur un restaurant interne.
4. Backfill écrit borné à ce restaurant et comparer les compteurs.
5. Déployer l’application avec le flag réservé à l’équipe si l’infrastructure le permet.
6. Surveiller erreurs serveur, refus Firestore, temps de requête, curseurs et offres stale.

## Niveau 4 — Activation progressive

Le flag est une variable de build serveur. Sans système de ciblage, l’activation exige un build/redeploy. Ne passer à `true` qu’après validation écrite des niveaux précédents. Vérifier immédiatement `/`, `/?view=restaurants`, deux restaurants et un checkout sans paiement.

## Monitoring

Surveiller : erreurs repository, index manquant, taux de résultats vides, latence première page/page suivante, projections invalides, erreurs de ciblage produit, changements de restaurant, erreurs checkout et volume de lecture. Aucun outil de monitoring nouveau n’est créé par cette phase.

## Rollback immédiat

1. Remettre `MARKETPLACE_DISH_DISCOVERY_ENABLED=false` ou supprimer la variable.
2. Rebuilder et redéployer l’application.
3. Vérifier que `/` affiche la Marketplace historique et que `/?view=restaurants` fonctionne.
4. Arrêter le mécanisme de synchronisation s’il a été ajouté séparément.
5. Laisser les projections en place : elles ne sont plus consommées et aucune restauration produit n’est nécessaire.
6. Ne pas vider les paniers : ils sont isolés par restaurant et indépendants du read model.

## Nettoyage contrôlé

Après validation et délai de conservation approuvé, les projections obsolètes peuvent être identifiées par reconstruction dry-run. Toute suppression distante exige une autorisation distincte, un périmètre borné et une vérification avant/après. Ne jamais supprimer les collections sources restaurants/products/categories.
