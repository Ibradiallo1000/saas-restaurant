import assert from "node:assert/strict"
import test from "node:test"

import { isProductAllowedAtPosStation, resolvePosCatalogScope } from "../../src/lib/pos-stations.ts"
import { buildCanonicalOrder } from "../../src/server/orders/create/builder.ts"
import { EMPTY_POS_FINANCIAL_FILTERS, matchesPosFinancialFilters, resolveFinancialPosStation } from "../../src/lib/finance/pos-report-filters.ts"

const products = new Map([
  ["meal", { id: "meal", name: "Plat", price: 1000, active: true, categoryId: "food", preparationMode: "kitchen", options: [], reviewsEnabled: false }],
  ["drink", { id: "drink", name: "Boisson", price: 500, active: true, categoryId: "drinks", preparationMode: "bar", options: [], reviewsEnabled: false }],
])
const categories = new Map([
  ["food", { id: "food", name: "Plats", active: true, preparationMode: "kitchen" }],
  ["drinks", { id: "drinks", name: "Boissons", active: true, preparationMode: "bar" }],
])
const restaurant = { id: "r1", name: "R", active: true, currency: "FCFA", taxRate: 0, pricesIncludeTax: false, deliveryFee: 0, publicOrderingOpen: true }
const scope = (overrides = {}) => ({ catalogMode: "ALL", allowedCategoryIds: [], allowedProductIds: [], excludedProductIds: [], ...overrides })
const posSession = (catalogScope = scope()) => ({ id: "s1", cashierId: "cashier", active: true, stationId: "main", stationName: "Principale", stationCode: "MAIN", stationActive: true, catalogScope })
const request = (channel = "pos", items = [{ clientLineId: "l1", productId: "meal", quantity: 1, options: [], instructions: null }]) => ({ schemaVersion: 1, channel, serviceMode: "takeaway", clientRequestId: "req", items, tableContext: null, customer: null, delivery: null, cashSessionId: channel === "pos" ? "s1" : null, notes: null })
const plan = (channel = "pos", items, session = posSession()) => buildCanonicalOrder({ restaurantId: "r1", request: request(channel, items), principal: channel === "pos" ? { kind: "staff", uid: "cashier", roles: ["cashier"] } : { kind: "public", uid: "public", roles: [] }, authorities: { restaurant, products, categories, tableSession: null, posSession: channel === "pos" ? session : null }, orderId: "order-12345678", orderItemIds: (items || request(channel).items).map((_, index) => `i${index}`), now: new Date("2026-08-01T10:00:00Z") })

test("DEFAULT et ALL vendent tout sauf les exclusions", () => {
  assert.equal(isProductAllowedAtPosStation(null, { id: "meal", categoryId: "food" }), true)
  assert.equal(isProductAllowedAtPosStation(scope({ excludedProductIds: ["meal"] }), { id: "meal", categoryId: "food" }), false)
})

test("RESTRICTED accepte catégorie ou produit explicite et l’exclusion reste prioritaire", () => {
  assert.equal(isProductAllowedAtPosStation(scope({ catalogMode: "RESTRICTED", allowedCategoryIds: ["food"] }), { id: "meal", categoryId: "food" }), true)
  assert.equal(isProductAllowedAtPosStation(scope({ catalogMode: "RESTRICTED", allowedProductIds: ["drink"] }), { id: "drink", categoryId: "drinks" }), true)
  assert.equal(isProductAllowedAtPosStation(scope({ catalogMode: "RESTRICTED", allowedCategoryIds: ["food"], excludedProductIds: ["meal"] }), { id: "meal", categoryId: "food" }), false)
})

test("la commande POS porte l’origine du poste et refuse toute ligne liée interdite", () => {
  const created = plan()
  assert.equal(created.parent.originPosStationId, "main")
  assert.equal(created.parent.originPosStationName, "Principale")
  assert.equal(created.parent.cashierId, "cashier")
  assert.throws(() => plan("pos", [
    { clientLineId: "main", productId: "meal", quantity: 1, options: [], instructions: null },
    { clientLineId: "linked", productId: "drink", quantity: 1, options: [], instructions: null },
  ], posSession(scope({ catalogMode: "RESTRICTED", allowedProductIds: ["meal"] }))), (error) => error.code === "PRODUCT_NOT_ALLOWED_AT_STATION")
})

test("une commande publique ne reçoit jamais de poste d’origine", () => {
  const created = plan("public_takeaway")
  assert.equal("originPosStationId" in created.parent, false)
  assert.equal(created.parent.cashSessionId, null)
})

test("l’instantané de session est la source officielle", () => {
  const session = { posCatalogScopeSnapshot: { mode: "RESTRICTED", allowedProductIds: ["meal"], allowedCategoryIds: [], excludedProductIds: [] } }
  assert.deepEqual(resolvePosCatalogScope(session), { catalogMode: "RESTRICTED", allowedProductIds: ["meal"], allowedCategoryIds: [], excludedProductIds: [] })
})

test("les rapports filtrent poste, caissier, session, canal et paiement avec fallback DEFAULT", () => {
  assert.deepEqual(resolveFinancialPosStation({}), { id: "DEFAULT", name: "Caisse principale", code: "DEFAULT" })
  const base = { movement: { sessionId: "s1" }, session: { id: "s1", cashierId: "c1", posStationId: "main" }, payments: [{ source: "qr_table", type: "cash" }] }
  for (const filters of [
    { ...EMPTY_POS_FINANCIAL_FILTERS, stationId: "main" },
    { ...EMPTY_POS_FINANCIAL_FILTERS, cashierId: "c1" },
    { ...EMPTY_POS_FINANCIAL_FILTERS, sessionId: "s1" },
    { ...EMPTY_POS_FINANCIAL_FILTERS, channel: "qr_table" },
    { ...EMPTY_POS_FINANCIAL_FILTERS, paymentMethod: "cash" },
  ]) assert.equal(matchesPosFinancialFilters({ ...base, filters }), true)
  assert.equal(matchesPosFinancialFilters({ ...base, filters: { ...EMPTY_POS_FINANCIAL_FILTERS, stationId: "bar" } }), false)
})
