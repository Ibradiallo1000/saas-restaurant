import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8")

const [
  cashierService,
  paymentLedgerService,
  treasuryService,
  posClient,
  sessionPage,
  sessionsPage,
  managerCashPage,
  firestoreRules,
] = await Promise.all([
  read("src/services/cashier.service.ts"),
  read("src/services/payment-ledger.service.ts"),
  read("src/services/treasury.service.ts"),
  read("src/app/(dashboard)/pos/components/POSClient.tsx"),
  read("src/app/(dashboard)/pos/session/page.tsx"),
  read("src/app/(dashboard)/pos/sessions/page.tsx"),
  read("src/app/(manager)/manager/caisse/page.tsx"),
  read("firestore.rules"),
])

test("les deux clôtures actives convergent vers la commande serveur V2", () => {
  assert.match(posClient, /closeCashSessionV2\(\{/)
  assert.match(sessionsPage, /closeCashSessionV2\(\{/)
  assert.doesNotMatch(posClient, /snapshotSessionClose\(/)
  assert.doesNotMatch(sessionsPage, /cashierService\.closeShift\(/)
})

test("la clôture client historique reste disponible et explicitement dépréciée", () => {
  assert.match(cashierService, /new PaymentLedgerService\(this\.db\)/)
  assert.match(cashierService, /ledger\.snapshotSessionClose\(/)
  assert.match(cashierService, /@deprecated Compatibility-only client closure/)
  assert.match(paymentLedgerService, /@deprecated Compatibility-only close snapshot/)
  assert.match(paymentLedgerService, /where\("sessionId", "==", sessionId\)/)
  assert.match(paymentLedgerService, /where\("status", "==", "confirmed"\)/)
})

test("la validation CashierService reste caractérisée comme chemin legacy déprécié", () => {
  assert.match(cashierService, /@deprecated Legacy validation path/)
  assert.doesNotMatch(sessionsPage, /cashierService\.validateShift\(/)
  assert.match(cashierService, /`session-\$\{sessionId\}`/)
})

test("la validation manager active cible cashHandovers et TreasuryService reste compatible", () => {
  assert.match(managerCashPage, /CashHandoverReviewPanel/)
  assert.doesNotMatch(managerCashPage, /postCashSessionMovementToTreasury\(/)
  assert.match(treasuryService, /`session-\$\{input\.sessionId\}-cash`/)
  assert.match(treasuryService, /`session-\$\{input\.sessionId\}-mobile`/)
  assert.match(treasuryService, /legacyMovementRef/)
})

test("l'alias de route actuel est documenté avant inversion contrôlée", () => {
  assert.match(sessionPage, /redirect\("\/pos\/sessions"\)/)
  assert.match(sessionsPage, /export default function CashierSessionPage/)
})

test("les collections historiques et canoniques restent lisibles dans les règles", () => {
  assert.match(firestoreRules, /match \/cashierSessions\/\{sessionId\}/)
  assert.match(firestoreRules, /match \/cashSessions\/\{sessionId\}/)
  assert.match(firestoreRules, /match \/payments\/\{paymentId\}/)
  assert.match(firestoreRules, /match \/treasuryAccounts\/\{accountId\}/)
  assert.match(firestoreRules, /match \/cashMovements\/\{movementId\}/)
  assert.match(firestoreRules, /match \/cashSessionRequests\/\{requestId\}/)
})
