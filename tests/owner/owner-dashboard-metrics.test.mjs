import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildOwnerVariation,
  calculateOwnerAverageOrder,
  getConfirmedPaymentOrderIds,
  getOwnerPeriodRanges,
  isOwnerAcquiredOrder,
  resolveOwnerRevenue,
  resolveOwnerTreasuryBalance,
} from "../../src/modules/owner-dashboard/owner-dashboard-metrics.ts"

const range = (start, end) => ({ start: new Date(start), end: new Date(end) })
const timestamp = (value) => ({ toDate: () => new Date(value) })

test("aujourd'hui et hier couvrent deux journées métier équivalentes", () => {
  const periods = getOwnerPeriodRanges({ type: "today" }, "Africa/Abidjan", new Date("2026-01-15T12:00:00Z"))
  assert.equal(periods.current.start.toISOString(), "2026-01-15T00:00:00.000Z")
  assert.equal(periods.current.end.toISOString(), "2026-01-15T23:59:59.999Z")
  assert.equal(periods.previous.start.toISOString(), "2026-01-14T00:00:00.000Z")
  assert.equal(periods.previous.end.toISOString(), "2026-01-14T23:59:59.999Z")
})

test("semaine, mois et période personnalisée conservent la même durée précédente", () => {
  const now = new Date("2026-03-20T12:00:00Z")
  for (const filter of [
    { type: "week" },
    { type: "month" },
    { type: "custom", startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 10) },
  ]) {
    const periods = getOwnerPeriodRanges(filter, "Africa/Bamako", now)
    const currentDays = Math.round((periods.current.end - periods.current.start + 1) / 86_400_000)
    const previousDays = Math.round((periods.previous.end - periods.previous.start + 1) / 86_400_000)
    assert.equal(currentDays, previousDays)
  }
})

test("les limites de fuseau et le changement d'année utilisent le jour du restaurant", () => {
  const periods = getOwnerPeriodRanges({ type: "today" }, "Pacific/Kiritimati", new Date("2025-12-31T10:30:00Z"))
  assert.equal(periods.current.start.toISOString(), "2025-12-31T10:00:00.000Z")
  assert.equal(periods.current.end.toISOString(), "2026-01-01T09:59:59.999Z")
  assert.equal(periods.previous.start.toISOString(), "2025-12-30T10:00:00.000Z")
})

test("le CA utilise les paiements confirmés et exclut les paiements non confirmés ou partiels", () => {
  const currentRange = range("2026-01-02T00:00:00Z", "2026-01-02T23:59:59Z")
  const previousRange = range("2026-01-01T00:00:00Z", "2026-01-01T23:59:59Z")
  const result = resolveOwnerRevenue({
    payments: [
      { status: "confirmed", amount: 1200, confirmedAt: timestamp("2026-01-02T10:00:00Z") },
      { status: "pending", amount: 9000, confirmedAt: timestamp("2026-01-02T11:00:00Z") },
      { status: "partial", amount: 500, confirmedAt: timestamp("2026-01-02T12:00:00Z") },
      { status: "confirmed", amount: 800, confirmedAt: timestamp("2026-01-01T10:00:00Z") },
    ],
    currentOrders: [{ total: 9999 }],
    previousOrders: [{ total: 9999 }],
    currentRange,
    previousRange,
  })
  assert.equal(result.current, 1200)
  assert.equal(result.previous, 800)
  assert.equal(result.source, "confirmed-payments")
  assert.equal(result.quality, "complete")
})

test("le CA déduplique les paiements et soustrait les remboursements confirmés", () => {
  const result = resolveOwnerRevenue({
    payments: [
      { id: "p1", idempotencyKey: "same", status: "confirmed", amount: 2000, confirmedAt: timestamp("2026-01-02T10:00:00Z") },
      { id: "p2", idempotencyKey: "same", status: "confirmed", amount: 2000, confirmedAt: timestamp("2026-01-02T10:00:00Z") },
      { id: "r1", status: "confirmed", entryType: "refund", parentPaymentId: "p1", amount: 500, confirmedAt: timestamp("2026-01-02T12:00:00Z") },
    ],
    currentOrders: [],
    previousOrders: [],
    currentRange: range("2026-01-02T00:00:00Z", "2026-01-02T23:59:59Z"),
    previousRange: range("2026-01-01T00:00:00Z", "2026-01-01T23:59:59Z"),
  })
  assert.equal(result.current, 1500)
})

