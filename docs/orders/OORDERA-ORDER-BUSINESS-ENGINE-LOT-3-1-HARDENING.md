# LOT 3.1 — Durcissement de l’agrégateur

## Écarts détectés

- `items[]` ambigu bloquait toute la mutation canonique.
- la complétude de `orderItems` ne possédait pas de preuve indépendante.
- LOT 1 n’initialisait ni `canonicalItemCount`, ni `aggregateVersion`.
- le précédent diagnostic Rules provenait de l’émulateur/configuration chargé,
  pas du fichier `firestore.rules` actuel.
- la couverture émulateur restait trop concentrée.

## Décisions et corrections

- LOT 1 écrit `canonicalItemCount` et `aggregateVersion=1`.
- LOT 3 refuse une sous-collection dont la taille diffère de
  `canonicalItemCount`.
- `items[]` absent est laissé absent.
- `items[]` bijectif est projeté.
- `items[]` ambigu est ignoré sans bloquer les autorités canoniques ; l’audit
  reçoit `legacyProjection=IGNORED` et
  `LEGACY_ITEMS_PROJECTION_IGNORED`.
- aucune correspondance heuristique n’est utilisée.
- un scénario de concurrence Firestore réel utilise `Promise.allSettled`.

## Rules

Le fichier `firestore.rules` courant compile avec Firebase CLI 15.24.0 et
l’émulateur Firestore 1.21.0. Les anciennes erreurs aux environs de
279/284/290/832 ne sont pas reproductibles. Aucune Rule n’a été modifiée.

## Validation exécutée

- Node.js `v22.23.1`.
- calcul pur et commandes en mémoire : 36 tests réussis, 0 échec, 0 ignoré ;
  le fichier de l’agrégateur contient 22 scénarios nommés en plus des quatre
  scénarios historiques regroupés.
- émulateur Firestore réel : 24 tests réussis, dont deux scénarios
  transactionnels (concurrence réelle et transaction ligne + parent + Stock +
  audit + preuve d’idempotence), 0 échec, 0 ignoré.
- TypeScript : réussi.
- build Next.js : réussi, avec les avertissements OpenTelemetry préexistants.
- `git diff --check` : réussi ; avertissements de normalisation LF/CRLF
  seulement.

## Verdict

Le calcul pur, la transaction Stock + ligne + parent et une concurrence réelle
sont prouvés. La matrice transactionnelle exhaustive demandée n’est toutefois
pas encore entièrement découpée en scénarios indépendants. Le verdict reste
**NO-GO pour LOT 4** tant que service/paiement concurrent, rollbacks injectés,
legacy-only et sous-collection partielle ne sont pas chacun prouvés sous
émulateur.

## Addendum LOT 3.2 — Portée de l’idempotence

La portée officielle d’une clé de mutation est limitée à une commande :

```text
restaurantId + orderId + idempotencyKey
```

Elle n’est pas globale au restaurant. Deux `orderId` différents peuvent donc
réutiliser la même valeur de clé et réussir indépendamment.

Pour une même commande :

- même clé et même payload : rejeu du résultat, sans nouvelle mutation ;
- même clé et payload différent : `IDEMPOTENCY_CONFLICT` ;
- même clé et commande métier différente : `IDEMPOTENCY_CONFLICT`.

L’ancien scénario B4 imposait à tort une unicité entre deux commandes
différentes, absente du contrat LOT 2. Seul le test a été corrigé ; le moteur,
la structure des preuves et l’architecture n’ont pas été modifiés.
