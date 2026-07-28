import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { ControlledStockService } from "../../../src/modules/stock/controlled-stock/application/controlled-stock-service.ts"
import {
  getControlledStockFeatureConfiguration,
  isControlledStockEnabled,
} from "../../../src/modules/stock/controlled-stock/feature-flag.ts"
import {
  InMemoryControlledStockRepository,
  buildStockPrincipal,
  setupArticles,
  supplyInput,
} from "./controlled-stock-test-kit.mjs"

function setup(articleOverrides = {}) {
  const { articles } = setupArticles(articleOverrides)
  const stock = new InMemoryControlledStockRepository()
  let sequence = 0
  const service = new ControlledStockService({
    articles,
    stock,
    now: () => "2026-01-02T12:00:00.000Z",
    createId: () => `operation-${++sequence}`,
  })
  return { articles, stock, service }
}

async function seed(service, overrides = {}) {
  return service.recordSupply(
    supplyInput(overrides),
    buildStockPrincipal()
  )
}

test("01 approvisionnement valide augmente le stock", async () => {
  const { service } = setup()
  const result = await seed(service)
  assert.equal(result.balance.quantity, 10)
  assert.equal(result.operation.type, "APPROVISIONNEMENT")
})

test("02 quantité nulle refusée", async () => {
  const { service } = setup()
  await assert.rejects(seed(service, { quantity: 0 }), {
    code: "CONTROLLED_STOCK_INVALID_INPUT",
  })
})

test("03 quantité négative refusée", async () => {
  const { service } = setup()
  await assert.rejects(seed(service, { quantity: -1 }), {
    code: "CONTROLLED_STOCK_INVALID_INPUT",
  })
})

test("04 Article archivé refusé", async () => {
  const { service } = setup({ status: "archived" })
  await assert.rejects(seed(service), {
    code: "CONTROLLED_STOCK_ARTICLE_ARCHIVED",
  })
})

test("05 unité incompatible refusée", async () => {
  const { service } = setup()
  await assert.rejects(seed(service, { unit: "l" }), {
    code: "CONTROLLED_STOCK_INCOMPATIBLE_UNIT",
  })
})

test("06 conversion par conditionnement", async () => {
  const { service } = setup()
  const result = await seed(service, {
    quantity: 2,
    packagingId: "bag-25",
  })
  assert.equal(result.balance.quantity, 50)
})

test("07 coût absent reste absent", async () => {
  const { service } = setup()
  assert.equal((await seed(service)).cost, undefined)
})

test("08 coût égal à zéro reste zéro", async () => {
  const { service } = setup()
  const result = await seed(service, { totalCost: 0 })
  assert.equal(result.cost.totalCost, 0)
  assert.equal(result.cost.unitCost, 0)
})

test("09 rejeu idempotent ne double pas", async () => {
  const { service, stock } = setup()
  await seed(service)
  const replay = await seed(service)
  assert.equal(replay.replayed, true)
  assert.equal(replay.balance.quantity, 10)
  assert.equal(stock.writes, 1)
})

test("10 double soumission concurrente ne double pas", async () => {
  const { service, stock } = setup()
  const results = await Promise.all([seed(service), seed(service)])
  assert.equal(results.filter((item) => item.replayed).length, 1)
  assert.equal(stock.writes, 1)
})

test("11 isolation entre restaurants", async () => {
  const { service } = setup()
  await assert.rejects(
    service.recordSupply(
      supplyInput(),
      buildStockPrincipal("restaurant-b")
    ),
    { code: "CONTROLLED_STOCK_RESTAURANT_MISMATCH" }
  )
})

test("12 contrôle physique sans écart", async () => {
  const { service } = setup()
  await seed(service)
  const result = await service.recordPhysicalControl(
    {
      restaurantId: "restaurant-a",
      articleId: "article-1",
      observedQuantity: 10,
      unit: "kg",
      occurredAt: "2026-01-03T10:00:00.000Z",
      actorId: "actor-a",
      idempotencyKey: "count-1",
    },
    buildStockPrincipal()
  )
  assert.equal(result.operation.varianceType, "AUCUN_ECART")
  assert.equal(result.operation.variation, 0)
})

test("13 contrôle avec manque", async () => {
  const { service } = setup()
  await seed(service)
  const result = await service.recordPhysicalControl(
    {
      restaurantId: "restaurant-a", articleId: "article-1",
      observedQuantity: 6, unit: "kg",
      occurredAt: "2026-01-03T10:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "count-short",
    },
    buildStockPrincipal()
  )
  assert.equal(result.operation.variation, -4)
  assert.equal(result.operation.varianceType, "MANQUE")
})

test("14 contrôle avec surplus", async () => {
  const { service } = setup()
  await seed(service)
  const result = await service.recordPhysicalControl(
    {
      restaurantId: "restaurant-a", articleId: "article-1",
      observedQuantity: 12, unit: "kg",
      occurredAt: "2026-01-03T10:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "count-plus",
    },
    buildStockPrincipal()
  )
  assert.equal(result.operation.variation, 2)
  assert.equal(result.operation.varianceType, "SURPLUS")
})