test("les anciennes commandes sans paiement utilisent un fallback explicite", () => {
  const result = resolveOwnerRevenue({
    payments: [],
    currentOrders: [{ total: 1000 }, { totalAmount: 500 }],
    previousOrders: [{ total: 750 }],
    currentRange: range("2026-01-02", "2026-01-03"),
    previousRange: range("2026-01-01", "2026-01-02"),
  })
  assert.deepEqual([result.current, result.previous], [1500, 750])
  assert.equal(result.source, "legacy-orders-fallback")
  assert.equal(result.quality, "estimated")
})

test("absence totale et fallback partiel ne prétendent pas être complets", () => {
  const empty = resolveOwnerRevenue({ payments: [], currentOrders: [], previousOrders: [], currentRange: range("2026-01-02", "2026-01-03"), previousRange: range("2026-01-01", "2026-01-02") })
  const partial = resolveOwnerRevenue({ payments: [], currentOrders: [{ total: 100 }], previousOrders: [], currentRange: range("2026-01-02", "2026-01-03"), previousRange: range("2026-01-01", "2026-01-02"), currentOrdersPartial: true })
  assert.equal(empty.quality, "unavailable")
  assert.equal(partial.quality, "partial")
})

test("les mêmes statuts définissent les commandes acquises sur les deux périodes", () => {
  const paidIds = getConfirmedPaymentOrderIds([{ status: "confirmed", orderId: "ledger-paid" }])
  assert.equal(isOwnerAcquiredOrder({ id: "paid", paymentStatus: "paid" }, paidIds), true)
  assert.equal(isOwnerAcquiredOrder({ id: "ledger-paid", paymentStatus: "pending" }, paidIds), true)
  assert.equal(isOwnerAcquiredOrder({ id: "pending", paymentStatus: "pending" }, paidIds), false)
  assert.equal(isOwnerAcquiredOrder({ id: "partial", paymentStatus: "partial" }, paidIds), false)
  assert.equal(isOwnerAcquiredOrder({ id: "legacy", paidAt: timestamp("2026-01-01") }, paidIds), true)
})

test("le panier moyen gère le calcul normal et zéro commande", () => {
  assert.equal(calculateOwnerAverageOrder(1500, 3), 500)
  assert.equal(calculateOwnerAverageOrder(1500, 0), 0)
  assert.equal(calculateOwnerAverageOrder(Number.NaN, 2), 0)
})

test("les variations gèrent hausse, baisse, égalité, zéro et données partielles", () => {
  assert.equal(buildOwnerVariation(120, 100).trend, "up")
  assert.equal(buildOwnerVariation(80, 100).trend, "down")
  assert.equal(buildOwnerVariation(100, 100).trend, "stable")
  assert.equal(buildOwnerVariation(100, 0).percent, null)
  assert.equal(buildOwnerVariation(100, 90, "partial").percent, null)
})

test("la trésorerie privilégie les comptes et explicite le fallback mouvements", () => {
  const accounts = resolveOwnerTreasuryBalance([{ balance: 1500 }, { balance: 500 }], [{ type: "deposit", amount: 9999 }])
  const fallback = resolveOwnerTreasuryBalance([], [
    { type: "deposit", amount: 2000 },
    { type: "expense", amount: 300 },
    { type: "transfer", amount: 200 },
  ])
  assert.deepEqual([accounts.balance, accounts.source, accounts.quality], [2000, "treasury-accounts", "complete"])
  assert.deepEqual([fallback.balance, fallback.source, fallback.quality], [1700, "cash-movements", "estimated"])
})

test("le Dashboard détecte 501 commandes et déduplique les alertes de stock par article", () => {
  const dashboard = readFileSync(new URL("../../src/app/owner/page.tsx", import.meta.url), "utf8")
  assert.equal((dashboard.match(/limit\(501\)/g) || []).length, 2)
  assert.match(dashboard, /currentOrdersResult\.data\?\.length \|\| 0\) > 500/)
  assert.match(dashboard, /const criticalItemIds = new Set<string>\(\)/)
  assert.match(dashboard, /inventoryAlerts: inventoryAlerts \|\| \[\]/)
  assert.match(dashboard, /quantity <= Number\(item\.lowStockThreshold/)
  assert.match(dashboard, /activeOrders: liveOrders/)
  assert.match(dashboard, /computeLiveOverview\(liveOrders\)/)
})
