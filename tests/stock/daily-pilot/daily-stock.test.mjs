import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { DailyStockService } from "../../../src/modules/stock/daily-pilot/application/daily-stock-service.ts"
import {
  isControlledStockEnabled,
} from "../../../src/modules/stock/controlled-stock/feature-flag.ts"

const now = "2026-07-27T12:00:00.000Z"

function article(id, overrides = {}) {
  return {
    id,
    restaurantId: "restaurant-a",
    name: id,
    categoryId: "category-a",
    baseUnit: "unit",
    packagings: [],
    lowStockThreshold: 5,
    outOfStockThreshold: 0,
    trackingMode: "CONTROLLED",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "actor",
    updatedBy: "actor",
    ...overrides,
  }
}

function balance(articleId, quantity, overrides = {}) {
  return {
    restaurantId: "restaurant-a",
    articleId,
    quantity,
    unit: "unit",
    version: 1,
    lastOperationAt: "2026-07-27T08:00:00.000Z",
    lastControlAt: "2026-07-26T08:00:00.000Z",
    ...overrides,
  }
}

function operation(id, articleId, type, variation, overrides = {}) {
  return {
    id,
    restaurantId: "restaurant-a",
    articleId,
    type,
    quantityBefore: 10,
    variation,
    quantityAfter: 10 + variation,
    unit: "unit",
    occurredAt: "2026-07-27T08:30:00.000Z",
    createdAt: "2026-07-27T08:30:00.000Z",
    createdBy: "actor",
    idempotencyKey: id,
    expectedVersion: 0,
    ...overrides,
  }
}

function source(overrides = {}) {
  const articles = [
    article("Eau", { trackingMode: "AUTOMATIC_SIMPLE" }),
    article("Riz", { baseUnit: "kg" }),
    article("Farine", { baseUnit: "kg" }),
  ]
  return {
    articles,
    balances: {
      Eau: balance("Eau", 0),
      Riz: balance("Riz", 3),
      Farine: balance("Farine", 20),
    },
    operations: [],
    categories: { "category-a": "Épicerie" },
    ...overrides,
  }
}

test("affiche les articles en rupture", () => {
  const dashboard = new DailyStockService().buildDashboard(source(), now)
  assert.deepEqual(dashboard.outOfStock.map((item) => item.article.name), ["Eau"])
})

test("affiche les articles sous le seuil faible sans inclure les ruptures", () => {
  const dashboard = new DailyStockService().buildDashboard(source(), now)
  assert.deepEqual(dashboard.lowStock.map((item) => item.article.name), ["Riz"])
})

test("calcule les alertes avec une priorité explicite", () => {
  const dashboard = new DailyStockService().buildDashboard(source(), now)
  assert.equal(dashboard.alerts[0].type, "OUT_OF_STOCK")
  assert.equal(dashboard.alerts[0].priority, "CRITICAL")
  assert.ok(dashboard.alerts.every((alert) => alert.status === "ACTIVE"))
})

test("résout puis fait disparaître une alerte après correction", () => {
  const service = new DailyStockService()
  const before = service.buildDashboard(source(), now).alerts
  const corrected = source({
    balances: {
      Eau: balance("Eau", 20),
      Riz: balance("Riz", 20),
      Farine: balance("Farine", 20),
    },
  })
  const after = service.buildDashboard(corrected, now).alerts
  const reconciled = service.reconcileAlerts(before, after, now)
  assert.equal(after.some((item) => item.type === "OUT_OF_STOCK"), false)
  assert.equal(reconciled.find((item) => item.id === "OUT_OF_STOCK:Eau")?.status, "RESOLVED")
})

test("classe la vue réapprovisionnement par urgence", () => {
  const rows = new DailyStockService().replenishment(source(), now)
  assert.deepEqual(rows.map((item) => item.article.name), ["Eau", "Riz"])
})