test("15 contrôle devient nouvelle référence", async () => {
  const { service } = setup()
  await seed(service)
  await service.recordPhysicalControl(
    {
      restaurantId: "restaurant-a", articleId: "article-1",
      observedQuantity: 7, unit: "kg",
      occurredAt: "2026-01-03T10:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "count-ref",
    },
    buildStockPrincipal()
  )
  assert.equal(
    (await service.getCurrentQuantity(
      "restaurant-a",
      "article-1",
      buildStockPrincipal()
    )).quantity,
    7
  )
})

test("15b contrôle physique refusé pour un article AUTOMATIC_SIMPLE", async () => {
  const { service } = setup({ trackingMode: "AUTOMATIC_SIMPLE" })
  await seed(service)
  await assert.rejects(
    service.recordPhysicalControl(
      {
        restaurantId: "restaurant-a",
        articleId: "article-1",
        observedQuantity: 7,
        unit: "kg",
        occurredAt: "2026-01-03T10:00:00.000Z",
        actorId: "actor-a",
        idempotencyKey: "automatic-control",
      },
      buildStockPrincipal()
    ),
    { code: "CONTROLLED_STOCK_INVALID_INPUT" }
  )
})

test("16 perte valide diminue le stock", async () => {
  const { service } = setup()
  await seed(service)
  const result = await service.recordLoss(
    {
      restaurantId: "restaurant-a", articleId: "article-1",
      quantity: 2, unit: "kg", reason: "CASSE",
      occurredAt: "2026-01-03T11:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "loss-1",
    },
    buildStockPrincipal()
  )
  assert.equal(result.balance.quantity, 8)
})

test("17 motif de perte obligatoire", async () => {
  const { service } = setup()
  await seed(service)
  await assert.rejects(
    service.recordLoss(
      {
        restaurantId: "restaurant-a", articleId: "article-1",
        quantity: 1, unit: "kg", reason: "",
        occurredAt: "2026-01-03T11:00:00.000Z",
        actorId: "actor-a", idempotencyKey: "loss-invalid",
      },
      buildStockPrincipal()
    ),
    { path: "reason" }
  )
})

test("18 correction positive", async () => {
  const { service } = setup()
  const result = await service.recordCorrection(
    {
      restaurantId: "restaurant-a", articleId: "article-1",
      direction: "POSITIVE", quantity: 3, unit: "kg",
      justification: "Erreur de saisie", occurredAt: "2026-01-03T12:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "correction-plus",
    },
    buildStockPrincipal()
  )
  assert.equal(result.balance.quantity, 3)
})

test("19 correction négative", async () => {
  const { service } = setup()
  await seed(service)
  const result = await service.recordCorrection(
    {
      restaurantId: "restaurant-a", articleId: "article-1",
      direction: "NEGATIVE", quantity: 3, unit: "kg",
      justification: "Erreur de saisie", occurredAt: "2026-01-03T12:00:00.000Z",
      actorId: "actor-a", idempotencyKey: "correction-minus",
    },
    buildStockPrincipal()
  )
  assert.equal(result.balance.quantity, 7)
})

test("20 justification de correction obligatoire", async () => {
  const { service } = setup()
  await assert.rejects(
    service.recordCorrection(
      {
        restaurantId: "restaurant-a", articleId: "article-1",
        direction: "POSITIVE", quantity: 1, unit: "kg",
        justification: "", occurredAt: "2026-01-03T12:00:00.000Z",
        actorId: "actor-a", idempotencyKey: "correction-invalid",
      },
      buildStockPrincipal()
    ),
    { path: "justification" }
  )
})

test("21 historique complet contient tous les types", async () => {
  const { service } = setup()
  await seed(service)
  await service.recordLoss({
    restaurantId: "restaurant-a", articleId: "article-1",
    quantity: 1, unit: "kg", reason: "CASSE",
    occurredAt: "2026-01-03T11:00:00.000Z",
    actorId: "actor-a", idempotencyKey: "history-loss",
  }, buildStockPrincipal())
  const page = await service.listOperations(
    { restaurantId: "restaurant-a" },
    buildStockPrincipal()
  )
  assert.deepEqual(
    new Set(page.items.map((item) => item.type)),
    new Set(["APPROVISIONNEMENT", "PERTE"])
  )
})

test("22 historique conserve quantité avant et après", async () => {
  const { service } = setup()
  const result = await seed(service)
  assert.equal(result.operation.quantityBefore, 0)
  assert.equal(result.operation.quantityAfter, 10)
})

test("23 permissions positives", async () => {
  const { service } = setup()
  assert.equal(
    (await seed(service)).balance.quantity,
    10
  )
})

