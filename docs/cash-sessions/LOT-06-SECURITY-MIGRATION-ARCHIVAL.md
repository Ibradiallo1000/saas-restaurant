# Lot 06 — Sécurité, migration et archivage

## Sécurité appliquée

- `payments` : écritures client interdites ;
- `cashHandovers` : écritures client interdites ;
- `cashierSessions` : format legacy gelé en écriture ;
- lecture d'une remise : Manager/Owner ou caissier propriétaire ;
- soumission et validation : token Firebase, rôle et restaurant revérifiés côté
  serveur ;
- trésorerie issue des remises : transaction Admin uniquement.

Les routes produisent des erreurs structurées et journalisent commande,
restaurant, acteur, `requestId`, résultat et rejeu.

## Outils préparés

### Réconciliation V2

`scripts/cash-session-v2-reconcile.mjs`

- dry-run par défaut ;
- émulateur, QA ou staging seulement ;
- compare `payments` et caches de session ;
- inventorie sessions legacy, propriétaires manquants et remises absentes ;
- écriture exige `--write=true --confirm=RECONCILE_CASH_SESSIONS`.

### Inventaire legacy

`scripts/cash-session-legacy-inventory.mjs`

- lecture seule ;
- compte sessions legacy, V2, remises et mouvements ;
- retourne toujours `deletable: []` ;
- aucune suppression ou archive automatique.

Aucun script n'a été exécuté sur des données réelles.

## Dépréciations et suppression

Dépréciés :

- `CashierService.closeShift`;
- `PaymentLedgerService.snapshotSessionClose`;
- `CashierService.validateShift`;
- `TreasuryService.postCashSessionMovementToTreasury` pour les nouvelles
  validations de session ;
- route singulière `/pos/session`.

Rien n'est supprimable avant :

1. inventaire production ;
2. absence d'appel pendant une fenêtre mesurée ;
3. rapprochement ledger/cache/remise/mouvements ;
4. rollback répété en préproduction ;
5. conservation démontrée des rapports historiques.

## Déploiement progressif

1. déployer routes et règles en préproduction ;
2. exécuter l'inventaire et la réconciliation en dry-run ;
3. tester clôture, remise, correction, rejet et validation concurrente ;
4. activer sur un restaurant pilote ;
5. surveiller conflits d'idempotence, écarts, refus d'ownership et doubles
   publications ;
6. étendre par cohortes ;
7. conserver les lecteurs legacy jusqu'à stabilité mesurée.

## Métriques

- taux de sessions V2 sans remise ;
- délai clôture → soumission → validation ;
- écarts déclaration et réception ;
- corrections/rejets ;
- divergences ledger/cache ;
- `SESSION_TREASURY_ALREADY_POSTED`;
- conflits idempotents et erreurs transactionnelles.

## Rollback

Suspendre les mutations de remise, conserver toutes les preuves, remettre
temporairement les écrans en lecture seule et rapprocher chaque session. Aucun
rollback ne doit effacer `payments`, `cashHandovers` ou `cashMovements`.
