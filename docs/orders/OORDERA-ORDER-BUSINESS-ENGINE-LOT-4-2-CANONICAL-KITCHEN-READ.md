# Ordera — LOT 4.2 — Lecture canonique Cuisine

## Statut

Couche de lecture implémentée et testée, non raccordée à `KitchenBoard`.

## Source de vérité

La nouvelle couche écoute exclusivement le groupe de collections :

`restaurants/{restaurantId}/orders/{orderId}/orderItems/{orderItemId}`

La projection parent `items[]` n’est jamais utilisée comme source des lignes.
Elle sert seulement à détecter une incohérence de
`canonicalItemCount` et à identifier une commande mixte. Les commandes
uniquement legacy restent dans l’ancien parcours, en lecture seule.

Les créations canoniques LOT 1 possèdent bien :

- `restaurantId` ;
- `orderId` ;
- `preparationMode` ;
- `status` ;
- `createdAt`.

## Requête

```text
collectionGroup("orderItems")
restaurantId == restaurant courant
preparationMode == kitchen
status in [pending, preparing, ready]
orderBy createdAt asc
limit 200
```

Un seul listener temps réel est ouvert. Les doublons éventuels sont éliminés
par chemin Firestore. Les erreurs initiales et de reconnexion sont exposées au
hook ; le SDK assure la reconnexion. Le changement de restaurant, d’utilisateur
ou la désactivation déclenche le nettoyage du listener et invalide les
résolutions parentales en cours.

## Index

Un seul index `COLLECTION_GROUP` a été ajouté :

1. `restaurantId ASC` ;
2. `preparationMode ASC` ;
3. `status ASC` ;
4. `createdAt ASC` ;
5. `__name__ ASC`.

Il correspond exactement à la requête retenue. Aucun autre index spéculatif
n’a été créé et aucun index n’a été déployé.

## Rules

La première exécution émulateur a prouvé que le bloc imbriqué
`orders/{orderId}/orderItems` ne suffisait pas aux requêtes collection group.

Une Rule minimale de lecture `list` a donc été ajoutée pour
`/{path=**}/orderItems/{itemId}`. Elle exige :

- un `restaurantId` documenté auquel l’utilisateur Cuisine est rattaché par
  son profil racine ou son document staff ;
- `preparationMode == kitchen` ;
- un statut `pending`, `preparing` ou `ready` ;
- une limite explicite inférieure ou égale à 200.

Elle ne modifie aucune autorisation d’écriture. L’émulateur prouve qu’un
utilisateur Cuisine lit son restaurant, mais pas un autre, et qu’un utilisateur
anonyme ou non rattaché est refusé.

## Modèle `KitchenOrderItemView`

Le modèle expose uniquement :

- identifiants restaurant, commande, ligne et produit ;
- nom produit ;
- quantités totale, active, annulée et servie ;
- statut, version et mode Cuisine ;
- variantes, suppléments et note client ;
- type, table, référence, client et dates de la commande ;
- temps écoulé ;
- état canonique/legacy protégé ;
- possibilité d’action.

Prix, paiement, stock, audit et preuve d’idempotence sont absents.

## Quantité active

```text
activeQuantity = quantity - cancelledQuantity
```

- pending, preparing et ready utilisent la même formule ;
- une annulation partielle réduit le besoin ;
- une annulation totale exclut la ligne ;
- `servedQuantity` n’est pas soustraite d’une ligne ready ;
- quantité négative, décimale ou incohérente : document ignoré et compteur
  d’anomalies incrémenté.

## Regroupement et colonnes

Les fonctions pures :

- regroupent par `orderId` ;
- trient les lignes par `createdAt`, puis `orderItemId` ;
- trient les groupes par `createdAt`, puis `orderId` ;
- détectent un parent mixte via les modes de sa projection diagnostique ;
- calculent les compteurs ;
- produisent les colonnes `pending`, `preparing` et `ready`.

La Cuisine ne voit et ne contrôle que les lignes `kitchen`.

## Contexte parent sans N+1

Après chaque snapshot actif, les `orderId` uniques sont chargés depuis la
collection `orders` du restaurant par requêtes `documentId() in [...]`, en lots
de 30. Aucun listener permanent par parent n’est ouvert.

Le parent fournit uniquement le type, la table, la référence, le client, la
date et les métadonnées de cohérence. Les lignes restent autoritaires.

## Legacy et incohérences

- zéro document canonique : `legacy_read_only`, conservé dans l’ancien parcours ;
- `canonicalItemCount` absent, nul ou divergent de la projection diagnostique :
  `canonical_inconsistent`, actions interdites ;
- document canonique mal formé : ignoré, compté dans
  `invalidDocumentCount`, aucune réparation ;
- aucune conversion ou écriture automatique.

## Limite

La limite est de 200 lignes actives, soit une marge adaptée à plusieurs dizaines
de commandes simultanées tout en bornant mémoire, lectures et rendu tablette.

À 200 résultats :

- `isSaturated = true` ;
- log `KITCHEN_CANONICAL_READ_SATURATED` sans donnée client ;
- la future interface devra afficher une alerte explicite.

## Feature flag

Variables :

- `NEXT_PUBLIC_KITCHEN_CANONICAL_READ_MODE=legacy|canonical|compare` ;
- `NEXT_PUBLIC_KITCHEN_CANONICAL_READ_RESTAURANTS=id1,id2`.

Valeur finale après migration Cuisine : `canonical`. Une allowlist non vide
restreint l’activation à ses restaurants ; une allowlist vide applique le mode
global. Le rollback immédiat utilise
`NEXT_PUBLIC_KITCHEN_CANONICAL_READ_MODE=legacy`.

## Tests

- 21 scénarios métier et de modèle ;
- 3 contrats structurels : listener unique, nettoyage, index exact ;
- 5 scénarios Rules avec émulateur réel ;
- non-régression LOT 1, 2, 3, 3.2, 4.1 et Stock.

## Retour arrière

1. laisser le flag en `legacy` ;
2. supprimer le dossier `canonical-read`, ses tests et ce document ;
3. retirer l’index `orderItems` ;
4. retirer uniquement la Rule collection group ajoutée.

L’ancien `OrdersProvider` et `KitchenBoard` n’ayant pas été modifiés, aucun
retour arrière UI ou donnée n’est nécessaire.

## Risques restants

- les commandes purement legacy restent dépendantes de l’ancien provider ;
- l’index doit être déployé avant activation réelle du flag ;
- le mode `compare` est défini mais sa télémétrie silencieuse reste optionnelle ;
- les permissions d’écriture legacy sur `orderItems` ne sont pas durcies dans
  ce lot.
