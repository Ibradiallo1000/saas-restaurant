# Lot 01 — Unification financière autour de `payments`

## 1. Décision d'architecture

Date : 2026-07-30.

`restaurants/{restaurantId}/payments/{paymentId}` est l'unique journal
autoritaire des encaissements et remboursements. Les champs `total*` de
`cashSessions` sont des caches reconstruits à partir de ce journal.

```text
POS / Manager caisse
  -> API commandes authentifiée
  -> ConfirmOrderPayment
  -> FirestorePaymentLedger
  -> transaction Firestore unique
       1. vérifie session ouverte + propriétaire
       2. vérifie l'idempotence
       3. crée payments/{paymentId}
       4. recalcule le ledger de la session
       5. remplace cashSessions.total*
       6. met à jour la commande
```

Les commandes QR à table, livraison et anciennes commandes utilisent la même
commande de confirmation. Leur canal financier est déterminé par le serveur à
partir de `serviceMode`, `orderType`, `type` et `source`; il n'est pas accepté
du navigateur.

Les intentions Mobile Money non encore confirmées ne sont plus comptabilisées
dans `payments`. Elles restent sur la commande ou la demande de paiement. Une
entrée financière est créée uniquement à la confirmation.

## 2. Frontières

### 2.1 Confirmation d'un paiement

Frontière canonique :

`POST /api/restaurants/{restaurantId}/orders/{orderId}/commands`

Commande :

`CONFIRM_ORDER_PAYMENT`

Le moteur reconstruit l'acteur depuis le token Firebase. Le writer
`FirestorePaymentLedger.createConfirmedPaymentInTransaction()` vérifie :

- restaurant ;
- session existante et `status == "open"` ;
- correspondance du caissier avec `cashierId`, `userId` ou `staffId`;
- montant et version de paiement de la commande ;
- unicité du document et de la clé idempotente ;
- méthode cash ou Mobile Money.

La commande, le paiement, la preuve d'idempotence et le cache de session font
partie de la même transaction.

### 2.2 Remboursement, annulation et réconciliation

Frontière :

`POST /api/restaurants/{restaurantId}/payments/commands`

Commandes :

- `REFUND_PAYMENT`;
- `VOID_PAYMENT`;
- `RECONCILE_SESSION`.

La réconciliation avec `repair: false` est un dry-run. `repair: true` remplace
les caches divergents dans une transaction. La réparation est idempotente.

Les Security Rules refusent désormais toute création ou modification directe
de `payments` par un client Firebase. Les documents historiques restent
lisibles par les rôles qui possédaient déjà ce droit.

## 3. Modèle financier

### 3.1 Encaissement

Une entrée moderne possède :

```text
entryType: payment
status: confirmed
amount: montant positif
source: pos | qr_table | delivery | legacy
type: cash | mobile_money
sessionId
cashierId
idempotencyKey
ledgerVersion: 1
```

Les anciens documents sans `entryType` sont interprétés comme
`entryType: payment`. Une ancienne source inconnue est projetée dans
`source: legacy` lors de l'agrégation.

### 3.2 Remboursement

Le paiement original reste immuable et confirmé. Le remboursement crée une
nouvelle entrée dans `payments` :

```text
entryType: refund
status: confirmed
parentPaymentId: identifiant du paiement original
amount: montant positif à soustraire
```

Cette décision permet :

- les remboursements partiels ;
- plusieurs remboursements idempotents ;
- une piste d'audit complète ;
- l'absence de réécriture destructive de la preuve originale.

Le total cumulé des remboursements ne peut pas dépasser le paiement parent. Le
type et le provider sont hérités du paiement parent. Le cache cash ou Mobile
Money est diminué, ainsi que `totalConfirmed`.

La commande reçoit `refundTotal`, `refundStatus` et `refundedAt`. Un
remboursement intégral place `paymentStatus` à `refunded`; un remboursement
partiel conserve le statut payé et ajoute `partially_refunded`.

### 3.3 Annulation et invalidation

| État avant action | Action permise | Effet financier |
|---|---|---|
| `pending` | `VOID_PAYMENT` | statut `voided`, effet nul |
| `failed` | aucune annulation supplémentaire | effet nul |
| `voided` | replay idempotent | effet nul |
| `confirmed` | annulation refusée | `REFUND_REQUIRED_AFTER_CONFIRMATION` |
| `confirmed` | `REFUND_PAYMENT` | nouvelle écriture débit |

Une annulation de commande avant confirmation ne crée aucun crédit. Après
confirmation, le métier doit rembourser : il est interdit de masquer
l'encaissement en changeant simplement son statut.

Les marqueurs historiques `refunded`, `voided`, `cancelled` restent compris par
les rapports pour compatibilité.

## 4. Agrégats et prévention des doubles comptes

Le domaine partagé `payment-ledger-domain.ts` calcule :

- `totalCash`;
- `totalMobile` et `totalMobileMoney`;
- `totalConfirmed` net des remboursements ;
- `totalPayments`;
- `totalOrders` dont le solde reste positif ;
- `totalRefunded` et `totalRefunds`;
- `totalsByProvider`;
- `totalsBySource`;
- `statusCounts`.

Protections :

1. document de paiement stable issu de la preuve de commande ;
2. clé idempotente stable ;
3. transaction Firestore ;
4. preuve de commande existante ;
5. déduplication défensive par `idempotencyKey`, puis par ID historique ;
6. remplacement du cache complet, jamais second incrément côté writer serveur ;
7. remboursement déterministe et plafond transactionnel.

Les rapports financiers soustraient les entrées `refund` confirmées. Les
paiements `pending`, `failed` et `voided` ont un effet nul.

## 5. Réconciliation

`FirestorePaymentLedger.reconcileSession()` lit, dans la même transaction :

