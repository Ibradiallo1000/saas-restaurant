import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  AutomaticSimpleService,
  validateAutomaticActivation,
} from "../../../src/modules/stock/automatic-simple/application/automatic-simple-service.ts"
import {
  compareStockAuthorities,
} from "../../../src/modules/stock/automatic-simple/application/authority-comparison.ts"
import {
  canPerformAutomaticAction,
} from "../../../src/modules/stock/automatic-simple/application/authorization.ts"
import { ControlledStockService } from "../../../src/modules/stock/controlled-stock/application/controlled-stock-service.ts"
import {
  buildStockPrincipal,
  InMemoryControlledStockRepository,
  setupArticles,
} from "../controlled-stock/controlled-stock-test-kit.mjs"

class AssociationRepository {
  items = new Map()
  async getById(restaurantId, id) { return structuredClone(this.items.get(`${restaurantId}:${id}`) ?? null) }
  async list(restaurantId) { return [...this.items.values()].filter((item) => item.restaurantId === restaurantId).map((item) => structuredClone(item)) }
  async listActiveByProduct(restaurantId, productId) {
    return (await this.list(restaurantId)).filter((item) => item.productId === productId && item.status === "active")
  }
  async save(item) { this.items.set(`${item.restaurantId}:${item.id}`, structuredClone(item)) }
}

class ProductLookup {
  products = new Set(["restaurant-a:product-1", "restaurant-a:product-2"])
  async exists(restaurantId, productId) { return this.products.has(`${restaurantId}:${productId}`) }
}

async function setup(overrides = {}) {
  const { articles, article } = setupArticles({
    name: "Bouteille",
    baseUnit: "unit",
    packagings: [],
    trackingMode: "AUTOMATIC_SIMPLE",
    ...overrides,
  })
  const stock = new InMemoryControlledStockRepository()
  const associations = new AssociationRepository()
  let sequence = 0
  const controlled = new ControlledStockService({
    articles,
    stock,
    now: () => "2026-07-27T10:00:00.000Z",
    createId: () => `operation-${++sequence}`,
  })
  const service = new AutomaticSimpleService({
    articles,
    stock,
    associations,
    products: new ProductLookup(),
  }, {
    now: () => "2026-07-27T10:00:00.000Z",
    createId: () => `operation-${++sequence}`,
  })
  const principal = buildStockPrincipal()
  if (overrides.initialStock !== false) {
    await controlled.recordSupply({
      restaurantId: "restaurant-a", articleId: "article-1", quantity: 10,
      unit: "unit", occurredAt: "2026-07-27T08:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "initial-stock",
    }, principal)
  }
  return { service, controlled, stock, associations, articles, article, principal }
}

function associationInput(overrides = {}) {
  return {
    restaurantId: "restaurant-a", productId: "product-1",
    articleId: "article-1", quantity: 1, unit: "unit", actorId: "actor-a",
    ...overrides,
  }
}

function event(overrides = {}) {
  return {
    restaurantId: "restaurant-a", reference: "order-1",
    status: "PAYMENT_CONFIRMED",
    lines: [{ productId: "product-1", quantity: 1 }],
    occurredAt: "2026-07-27T11:00:00.000Z", actorId: "actor-a",
    ...overrides,
  }
}

const activation = {
  enabled: true,
  restaurantAllowlist: ["restaurant-a"],
  articleAllowlist: ["article-1"],
}

async function linked() {
  const context = await setup()
  await context.service.createAssociation(associationInput(), context.principal)
  return context
}

test("01 association valide", async () => {
  const { service, principal } = await setup()
  assert.equal((await service.createAssociation(associationInput(), principal)).status, "active")
})

test("02 association avec Article CONTROLLED refusée", async () => {
  const { service, principal } = await setup({ trackingMode: "CONTROLLED" })
  await assert.rejects(service.createAssociation(associationInput(), principal), { code: "CONTROLLED_STOCK_TRACKING_DISABLED" })
})

test("03 association avec Article NONE refusée", async () => {
  const { service, principal } = await setup({ trackingMode: "NONE", initialStock: false })
  await assert.rejects(service.createAssociation(associationInput(), principal), { code: "CONTROLLED_STOCK_TRACKING_DISABLED" })
})

test("04 Article archivé refusé", async () => {
  const { service, principal } = await setup({ status: "archived", initialStock: false })
  await assert.rejects(service.createAssociation(associationInput(), principal), { code: "CONTROLLED_STOCK_ARTICLE_ARCHIVED" })
})

test("05 isolation entre restaurants", async () => {
  const { service } = await setup()
  await assert.rejects(service.createAssociation(
    associationInput({ restaurantId: "restaurant-b" }),
    buildStockPrincipal("restaurant-a")
  ), { code: "CONTROLLED_STOCK_RESTAURANT_MISMATCH" })
})

test("06 quantité nulle refusée", async () => {
  const { service, principal } = await setup()
  await assert.rejects(service.createAssociation(associationInput({ quantity: 0 }), principal))
})

