# Lot 02 — Clôture de caisse V2

## Décision

La clôture active est une commande serveur unique `CLOSE_SESSION`. Elle relit
`restaurants/{restaurantId}/payments` dans une transaction Firestore et ne fait
confiance à aucun agrégat financier envoyé par le navigateur.

`payments` reste le registre autoritaire. Les champs `cashSessions.total*` sont
recalculés et synchronisés au moment de la clôture.

## Frontière d'écriture

```text
POS /pos ou /pos/session
  -> POST /api/restaurants/{restaurantId}/cash-sessions/{sessionId}/commands
  -> authentification Firebase + principal staff
  -> vérification du propriétaire de la session
  -> transaction Firestore
       lecture cashSession
       lecture payments(sessionId)
       agrégation ledger
       calcul clôture V2
       mise à jour cache + snapshot + statut closed
```

La route reconstruit `cashierId` depuis le token. Un client ne peut pas clôturer
la session d'un autre caissier en modifiant le payload.

## Formules autoritaires

Les remboursements confirmés sont déjà déduits par l'agrégateur du ledger.

```text
netCashSales          = somme nette des payments cash confirmés
expectedPhysicalCash  = openingBalance + netCashSales
countedPhysicalCash   = espèces réellement comptées
cashCountDifference   = countedPhysicalCash - expectedPhysicalCash
retainedFloat         = espèces volontairement conservées en caisse
expectedHandover      = countedPhysicalCash - retainedFloat
expectedMobileMoney   = somme nette des payments Mobile Money confirmés
```

`retainedFloat` doit être positif ou nul et ne peut pas dépasser
`countedPhysicalCash`. `expectedHandover` est une prévision de remise physique :
ce lot ne crée ni versement, ni mouvement de trésorerie.

Le Mobile Money est séparé définitivement du comptage physique. Il est lu dans
`payments` et affiché à titre de rapprochement ; aucun montant Mobile Money
« compté » n'est demandé au caissier.

## Transaction et idempotence

La lecture de la session, la lecture du ledger et la fermeture sont contenues
dans une transaction Admin Firestore.

La commande porte une clé idempotente déterministe. La session stocke seulement
le hash SHA-256 de cette clé ainsi qu'un hash des montants. Une répétition
strictement identique retourne `replayed: true`. Une seconde clôture différente
est refusée avec `CASH_SESSION_ALREADY_CLOSED`.

## Compatibilité legacy

Les services historiques `CashierService.closeShift()` et
`PaymentLedgerService.snapshotSessionClose()` sont conservés et marqués
dépréciés. Les deux écrans actifs n'y font plus appel.

Pour préserver les rapports existants, la V2 continue de projeter :

- `closingCash`, `declaredCash` depuis `countedPhysicalCash` ;
- `closingMobileMoney`, `declaredMobileMoney` depuis le ledger, sans saisie ;
- `closingBalance`, `declaredTotal` ;
- `cashDifference`, `mobileMoneyDifference` (toujours `0` en V2) ;
- `discrepancyAmount`, `discrepancyStatus` ;
- les formes historiques `systemTotals`, `declaredTotals` et `diff` dans
  `closeSnapshot`.

Les champs V2 (`closeVersion: 2`, valeurs physiques, fond conservé et versement
attendu) coexistent avec ces projections. Aucune donnée historique n'est
migrée.

## Observabilité et rollback

La route journalise `CASH_SESSION_CLOSE_V2_COMMITTED` ou
`CASH_SESSION_CLOSE_V2_REJECTED`, avec `requestId`, restaurant, session, acteur
et état de rejeu.

Rollback applicatif possible :

1. remettre temporairement les écrans sur le service legacy ;
2. conserver les documents V2, lisibles grâce aux projections legacy ;
3. ne jamais effacer les champs V2 ni recalculer une session déjà fermée ;
4. diagnostiquer les écarts depuis `payments`, qui reste autoritaire.

Aucun rollback ne nécessite de migration de données.

## Hors périmètre confirmé

- aucune collection `cashHandovers` ;
- aucune écriture `cashMovements` ou trésorerie ;
- aucune migration ;
- aucun changement de navigation ;
- aucune modification de la validation manager legacy dans ce lot.

## Tests et critères Lot 3

Couverture ajoutée :

- fond initial inclus dans le cash théorique ;
- séparation cash / Mobile Money ;
- remboursements nets ;
- écart de caisse et versement attendu ;
- validation du fond conservé ;
- transaction émulateur, recalcul des caches et idempotence ;
- refus d'un autre caissier ;
- absence de `cashHandovers` et de mouvement de trésorerie ;
- caractérisation des deux interfaces actives et des chemins legacy.

Décision pour le Lot 3 : **GO conditionnel** après succès du typecheck, des tests
ciblés, du test émulateur disponible, du build et de `git diff --check`.
Le Lot 3 devra créer le document de versement à partir de
`expectedHandover`, sans confondre la clôture avec la réception physique.