- `cashSessions/{sessionId}`;
- tous les `payments` portant ce `sessionId`.

Il produit :

```text
ok
repaired
aggregate
differences[field] = { cached, expected }
```

Mode dry-run :

```json
{
  "command": "RECONCILE_SESSION",
  "sessionId": "...",
  "repair": false
}
```

Mode réparation :

```json
{
  "command": "RECONCILE_SESSION",
  "sessionId": "...",
  "repair": true
}
```

La réparation écrit `financialCacheVersion`,
`financialCacheUpdatedAt`, `financialCacheReconciledAt` et
`financialCacheReconciledBy`. Un second passage ne produit aucune modification.

Aucun script de migration n'est nécessaire dans ce lot. Aucune réconciliation
n'a été exécutée sur des données locales ou de production.

## 6. Compatibilité legacy

Sont conservés :

- `CashierService`;
- `PaymentLedgerService`;
- `cashierSessions`;
- la lecture des anciens `payments`;
- les mouvements de trésorerie historiques ;
- les clés `totalMobile` et `totalMobileMoney`;
- les anciens marqueurs de remboursement/annulation.

`PaymentLedgerService` reste utilisé pour agréger et prendre le snapshot de
clôture. Ses méthodes d'écriture restent présentes pour compatibilité source,
mais les Rules interdisent désormais leur utilisation directe par les clients.

`validateMobilePaymentTransaction()` et `refundOrderTransaction()` sont marqués
dépréciés. Les interfaces actives de confirmation passent par la frontière
serveur. `processOrderPaymentTransaction()` ne crée plus de `payment` pour une
simple intention Mobile Money.

## 7. Observabilité

La frontière financière journalise :

- `FINANCIAL_LEDGER_COMMAND_COMMITTED`;
- `FINANCIAL_LEDGER_COMMAND_REJECTED`;
- `requestId`;
- restaurant ;
- commande ;
- acteur reconstruit ;
- indicateur `replayed`;
- indicateur `repaired`;
- code d'erreur métier.

Les écritures portent également :

- `ledgerVersion`;
- `financialCacheVersion`;
- identifiants d'idempotence ;
- auteur et timestamps de confirmation, remboursement, annulation ou
  réconciliation.

Alertes recommandées avant production :

- `CASH_SESSION_OWNERSHIP_MISMATCH`;
- `PAYMENT_IDEMPOTENCY_CONFLICT`;
- `REFUND_AMOUNT_EXCEEDS_PAYMENT`;
- taux de réconciliations divergentes ;
- échecs transactionnels répétés ;
- tentative d'écriture client refusée sur `payments`.

## 8. Rollback

Le rollback ne doit jamais supprimer une entrée financière.

1. Désactiver les nouveaux appels de remboursement/réconciliation.
2. Conserver les `payments` modernes : les lecteurs legacy interprètent
   `entryType` absent comme paiement et ignorent les champs supplémentaires.
3. Restaurer temporairement l'ancienne route d'encaissement seulement après
   réconciliation et seulement avec une version des Rules coordonnée.
4. Ne pas réactiver les incréments client tant qu'un writer serveur peut encore
   traiter des commandes, afin d'éviter un double crédit.
5. Exécuter `RECONCILE_SESSION` en dry-run sur les sessions affectées.
6. Comparer paiements, commandes et caches.
7. Réparer explicitement les caches si nécessaire.

Le changement de Rules et le changement d'interface doivent donc être déployés
ensemble. Ce lot n'effectue aucun déploiement.

## 9. Fichiers structurants

- `src/lib/finance/payment-ledger-domain.ts` : agrégation et diff purs ;
- `src/server/finance/firestore-payment-ledger.ts` : writer transactionnel ;
- route commandes Orders : confirmation ;
- route commandes Payments : refund, void, reconciliation ;
- `src/lib/finance/financial-summary.ts` : reporting net des refunds ;
- `firestore.rules` : ledger en écriture serveur uniquement ;
- POS et Manager caisse : confirmation par commande serveur.

## 10. Limites restantes

- la formule de clôture est volontairement inchangée ;
- `openingBalance` n'entre toujours pas dans l'attendu cash ;
- aucun `cashHandover` n'existe ;
- `CashierService.validateShift()` reste présent ;
- la validation trésorerie reste distincte du présent lot ;
- aucune migration ou réconciliation de données réelles n'a été lancée ;
- les méthodes d'écriture client de `PaymentLedgerService` restent compilables
  pour compatibilité, mais sont bloquées par les Rules ;
- les refunds historiques hors `payments` ne sont pas convertis ;
- la route de remboursement n'est pas encore exposée dans une interface ;
- les lectures live de toutes les collections restent larges ;
- la pagination du ledger n'est pas encore nécessaire dans une transaction
  Firestore, mais les sessions exceptionnellement longues devront être bornées
  opérationnellement.

## 11. Décision pour la Clôture V2

**GO technique conditionnel** pour développer la Clôture V2.

Les préconditions financières sont présentes :

- ledger autoritaire unique ;
- caches reconstructibles ;
- confirmation transactionnelle ;
- ownership de session ;
- refunds/voids définis ;
- réconciliation dry-run/réparation ;
- blocage des écritures client.

**NO-GO pour activer la Clôture V2 en production** avant :

1. déploiement coordonné de la route serveur et des Rules ;
2. dry-run de réconciliation sur un échantillon représentatif ;
3. inventaire des remboursements historiques hors ledger ;
4. métriques et alertes opérationnelles ;
5. recette réelle POS, QR et livraison avec cash et Mobile Money ;
6. confirmation que toutes les sessions actives possèdent un propriétaire
   exploitable (`cashierId`, `userId` ou `staffId`).
