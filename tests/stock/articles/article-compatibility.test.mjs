import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  getArticleFeatureFlagConfiguration,
  isArticleReferentialEnabled,
} from "../../../src/modules/stock/articles/feature-flag.ts"
import {
  simulateLegacyArticleMigration,
} from "../../../src/modules/stock/articles/migration/simulate-legacy-articles.ts"

test("feature flag is disabled by default and can be enabled globally", () => {
  assert.equal(
    isArticleReferentialEnabled("restaurant-a", { enabled: false }),
    false
  )
  assert.equal(
    isArticleReferentialEnabled("restaurant-a", { enabled: true }),
    true
  )
})

test("feature flag supports restaurant-limited activation", () => {
  const configuration = {
    enabled: true,
    restaurantAllowlist: ["restaurant-a"],
  }
  assert.equal(
    isArticleReferentialEnabled("restaurant-a", configuration),
    true
  )
  assert.equal(
    isArticleReferentialEnabled("restaurant-b", configuration),
    false
  )
  assert.equal(getArticleFeatureFlagConfiguration().enabled, false)
})

test("migration is simulation-only and exposes legacy stock as an observation", () => {
  const result = simulateLegacyArticleMigration([
    {
      id: "legacy-rice",
      source: "inventoryItems",
      name: "Riz",
      unit: "kg",
      stockEstimated: 12,
    },
  ])
  assert.equal(result.mode, "simulation")
  assert.equal(result.writesPerformed, 0)
  assert.equal(result.candidates[0].observedLegacyStock?.quantity, 12)
  assert.equal("quantity" in result.candidates[0], false)
})

test("migration detects duplicates without merging them", () => {
  const result = simulateLegacyArticleMigration([
    {
      id: "modern-rice",
      source: "inventoryItems",
      name: "Ríz ",
      unit: "kg",
    },
    {
      id: "legacy-rice",
      source: "inventory",
      name: "riz",
      unit: "kilogramme",
    },
  ])
  assert.equal(result.candidates.length, 2)
  assert.equal(Object.keys(result.duplicateGroups).length, 1)
  assert.equal(result.candidates.every((item) => item.duplicateGroup), true)
})

test("new repository creates article, zero balance and optional cost without legacy writes", () => {
  const source = readFileSync(
    new URL(
      "../../../src/modules/stock/articles/infrastructure/firestore-article-repositories.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.doesNotMatch(source, /inventoryItems|COLLECTION_NAMES\.INVENTORY/)
  assert.doesNotMatch(source, /stockEstimated/)
  assert.match(source, /STOCK_V2_COLLECTIONS\.articles/)
  assert.match(source, /STOCK_V2_COLLECTIONS\.balances/)
  assert.match(source, /STOCK_V2_COLLECTIONS\.costs/)
  assert.match(source, /quantity: 0/)
  assert.match(source, /version: 1/)
  assert.match(source, /existingArticle\.exists\(\)/)
  assert.match(source, /existingBalance\.exists\(\)/)
  assert.match(source, /existingCost\.exists\(\)/)
})

test("security rules separate article reads from cost reads and forbid deletion", () => {
  const rules = readFileSync(
    new URL("../../../firestore.rules", import.meta.url),
    "utf8"
  )
  const articleRules = rules.slice(
    rules.indexOf("match /stockItemsV2"),
    rules.indexOf("match /inventoryItems")
  )
  assert.match(
    articleRules,
    /match \/stockItemsV2[\s\S]*canReadStockArticleReferential/
  )
  assert.match(
    articleRules,
    /match \/stockItemCostsV2[\s\S]*canReadRestaurantBusinessDocs/
  )
  assert.match(
    articleRules,
    /match \/stockItemsV2[\s\S]*allow delete: if false/
  )
  assert.doesNotMatch(articleRules, /stockEstimated/)
  assert.doesNotMatch(articleRules, /trackingEnabled/)
  assert.match(articleRules, /CONTROLLED/)
  assert.match(articleRules, /AUTOMATIC_SIMPLE/)
  assert.match(articleRules, /NONE/)
  assert.match(articleRules, /stockItemsV2[\s\S]*existsAfter[\s\S]*stockBalancesV2/)
  assert.match(articleRules, /stockBalancesV2[\s\S]*getAfter[\s\S]*stockItemsV2/)
})

test("article routes preserve the historical fallback behind the transparent inventory entry", () => {
  const listPage = readFileSync(
    new URL(
      "../../../src/app/(manager)/manager/stock/articles/page.tsx",
      import.meta.url
    ),
    "utf8"
  )
  const legacyPage = readFileSync(
    new URL(
      "../../../src/app/(manager)/manager/inventory/page.tsx",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(listPage, /ArticleReferentialScreen/)
  assert.match(legacyPage, /InventoryService/)
  assert.match(legacyPage, /router\.replace\("\/manager\/stock"\)/)
})