test("produit une chronologie lisible et triée", () => {
  const operations = [
    operation("loss", "Eau", "PERTE", -2, { occurredAt: "2026-07-27T10:15:00.000Z" }),
    operation("supply", "Farine", "APPROVISIONNEMENT", 50),
  ]
  const entries = new DailyStockService().timeline(source({ operations }))
  assert.equal(entries[0].title, "Perte")
  assert.match(entries[1].detail, /\+50 unit/)
})

test("recherche par nom, catégorie, mode et état", () => {
  const service = new DailyStockService()
  assert.deepEqual(service.search(source(), { query: "epicerie" }, now).length, 3)
  assert.deepEqual(service.search(source(), { query: "automatique" }, now).map((item) => item.article.name), ["Eau"])
  assert.deepEqual(service.search(source(), { query: "rupture" }, now).map((item) => item.article.name), ["Eau"])
})

test("applique tous les filtres officiels", () => {
  const service = new DailyStockService()
  const augmented = source({
    articles: [
      ...source().articles,
      article("Sans suivi", { trackingMode: "NONE" }),
      article("Archive", { status: "archived" }),
    ],
  })
  assert.equal(service.search(augmented, { filter: "OUT_OF_STOCK" }, now).length, 1)
  assert.equal(service.search(augmented, { filter: "LOW" }, now).length, 1)
  assert.equal(service.search(augmented, { filter: "NORMAL" }, now).length, 1)
  assert.equal(service.search(augmented, { filter: "CONTROLLED" }, now).length, 2)
  assert.equal(service.search(augmented, { filter: "AUTOMATIC_SIMPLE" }, now).length, 1)
  assert.equal(service.search(augmented, { filter: "NONE" }, now).length, 1)
  assert.equal(service.search(augmented, { filter: "ARCHIVED" }, now).length, 1)
})

test("rapports simples filtrent type et période", () => {
  const operations = [
    operation("supply", "Farine", "APPROVISIONNEMENT", 50),
    operation("loss", "Eau", "PERTE", -2, { occurredAt: "2026-07-20T10:00:00.000Z" }),
    operation("control", "Riz", "CONTROLE_PHYSIQUE", -3, { varianceType: "MANQUE" }),
  ]
  const service = new DailyStockService()
  assert.equal(service.report(source({ operations }), { type: "SUPPLIES" }, now).operations.length, 1)
  assert.equal(service.report(source({ operations }), { type: "LOSSES", from: "2026-07-21" }, now).operations.length, 0)
  assert.equal(service.report(source({ operations }), { type: "VARIANCES" }, now).operations.length, 1)
})

test("les permissions masquent les actions et aucun coût n’est affiché", () => {
  const ui = readFileSync(new URL(
    "../../../src/modules/stock/daily-pilot/ui/DailyStockScreen.tsx",
    import.meta.url
  ), "utf8")
  assert.match(ui, /canPerformControlledStockAction/)
  assert.doesNotMatch(ui, /totalCost|unitCost|referenceCost/)
})

test("le tableau de bord respecte le Feature Flag actif et inactif", () => {
  assert.equal(isControlledStockEnabled("restaurant-a", { enabled: false }), false)
  assert.equal(isControlledStockEnabled("restaurant-a", { enabled: true }), true)
  assert.equal(isControlledStockEnabled("restaurant-b", {
    enabled: true,
    restaurantAllowlist: ["restaurant-a"],
  }), false)
})

test("l’interface est responsive et ne référence aucun flux interdit", () => {
  const ui = readFileSync(new URL(
    "../../../src/modules/stock/daily-pilot/ui/DailyStockScreen.tsx",
    import.meta.url
  ), "utf8")
  const service = readFileSync(new URL(
    "../../../src/modules/stock/daily-pilot/application/daily-stock-service.ts",
    import.meta.url
  ), "utf8")
  assert.match(ui, /grid-cols-2/)
  assert.match(ui, /md:grid-cols|sm:grid-cols|lg:grid-cols/)
  assert.doesNotMatch(`${ui}\n${service}`, /\b(POS|Cuisine|Commandes|recette|comptabilit[eé])\b/i)
})
