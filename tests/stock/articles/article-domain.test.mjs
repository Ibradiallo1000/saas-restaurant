import assert from "node:assert/strict"
import test from "node:test"

import { ArticleService } from "../../../src/modules/stock/articles/application/article-service.ts"
import {
  convertArticleQuantity,
  officialUnitFactor,
} from "../../../src/modules/stock/articles/domain/units.ts"
import { validateCreateArticle } from "../../../src/modules/stock/articles/domain/validation.ts"
import {
  InMemoryArticleRepository,
  InMemoryCategoryRepository,
  buildPrincipal,
  seedCategory,
} from "./article-test-kit.mjs"

function setup() {
  const articles = new InMemoryArticleRepository()
  const categories = new InMemoryCategoryRepository()
  seedCategory(categories)
  const service = new ArticleService({
    articles,
    categories,
    now: () => "2026-01-02T00:00:00.000Z",
    createId: () => "article-1",
  })
  return { articles, categories, service }
}

function validInput(overrides = {}) {
  return {
    restaurantId: "restaurant-a",
    actorId: "actor-a",
    name: "Poulet",
    categoryId: "category-food",
    baseUnit: "unit",
    lowStockThreshold: 5,
    outOfStockThreshold: 0,
    ...overrides,
  }
}

test("creates a valid article without a quantity field", async () => {
  const { service } = setup()
  const result = await service.createArticle(validInput(), buildPrincipal())
  assert.equal(result.article.name, "Poulet")
  assert.equal("quantity" in result.article, false)
  assert.equal("stock" in result.article, false)
  assert.equal(result.article.trackingMode, "CONTROLLED")
})

test("supports the three official tracking modes", () => {
  for (const trackingMode of [
    "CONTROLLED",
    "AUTOMATIC_SIMPLE",
    "NONE",
  ]) {
    assert.equal(
      validateCreateArticle(validInput({ trackingMode })).trackingMode,
      trackingMode
    )
  }
  assert.throws(
    () => validateCreateArticle(validInput({ trackingMode: "COMPLEX" })),
    { path: "trackingMode" }
  )
})

test("allows an article without a category", async () => {
  const { service } = setup()
  const input = validInput()
  delete input.categoryId
  const result = await service.createArticle(input, buildPrincipal())
  assert.equal(result.article.categoryId, undefined)
})

test("rejects missing name and restaurant", () => {
  assert.throws(() => validateCreateArticle(validInput({ name: "" })), {
    path: "name",
  })
  assert.throws(
    () => validateCreateArticle(validInput({ restaurantId: "" })),
    { path: "restaurantId" }
  )
})

test("rejects invalid unit and negative thresholds", () => {
  assert.throws(() => validateCreateArticle(validInput({ baseUnit: "cup" })), {
    path: "baseUnit",
  })
  assert.throws(
    () => validateCreateArticle(validInput({ lowStockThreshold: -1 })),
    { path: "lowStockThreshold" }
  )
  assert.throws(
    () =>
      validateCreateArticle(
        validInput({ lowStockThreshold: 2, outOfStockThreshold: 3 })
      ),
    { path: "outOfStockThreshold" }
  )
})

test("creates simple packaging and rejects zero or negative quantities", () => {
  const packaging = {
    kind: "box",
    name: "Carton de 24",
    quantity: 24,
    targetUnit: "unit",
  }
  assert.equal(
    validateCreateArticle(validInput({ packagings: [packaging] }))
      .packagings[0].quantity,
    24
  )
  assert.throws(() =>
    validateCreateArticle(
      validInput({
        packagings: [{ ...packaging, quantity: 0 }],
      })
    )
  )
  assert.throws(() =>
    validateCreateArticle(
      validInput({
        packagings: [{ ...packaging, quantity: -2 }],
      })
    )
  )
})

test("purchase format names are required and unique for one article", () => {
  const packaging = {
    kind: "other",
    name: "Carton",
    quantity: 24,
    targetUnit: "unit",
  }
  assert.throws(
    () => validateCreateArticle(validInput({
      packagings: [packaging, { ...packaging, name: " càrtón " }],
    })),
    /même nom/
  )
  assert.throws(
    () => validateCreateArticle(validInput({
      packagings: [{ ...packaging, name: " " }],
    })),
    /obligatoire/
  )
})

test("converts mass and volume with explicit official factors", () => {
  assert.equal(
    convertArticleQuantity(2, "kg", "g", officialUnitFactor("kg", "g")),
    2000
  )
  assert.equal(
    convertArticleQuantity(3, "l", "ml", officialUnitFactor("l", "ml")),
    3000
  )
})

test("rejects mass/volume and unit/mass conversions", () => {
  assert.throws(() => convertArticleQuantity(1, "kg", "l", 1))
  assert.throws(() => convertArticleQuantity(1, "unit", "kg", 1))
})

test("distinguishes absent cost from zero cost", async () => {
  const { service } = setup()
  const absent = await service.createArticle(validInput(), buildPrincipal())
  assert.equal(absent.article.referenceCost, undefined)

  const second = new ArticleService({
    articles: new InMemoryArticleRepository(),
    categories: (() => {
      const categories = new InMemoryCategoryRepository()
      seedCategory(categories)
      return categories
    })(),
    createId: () => "article-2",
    now: () => "2026-01-02T00:00:00.000Z",
  })
  const zero = await second.createArticle(
    validInput({ referenceCost: 0 }),
    buildPrincipal()
  )
  assert.equal(zero.article.referenceCost, 0)
})

test("updates, archives, reads archived and refuses new use", async () => {
  const { service } = setup()
  const created = await service.createArticle(validInput(), buildPrincipal())
  const updated = await service.updateArticle(
    "restaurant-a",
    String(created.article.id),
    { name: "Poulet entier", actorId: "actor-a" },
    buildPrincipal()
  )
  assert.equal(updated.name, "Poulet entier")
  const archived = await service.archiveArticle(
    "restaurant-a",
    String(created.article.id),
    "actor-a",
    buildPrincipal()
  )
  assert.equal(archived.status, "archived")
  const read = await service.getArticle(
    "restaurant-a",
    String(created.article.id),
    buildPrincipal()
  )
  assert.equal(read.status, "archived")
  assert.throws(() => service.assertUsableForNewOperation(read), {
    code: "ARTICLE_ARCHIVED",
  })
})

test("article creation contract has no first stock or quantity", async () => {
  const { articles, service } = setup()
  const result = await service.createArticle(validInput(), buildPrincipal())
  assert.deepEqual(Object.keys(result), ["article"])
  assert.equal("quantity" in articles.items.values().next().value, false)
  assert.equal("firstStock" in result.article, false)
})
