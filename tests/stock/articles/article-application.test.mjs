import assert from "node:assert/strict"
import test from "node:test"

import { ArticleService } from "../../../src/modules/stock/articles/application/article-service.ts"
import {
  canPerformArticleAction,
} from "../../../src/modules/stock/articles/application/authorization.ts"
import {
  InMemoryArticleRepository,
  InMemoryCategoryRepository,
  buildPrincipal,
  seedCategory,
} from "./article-test-kit.mjs"

function setup() {
  const articles = new InMemoryArticleRepository()
  const categories = new InMemoryCategoryRepository()
  seedCategory(categories, "restaurant-a")
  seedCategory(categories, "restaurant-b")
  let id = 0
  const service = new ArticleService({
    articles,
    categories,
    createId: () => `article-${++id}`,
    now: () => "2026-01-02T00:00:00.000Z",
  })
  return { articles, categories, service }
}

function input(name, restaurantId = "restaurant-a", categoryId = "category-food") {
  return {
    restaurantId,
    actorId: "actor-a",
    name,
    categoryId,
    baseUnit: "kg",
    lowStockThreshold: 4,
    outOfStockThreshold: 0,
  }
}

test("isolates same article names between restaurants", async () => {
  const { service } = setup()
  await service.createArticle(input("Farine"), buildPrincipal("restaurant-a"))
  await service.createArticle(
    input("Farine", "restaurant-b"),
    buildPrincipal("restaurant-b")
  )
  assert.equal(
    (await service.listArticles(
      { restaurantId: "restaurant-a" },
      buildPrincipal("restaurant-a")
    )).total,
    1
  )
  assert.equal(
    (await service.listArticles(
      { restaurantId: "restaurant-b" },
      buildPrincipal("restaurant-b")
    )).total,
    1
  )
})

test("enforces read and create permissions", async () => {
  const { service } = setup()
  assert.equal(
    canPerformArticleAction(buildPrincipal("restaurant-a", "manager"), "read", "restaurant-a"),
    true
  )
  await assert.rejects(
    service.listArticles(
      { restaurantId: "restaurant-a" },
      buildPrincipal("restaurant-a", "employee")
    ),
    { code: "ARTICLE_FORBIDDEN" }
  )
  await assert.rejects(
    service.createArticle(
      input("Riz"),
      buildPrincipal("restaurant-a", "kitchen_chef")
    ),
    { code: "ARTICLE_FORBIDDEN" }
  )
})

test("protects cost reads and cost updates independently", async () => {
  const { service } = setup()
  const created = await service.createArticle(
    { ...input("Riz"), referenceCost: 500 },
    buildPrincipal()
  )
  const chefRead = await service.getArticle(
    "restaurant-a",
    String(created.article.id),
    buildPrincipal("restaurant-a", "kitchen_chef")
  )
  assert.equal(chefRead.referenceCost, undefined)
  await assert.rejects(
    service.updateArticle(
      "restaurant-a",
      String(created.article.id),
      { referenceCost: 700, actorId: "chef" },
      buildPrincipal("restaurant-a", "kitchen_chef")
    ),
    { code: "ARTICLE_FORBIDDEN" }
  )
})

test("an update without cost permission preserves the hidden cost", async () => {
  const { articles, service } = setup()
  const created = await service.createArticle(
    { ...input("Huile"), referenceCost: 900 },
    buildPrincipal()
  )
  await service.updateArticle(
    "restaurant-a",
    String(created.article.id),
    { name: "Huile végétale", actorId: "storekeeper-a" },
    buildPrincipal("restaurant-a", "storekeeper")
  )
  assert.equal(
    articles.items.get(`restaurant-a::${created.article.id}`).referenceCost,
    900
  )
})

test("supports pagination, search and category filtering", async () => {
  const { categories, service } = setup()
  seedCategory(categories, "restaurant-a", {
    id: "category-drink",
    name: "Boissons",
  })
  await service.createArticle(input("Farine"), buildPrincipal())
  await service.createArticle(input("Riz"), buildPrincipal())
  await service.createArticle(
    input("Jus de mangue", "restaurant-a", "category-drink"),
    buildPrincipal()
  )
  const first = await service.listArticles(
    { restaurantId: "restaurant-a", pageSize: 2 },
    buildPrincipal()
  )
  assert.equal(first.items.length, 2)
  assert.ok(first.nextCursor)
  const second = await service.listArticles(
    {
      restaurantId: "restaurant-a",
      pageSize: 2,
      cursor: first.nextCursor,
    },
    buildPrincipal()
  )
  assert.equal(second.items.length, 1)
  assert.equal(
    (await service.listArticles(
      { restaurantId: "restaurant-a", search: "mangue" },
      buildPrincipal()
    )).total,
    1
  )
  assert.equal(
    (await service.listArticles(
      { restaurantId: "restaurant-a", categoryId: "category-drink" },
      buildPrincipal()
    )).total,
    1
  )
})

test("creates and archives a restaurant category", async () => {
  const { service } = setup()
  const category = await service.createCategory(
    {
      restaurantId: "restaurant-a",
      actorId: "actor-a",
      name: "Épicerie",
      sortOrder: 2,
    },
    buildPrincipal()
  )
  const archived = await service.archiveCategory(
    "restaurant-a",
    String(category.id),
    "actor-a",
    buildPrincipal()
  )
  assert.equal(archived.status, "archived")
})

test("refuses cross-restaurant access", async () => {
  const { service } = setup()
  const created = await service.createArticle(input("Riz"), buildPrincipal())
  await assert.rejects(
    service.getArticle(
      "restaurant-a",
      String(created.article.id),
      buildPrincipal("restaurant-b")
    ),
    { code: "ARTICLE_RESTAURANT_MISMATCH" }
  )
})
