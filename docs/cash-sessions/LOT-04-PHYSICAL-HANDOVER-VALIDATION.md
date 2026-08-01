# Lot 04 — Validation physique manager

## Frontière

`REVIEW_HANDOVER` est une commande serveur réservée aux rôles Manager et Owner.
Le navigateur fournit la décision, le montant reçu et la note ; l'identité du
manager provient du token Firebase.

Pour `validated` :

```text
receiptDifference = receivedAmount - handover.declaredAmount
cash treasury      = receivedAmount
mobile treasury    = cashSession.expectedMobileMoney
```

Cash et Mobile Money produisent des mouvements distincts :

- `handover-{handoverId}-cash`;
- `handover-{handoverId}-mobile`.

Les mouvements, soldes, remise et session sont mis à jour dans une même
transaction. Les IDs déterministes, les hashes de requête et la détection
`treasuryPosted` empêchent le double crédit.

Une note est obligatoire pour `correction_required` et `rejected`.

## Compatibilité

`TreasuryService` et ses lecteurs de mouvements historiques restent présents.
La page Manager active ne l'utilise plus pour valider une session.
`CashierService.validateShift()` reste compilable et déprécié, sans appelant
actif dans les routes canoniques.

Une session déjà publiée par un ancien parcours est refusée avec
`SESSION_TREASURY_ALREADY_POSTED`.

## Rollback

Ne jamais supprimer les mouvements. En cas d'incident, suspendre les nouvelles
revues, rapprocher remise/session/mouvements/comptes, puis corriger par une
écriture comptable compensatoire distincte.
