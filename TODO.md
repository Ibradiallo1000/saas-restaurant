# TODO: Correction échec ouverture de caisse

## Root cause analysis
- The route handler catches all non-FinancialLedgerError and returns `INTERNAL_ERROR` / `"L'ouverture de caisse a échoué"`
- The client side has a fallback `"L'ouverture de caisse a échoué"` when payload is null
- New fields (`openingPaymentBalances`, `openingFloatSource`, `paymentBalanceSource`) could be undefined in Firestore writes

## Steps

### 1. Route handler - Improve error logging and propagation
- [x] Log business code + full server error (stack) without exposing to client
- [x] Return real business code/message for FinancialLedgerError
- [x] Return FinancialLedgerError-compatible payload for unexpected errors

### 2. Client - Propagate real error code/message
- [x] Always propagate `error.code` and `error.message` from server response
- [x] Only fallback to generic message if payload is truly absent

### 3. Firestore writer - Guard optional fields, throw on missing required fields
- [x] Normalize `openingPaymentBalances` → always an object via `resolvePaymentBalances()`, never undefined
- [x] Normalize `openingFloatSource` → string, never undefined
- [x] Normalize `paymentBalanceSource` → string, never undefined
- [x] Normalize `posStationId/Name/Code` → string, never undefined (with fallback to DEFAULT)
- [x] Ensure `cashFloat` resolution always returns a valid object (with safe guard for NaN/negative)
- [x] Normalize `posCatalogScopeSnapshot` fields → always arrays, never undefined
- [x] Removed unused `openingBalance` input parameter

### 4. Tests
- [ ] Test: DEFAULT station resolution
- [ ] Test: Real POS station
- [ ] Test: Restaurant without configured balances
- [ ] Test: Cashier without explicit assignment
- [ ] Test: Missing treasury accounts
- [ ] Test: Double opening prevention

### 5. TypeScript & Build
- [x] TypeScript check (`tsc --noEmit`) — queued
- [ ] Next.js build (`next build`)