test("07 quantité négative refusée", async () => {
  const { service, principal } = await setup()
  await assert.rejects(service.createAssociation(associationInput({ quantity: -1 }), principal))
})

test("08 déduction automatique valide", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event(), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 9)
})

test("09 déduction de plusieurs unités", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event({ lines: [{ productId: "product-1", quantity: 3 }] }), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 7)
})

test("10 rejeu idempotent", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event(), principal, activation)
  await service.processConfirmedSale(event(), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 9)
})

test("11 double événement sans double retrait", async () => {
  const { service, stock, principal } = await linked()
  await Promise.all([service.processConfirmedSale(event(), principal, activation), service.processConfirmedSale(event(), principal, activation)])
  assert.equal(stock.writes, 2)
})

test("12 événement non confirmé ignoré", async () => {
  const { service, stock, principal } = await linked()
  assert.equal((await service.processConfirmedSale(event({ status: "DRAFT" }), principal, activation)).ignored, true)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("13 commande annulée avant déduction ignorée", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event({ status: "CANCELLED" }), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("14 compensation valide", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event(), principal, activation)
  await service.compensate(event({ reference: "refund-1" }), "order-1", principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("15 double compensation refusée par idempotence", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event(), principal, activation)
  await service.compensate(event({ reference: "refund-1" }), "order-1", principal, activation)
  await service.compensate(event({ reference: "refund-1" }), "order-1", principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("16 lien compensation/opération initiale", async () => {
  const { service, stock, principal } = await linked()
  const deduction = await service.processConfirmedSale(event(), principal, activation)
  await service.compensate(event({ reference: "refund-1" }), "order-1", principal, activation)
  const compensation = stock.operations.find((item) => item.type === "AUTOMATIC_COMPENSATION")
  assert.equal(compensation.originalOperationId, deduction.operations[0])
})

test("17 stock insuffisant sans quantité négative", async () => {
  const { service, stock, principal } = await linked()
  const result = await service.processConfirmedSale(event({ lines: [{ productId: "product-1", quantity: 20 }] }), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
  assert.equal(result.anomalies[0].type, "INSUFFICIENT_STOCK")
})

test("18 vente non bloquée", async () => {
  const { service, principal } = await linked()
  const result = await service.processConfirmedSale(event({ lines: [{ productId: "product-1", quantity: 20 }] }), principal, activation)
  assert.equal(result.saleAllowed, true)
})

test("19 alerte d’anomalie calculée", async () => {
  const { service, principal } = await linked()
  const result = await service.processConfirmedSale(event({ lines: [{ productId: "product-1", quantity: 99 }] }), principal, activation)
  assert.match(result.anomalies[0].message, /Stock insuffisant/)
})

test("20 aucune déduction sur CONTROLLED", async () => {
  const { controlled, principal } = await setup({ trackingMode: "CONTROLLED" })
  await assert.rejects(controlled.recordAutomaticDeduction({
    restaurantId: "restaurant-a", articleId: "article-1", productId: "product-1",
    quantity: 1, unit: "unit", businessReference: "order",
    occurredAt: "2026-07-27T11:00:00.000Z", actorId: "actor-a", idempotencyKey: "auto",
  }, principal))
})

test("21 aucune déduction sur NONE", async () => {
  const { controlled, principal } = await setup({ trackingMode: "NONE", initialStock: false })
  await assert.rejects(controlled.recordAutomaticDeduction({
    restaurantId: "restaurant-a", articleId: "article-1", productId: "product-1",
    quantity: 1, unit: "unit", businessReference: "order",
    occurredAt: "2026-07-27T11:00:00.000Z", actorId: "actor-a", idempotencyKey: "auto",
  }, principal))
})

test("22 association désactivée ignorée", async () => {
  const { service, stock, principal } = await linked()
  await service.disableAssociation("restaurant-a", "product-1--article-1", "actor-a", principal)
  await service.processConfirmedSale(event(), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("23 association modifiée prise en compte", async () => {
  const { service, stock, principal } = await linked()
  await service.updateAssociation("restaurant-a", "product-1--article-1", { quantity: 2, unit: "unit", actorId: "actor-a" }, principal)
  await service.processConfirmedSale(event(), principal, activation)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 8)
})

test("24 permissions positives", () => {
  assert.equal(canPerformAutomaticAction(buildStockPrincipal(), "create_association", "restaurant-a"), true)
})

test("25 permissions négatives", () => {
  assert.equal(canPerformAutomaticAction(buildStockPrincipal("restaurant-a", "employee"), "create_association", "restaurant-a"), false)
})

test("26 coûts masqués", () => {
  const source = readFileSync(new URL("../../../src/modules/stock/automatic-simple/application/automatic-simple-service.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /totalCost|unitCost|referenceCost/)
})

test("27 historique des déductions", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event(), principal, activation)
  assert.equal(stock.operations.at(-1).type, "AUTOMATIC_DEDUCTION")
})

test("28 historique des compensations", async () => {
  const { service, stock, principal } = await linked()
  await service.processConfirmedSale(event(), principal, activation)
  await service.compensate(event({ reference: "refund" }), "order-1", principal, activation)
  assert.equal(stock.operations.at(-1).type, "AUTOMATIC_COMPENSATION")
})

const legacy = [
  { restaurantId: "restaurant-a", articleId: "article-1", legacyId: "legacy-1", legacyName: "Bouteille", quantity: 8, source: "inventory.quantity" },
]
const v2 = [
  { restaurantId: "restaurant-a", articleId: "article-1", articleName: "Bouteille", quantity: 10 },
]

test("29 comparaison ancien/V2 en lecture seule", () => {
  const input = structuredClone(legacy)
  compareStockAuthorities("restaurant-a", input, v2, "2026-07-27")
  assert.deepEqual(input, legacy)
})

test("30 détection d’écart", () => {
  assert.equal(compareStockAuthorities("restaurant-a", legacy, v2, "now")[0].status, "DIVERGENT")
})

test("31 détection de doublon", () => {
  assert.equal(compareStockAuthorities("restaurant-a", [...legacy, { ...legacy[0], legacyId: "legacy-2" }], v2, "now")[0].status, "DUPLICATE")
})

test("32 détection d’Article non associé", () => {
  assert.equal(compareStockAuthorities("restaurant-a", [{ ...legacy[0], articleId: undefined }], v2, "now")[0].status, "UNASSOCIATED")
})

test("33 activation pilote autorisée", async () => {
  const { associations, principal, service } = await linked()
  const links = await service.listAssociations("restaurant-a", principal)
  assert.equal(validateAutomaticActivation({
    restaurantId: "restaurant-a", articleId: "article-1", trackingMode: "AUTOMATIC_SIMPLE",
    status: "active", hasValidBalance: true, associations: links, configuration: activation,
  }).allowed, true)
})

test("33b une allowlist article vide active tous les articles compatibles du restaurant pilote", async () => {
  const { principal, service, stock } = await linked()
  await service.processConfirmedSale(
    event(),
    principal,
    { ...activation, articleAllowlist: [] }
  )
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 9)
})

test("34 activation hors pilote refusée", () => {
  assert.equal(validateAutomaticActivation({
    restaurantId: "restaurant-b", articleId: "article-1", trackingMode: "AUTOMATIC_SIMPLE",
    status: "active", hasValidBalance: true, associations: [], configuration: activation,
  }).allowed, false)
})

test("35 activation avec ambiguïté refusée", () => {
  const duplicate = { id: "1", restaurantId: "restaurant-a", productId: "product-1", articleId: "article-1", quantity: 1, unit: "unit", status: "active", createdAt: "x", createdBy: "x", updatedAt: "x", updatedBy: "x" }
  assert.equal(validateAutomaticActivation({
    restaurantId: "restaurant-a", articleId: "article-1", trackingMode: "AUTOMATIC_SIMPLE",
    status: "active", hasValidBalance: true, associations: [duplicate, { ...duplicate, id: "2" }], configuration: activation,
  }).allowed, false)
})

test("36 rollback par Feature Flag", async () => {
  const { service, stock, principal } = await linked()
  const result = await service.processConfirmedSale(event(), principal, { ...activation, enabled: false })
  assert.equal(result.ignored, true)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("37 absence de double écriture", () => {
  const source = readFileSync(new URL("../../../src/modules/stock/automatic-simple/application/automatic-simple-service.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /inventoryItems|stockEstimated|COLLECTION_NAMES\\.INVENTORY/)
})

test("38 aucune recette introduite", () => {
  const source = readFileSync(new URL("../../../src/modules/stock/automatic-simple/application/automatic-simple-service.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /\\b(recette|recipe|ingredient)\\b/i)
})

test("39 contrats de l’événement servi et compensation explicites", () => {
  const source = readFileSync(new URL("../../../src/modules/stock/automatic-simple/domain/models.ts", import.meta.url), "utf8")
  const operations = readFileSync(new URL("../../../src/modules/stock/controlled-stock/domain/models.ts", import.meta.url), "utf8")
  const trigger = readFileSync(new URL("../../../functions/src/stock-automatic-simple.ts", import.meta.url), "utf8")
  assert.match(source, /PAYMENT_CONFIRMED/)
  assert.match(operations, /originalOperationId/)
  assert.match(operations, /AUTOMATIC_COMPENSATION/)
  assert.match(trigger, /getNewlyServedLines/)
  assert.match(trigger, /servedQuantityVersion/)
  assert.doesNotMatch(trigger, /isConfirmedPaymentTransition/)
})

test("40 règles Firestore Lot 5 présentes", () => {
  const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8")
  assert.match(rules, /stockAutomaticAssociationsV2/)
  assert.match(rules, /AUTOMATIC_DEDUCTION/)
  assert.match(rules, /AUTOMATIC_COMPENSATION/)
  assert.match(rules, /allow delete: if false/)
})
