# Ordera — LOT 4.1 — Frontière serveur Cuisine

## Statut

Implémenté, sans raccordement de l’interface Cuisine.

## Route

`POST /api/restaurants/{restaurantId}/orders/{orderId}/commands`

La route est un adaptateur HTTP. Elle ne contient aucune transition métier,
aucun recalcul du parent et aucune écriture Firestore directe. Elle construit
l’entrée canonique puis appelle exclusivement :

- `markOrderItemPreparing()` ;
- `markOrderItemReady()`.

Le stockage transactionnel reste assuré par
`FirestoreAtomicOrderCommandStore`.

## Contrat d’entrée

```json
{
  "command": "MARK_ORDER_ITEM_PREPARING",
  "orderItemId": "item-id",
  "idempotencyKey": "intention-stable",
  "expectedVersion": 1
}
```

Seuls ces quatre champs sont acceptés. Tout champ supplémentaire est refusé,
notamment acteur, rôle, canal, tenant, commande, statut final, stock, audit ou
projection du parent.

Commandes autorisées :

- `MARK_ORDER_ITEM_PREPARING` ;
- `MARK_ORDER_ITEM_READY`.

Les commandes Served, Cancel et Payment, ainsi que toute commande inconnue,
retournent `FORBIDDEN_COMMAND` avec HTTP 403.

## Authentification et permissions

1. lecture du Bearer token ;
2. validation Firebase Admin avec contrôle de révocation ;
3. lecture du profil `users/{uid}` et de
   `restaurants/{restaurantId}/staff/{uid}` par le résolveur staff existant ;
4. contrôle du compte actif et de l’appartenance au restaurant ;
5. exigence explicite du rôle `kitchen` ;
6. construction serveur de l’acteur :

```text
id = uid vérifié
role = kitchen
restaurantId = paramètre URL
sourceChannel = kitchen
```

Manager, Owner, Cashier et les identités publiques ne sont pas admis par cette
frontière. Le moteur LOT 2 conserve sa propre vérification défensive de rôle,
canal, mode de préparation, restaurant, commande et ligne.

## Réponses

Succès HTTP 200 :

```json
{
  "ok": true,
  "command": "MARK_ORDER_ITEM_READY",
  "orderId": "order-id",
  "orderItemId": "item-id",
  "result": {
    "ok": true,
    "commandName": "MarkOrderItemReady",
    "orderId": "order-id",
    "orderItemId": "item-id",
    "status": "APPLIED",
    "version": 3,
    "replayed": false
  },
  "requestId": "..."
}
```

Erreur :

```json
{
  "ok": false,
  "error": {
    "code": "CONCURRENT_MODIFICATION",
    "message": "...",
    "retryable": true
  },
  "requestId": "..."
}
```

Mapping :

- authentification : 401 ;
- tenant, rôle ou commande interdite : 403 ;
- commande ou ligne absente : 404 ;
- JSON ou payload invalide : 400 ;
- transition, version, idempotence ou legacy : 409 ;
- panne de stock transitoire issue du moteur : 503 ;
- erreur inattendue masquée : 500.

Aucune stack, erreur Firebase brute ou donnée interne n’est retournée.

## Idempotence

La route exige une clé de 8 à 200 caractères et la transmet sans transformation
au moteur LOT 2. Elle ne crée aucune preuve parallèle et ne modifie pas la
structure existante. Le rejeu du même payload retourne la preuve existante sans
nouvelle mutation. Une même intention réutilisée avec un payload différent
retourne `IDEMPOTENCY_CONFLICT`.

## App Check

Mode LOT 4.1 : **observation**.

- token présent et valide : vérifié par Firebase Admin ;
- token absent : log `KITCHEN_COMMAND_APP_CHECK_MISSING`, requête poursuivie ;
- token présent mais invalide : log `KITCHEN_COMMAND_APP_CHECK_INVALID`,
  requête poursuivie.

L’ID token Firebase reste toujours obligatoire. L’enforcement App Check pourra
être activé dans un lot ultérieur après validation des postes Cuisine et mesure
des événements d’observation. Cette activation transformera les deux événements
en refus stables sans changer le contrat métier.

## Firestore Rules et index

La route utilise Firebase Admin : aucune Rule ni aucun index n’est requis pour
ses écritures transactionnelles.

Audit actuel :

- `orders/{orderId}/orderItems/{itemId}` est lisible par
  `canUseRestaurant(restaurantId)` ;
- sa création directe est encore autorisée à tout staff pouvant utiliser le
  restaurant ;
- certaines mises à jour directes hors champs de service restent autorisées ;
- la future lecture Cuisine par `collectionGroup("orderItems")` devra faire
  l’objet d’un test Rules et d’un index adapté aux filtres définitifs du LOT
  4.2 ;
- aucun index ne doit être créé avant que la requête exacte du client Cuisine
  soit figée.

Risque reporté : le durcissement des écritures navigateur sur `orderItems` doit
être traité séparément, canal par canal, afin de ne pas casser les parcours
legacy.

## Tests

`tests/orders/kitchen-command-route.test.mjs` contient vingt-trois scénarios
indépendants :

1. token absent ;
2. token invalide ;
3. utilisateur sans restaurant ;
4. utilisateur d’un autre restaurant ;
5. rôle interdit ;
6. commande inconnue ;
7. Served interdit ;
8. Payment interdit ;
9. payload incomplet ;
10. version invalide ;
11. clé absente ;
12. pending vers preparing ;
13. preparing vers ready ;
14. transition invalide ;
15. conflit de version ;
16. rejeu idempotent ;
17. conflit d’idempotence ;
18. legacy en lecture seule ;
19. ligne d’une autre commande ;
20. erreur interne masquée.
21. acteur ou rôle navigateur refusé ;
22. App Check absent observé sans blocage ;
23. App Check invalide observé sans blocage.

Les scénarios 12 à 17 invoquent réellement les fonctions publiques LOT 2 avec
un port transactionnel mémoire ; les campagnes émulateur LOT 2, LOT 3 et LOT
3.2 continuent de prouver le comportement Firestore réel du même store.

## Fichiers

Créés :

- `src/app/api/restaurants/[restaurantId]/orders/[orderId]/commands/route.ts` ;
- `src/server/orders/kitchen-command/handler.ts` ;
- `tests/orders/kitchen-command-route.test.mjs` ;
- ce document.

Modifié :

- `src/server/orders/create/security.ts` : exposition du résolveur staff
  existants pour réutilisation, sans changement de comportement.

## Retour arrière

Supprimer la nouvelle route, le handler, son test et ce document, puis rendre à
nouveau privé `resolveStaffPrincipal`. Aucun schéma,
document Firestore, Rule, index ou client n’est à restaurer.

## Risques restants

- App Check n’est pas encore bloquant ;
- l’interface Cuisine n’appelle pas encore la route ;
- la requête de lecture collection group et son index ne sont pas encore figés ;
- les écritures directes legacy sur `orderItems` restent ouvertes à certains
  staffs jusqu’au lot de durcissement prévu.