test("24 permissions négatives", async () => {
  const { service } = setup()
  await assert.rejects(
    service.recordSupply(supplyInput(), buildStockPrincipal("restaurant-a", "employee")),
    { code: "CONTROLLED_STOCK_FORBIDDEN" }
  )
})

test("25 coût masqué sans permission", async () => {
  const { service } = setup()
  const result = await service.recordSupply(
    supplyInput({ totalCost: 1000 }),
    buildStockPrincipal("restaurant-a", "storekeeper")
  )
  assert.equal(result.cost, undefined)
})

test("26 Article NONE refusé", async () => {
  const { service } = setup({ trackingMode: "NONE" })
  await assert.rejects(seed(service), {
    code: "CONTROLLED_STOCK_TRACKING_DISABLED",
  })
})

test("27 Article CONTROLLED accepté", async () => {
  const { service } = setup({ trackingMode: "CONTROLLED" })
  assert.equal((await seed(service)).balance.quantity, 10)
})

test("28 Article AUTOMATIC_SIMPLE accepté sans automatisation", async () => {
  const { service } = setup({ trackingMode: "AUTOMATIC_SIMPLE" })
  const result = await seed(service)
  assert.equal(result.balance.quantity, 10)
  assert.equal(result.operation.type, "APPROVISIONNEMENT")
})

test("29 feature flag désactivé", () => {
  assert.equal(isControlledStockEnabled("restaurant-a", { enabled: false }), false)
  assert.equal(getControlledStockFeatureConfiguration().enabled, false)
})

test("30 feature flag activé et limité", () => {
  assert.equal(isControlledStockEnabled("restaurant-a", { enabled: true }), true)
  assert.equal(
    isControlledStockEnabled("restaurant-b", {
      enabled: true,
      restaurantAllowlist: ["restaurant-a"],
    }),
    false
  )
})

test("31 transaction atomique sans mutation sur conflit", async () => {
  const { service, stock } = setup()
  await seed(service)
  await assert.rejects(
    service.recordCorrection(
      {
        restaurantId: "restaurant-a", articleId: "article-1",
        direction: "POSITIVE", quantity: 1, unit: "kg",
        justification: "Test", occurredAt: "2026-01-03T12:00:00.000Z",
        actorId: "actor-a", idempotencyKey: "conflict", expectedVersion: 0,
      },
      buildStockPrincipal()
    ),
    { code: "CONTROLLED_STOCK_CONFLICT" }
  )
  assert.equal(stock.writes, 1)
  assert.equal((await stock.getBalance("restaurant-a", "article-1")).quantity, 10)
})

test("32 conflit concurrent détecté", async () => {
  const { service } = setup()
  await seed(service)
  await assert.rejects(
    service.recordSupply(
      supplyInput({ idempotencyKey: "late", expectedVersion: 0 }),
      buildStockPrincipal()
    ),
    { code: "CONTROLLED_STOCK_CONFLICT" }
  )
})

test("33 pagination de l’historique", async () => {
  const { service } = setup()
  await seed(service)
  await service.recordCorrection({
    restaurantId: "restaurant-a", articleId: "article-1",
    direction: "POSITIVE", quantity: 1, unit: "kg",
    justification: "Test", occurredAt: "2026-01-03T12:00:00.000Z",
    actorId: "actor-a", idempotencyKey: "page-2",
  }, buildStockPrincipal())
  const first = await service.listOperations(
    { restaurantId: "restaurant-a", pageSize: 1 },
    buildStockPrincipal()
  )
  const second = await service.listOperations(
    { restaurantId: "restaurant-a", pageSize: 1, cursor: first.nextCursor },
    buildStockPrincipal()
  )
  assert.equal(first.items.length, 1)
  assert.equal(second.items.length, 1)
})

test("34 filtre par période", async () => {
  const { service } = setup()
  await seed(service)
  const page = await service.listOperations(
    {
      restaurantId: "restaurant-a",
      from: "2026-01-02T00:00:00.000Z",
      to: "2026-01-02T23:59:59.999Z",
    },
    buildStockPrincipal()
  )
  assert.equal(page.total, 1)
})

test("35 filtre par type", async () => {
  const { service } = setup()
  await seed(service)
  const page = await service.listOperations(
    { restaurantId: "restaurant-a", type: "PERTE" },
    buildStockPrincipal()
  )
  assert.equal(page.total, 0)
})

test("36 le Lot 3 ne référence aucun flux historique ou recette", () => {
  const service = readFileSync(
    new URL(
      "../../../src/modules/stock/controlled-stock/application/controlled-stock-service.ts",
      import.meta.url
    ),
    "utf8"
  )
  const repository = readFileSync(
    new URL(
      "../../../src/modules/stock/controlled-stock/infrastructure/firestore-controlled-stock-repository.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.doesNotMatch(
    service,
    /\b(recette|recipe|ingredient|POS|Cuisine|Commande)\b/i
  )
  assert.doesNotMatch(repository, /inventoryItems|stockEstimated|COLLECTION_NAMES\.INVENTORY/)
})
