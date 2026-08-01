import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  aggregateFinancialEntries,
  diffFinancialCache,
  financialCachePatch,
} from "../../src/lib/finance/payment-ledger-domain.ts"
import {
  getFinancialSummary,
  isConfirmedFinancePayment,
} from "../../src/lib/finance/financial-summary.ts"
import { resolveFinancialSource } from "../../src/server/finance/firestore-payment-ledger.ts"

const [posSource, managerCashSource, rulesSource] = await Promise.all([
  readFile(
    new URL("../../src/app/(dashboard)/pos/components/POSClient.tsx", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../../src/app/(manager)/manager/caisse/page.tsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
])

const payment = (overrides = {}) => ({
  id: "payment-1",
  orderId: "order-1",
  sessionId: "session-1",
  cashierId: "cashier-1",
  source: "pos",
  type: "cash",
  provider: null,
  amount: 1000,
  status: "confirmed",
  entryType: "payment",
  idempotencyKey: "payment-key-1",
  ...overrides,
})

test("cash et Mobile Money utilisent le même agrégat pour chaque canal", () => {
  const sources = ["pos", "qr_table", "delivery", "legacy"]
  const entries = sources.flatMap((source, index) => [
    payment({
      id: `${source}-cash`,
      idempotencyKey: `${source}-cash`,
      orderId: `${source}-cash-order`,
      source,
      amount: 100 + index,
    }),
    payment({
      id: `${source}-mobile`,
      idempotencyKey: `${source}-mobile`,
      orderId: `${source}-mobile-order`,
      source,
      type: "mobile_money",
      provider: "orange_money",
      amount: 200 + index,
    }),
  ])
  const aggregate = aggregateFinancialEntries(entries)
  assert.equal(aggregate.totalPayments, 8)
  assert.equal(aggregate.totalOrders, 8)
  assert.equal(aggregate.totalCash, 406)
  assert.equal(aggregate.totalMobileMoney, 806)
  assert.equal(aggregate.totalConfirmed, 1212)
  assert.deepEqual(aggregate.totalsBySource, {
    pos: 300,
    qr_table: 302,
    delivery: 304,
    legacy: 306,
  })
})

test("le serveur détermine le canal sans faire confiance au navigateur", () => {
  assert.equal(resolveFinancialSource({ orderType: "delivery", source: "client" }), "delivery")
  assert.equal(resolveFinancialSource({ serviceMode: "dine_in", source: "client" }), "qr_table")
  assert.equal(resolveFinancialSource({ source: "pos" }), "pos")
  assert.equal(resolveFinancialSource({ type: "takeaway" }), "legacy")
})

test("une même identité idempotente n'est jamais comptabilisée deux fois", () => {
  const entry = payment()
  const aggregate = aggregateFinancialEntries([entry, { ...entry, id: "duplicate" }])
  assert.equal(aggregate.totalConfirmed, 1000)
  assert.equal(aggregate.totalPayments, 1)
})

test("un remboursement cash diminue le net sans modifier la preuve originale", () => {
  const original = payment()
  const refund = payment({
    id: "refund-1",
    idempotencyKey: "refund-key-1",
    entryType: "refund",
    parentPaymentId: original.id,
    amount: 400,
  })
  const aggregate = aggregateFinancialEntries([original, refund])
  assert.equal(aggregate.totalCash, 600)
  assert.equal(aggregate.totalConfirmed, 600)
  assert.equal(aggregate.totalRefunded, 400)
  assert.equal(aggregate.totalRefunds, 1)
  assert.equal(aggregate.totalOrders, 1)
})

test("un remboursement Mobile Money conserve le provider et peut solder la commande", () => {
  const original = payment({
    type: "mobile_money",
    provider: "moov_money",
    amount: 2500,
  })
  const refund = payment({
    id: "refund-mobile",
    idempotencyKey: "refund-mobile",
    entryType: "refund",
    parentPaymentId: original.id,
    type: "mobile_money",
    provider: "moov_money",
    amount: 2500,
  })
  const aggregate = aggregateFinancialEntries([original, refund])
  assert.equal(aggregate.totalMobileMoney, 0)
  assert.equal(aggregate.totalsByProvider.moov_money, 0)
  assert.equal(aggregate.totalConfirmed, 0)
  assert.equal(aggregate.totalOrders, 0)
})

test("pending, failed et voided n'ont aucun effet financier", () => {
  const aggregate = aggregateFinancialEntries([
    payment({ id: "pending", idempotencyKey: "pending", status: "pending" }),
    payment({ id: "failed", idempotencyKey: "failed", status: "failed" }),
    payment({ id: "voided", idempotencyKey: "voided", status: "voided" }),
  ])
  assert.equal(aggregate.totalConfirmed, 0)
  assert.equal(aggregate.totalPayments, 0)
  assert.deepEqual(aggregate.statusCounts, { pending: 1, failed: 1, voided: 1 })
})

test("la réconciliation détecte puis accepte un cache réparé", () => {
  const aggregate = aggregateFinancialEntries([payment()])
  const divergent = {
    totalCash: 2000,
    totalMobile: 0,
    totalMobileMoney: 0,
    totalConfirmed: 2000,
    totalPayments: 2,
    totalOrders: 2,
    totalRefunded: 0,
    totalRefunds: 0,
    totalsByProvider: {},
    totalsBySource: { pos: 2000, qr_table: 0, delivery: 0, legacy: 0 },
  }
  assert.deepEqual(Object.keys(diffFinancialCache(divergent, aggregate)).sort(), [
    "totalCash",
    "totalConfirmed",
    "totalOrders",
    "totalPayments",
    "totalsBySource",
  ])
  assert.deepEqual(diffFinancialCache(financialCachePatch(aggregate), aggregate), {})
})

test("les rapports soustraient les remboursements confirmés", () => {
  const original = payment({ confirmedAt: new Date("2026-07-30T12:00:00Z") })
  const refund = payment({
    id: "refund-report",
    idempotencyKey: "refund-report",
    entryType: "refund",
    parentPaymentId: original.id,
    amount: 250,
    confirmedAt: new Date("2026-07-30T13:00:00Z"),
  })
  const summary = getFinancialSummary({
    payments: [original, refund],
    businessTimeZone: "UTC",
    nowMs: new Date("2026-07-30T14:00:00Z").getTime(),
  })
  assert.equal(isConfirmedFinancePayment(refund), true)
  assert.equal(summary.deposits, 750)
  assert.equal(summary.confirmedPaymentCount, 1)
})

test("les anciens marqueurs refunded/voided restent exclus des rapports", () => {
  assert.equal(isConfirmedFinancePayment(payment({ refunded: true })), false)
  assert.equal(isConfirmedFinancePayment(payment({ voidedAt: new Date() })), false)
})

test("les surfaces POS et Manager confirment exclusivement par la commande serveur", () => {
  assert.match(posSource, /command: "CONFIRM_ORDER_PAYMENT"/)
  assert.match(managerCashSource, /confirmTableSessionPayment\(/)
  assert.doesNotMatch(posSource, /\.createPayment\(/)
  assert.doesNotMatch(managerCashSource, /\.createPayment\(/)
})

test("les Rules maintiennent la lecture legacy mais bloquent les mutations client du ledger", () => {
  const paymentBlock =
    rulesSource.match(/match \/payments\/\{paymentId\}[\s\S]*?match \/treasuryAccounts/)?.[0] ||
    ""
  assert.match(paymentBlock, /allow get, list:/)
  assert.match(paymentBlock, /allow create, update: if false/)
  assert.match(paymentBlock, /allow delete: if false/)
})
