import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const functionsSource = await readFile(new URL("../../functions/src/index.ts", import.meta.url), "utf8")

test("les triggers marketplace écoutent uniquement les sources restaurant", () => {
  assert.match(functionsSource, /restaurants\/\{restaurantId\}\/products\/\{productId\}/)
  assert.match(functionsSource, /restaurants\/\{restaurantId\}\/categories\/\{categoryId\}/)
  assert.match(functionsSource, /restaurants\/\{restaurantId\}"/)
  assert.doesNotMatch(functionsSource, /document:\s*"marketplaceDishOffers/)
  assert.doesNotMatch(functionsSource, /document:\s*"marketplaceRestaurantCategoryOffers/)
})

test("les triggers réutilisent les services centraux sans dupliquer la projection", () => {
  assert.match(functionsSource, /syncMarketplaceProductById/)
  assert.match(functionsSource, /syncMarketplaceCategoryProducts/)
  assert.match(functionsSource, /syncMarketplaceRestaurantProducts/)
  assert.match(functionsSource, /deleteMarketplaceDishOffer/)
  assert.match(functionsSource, /deleteMarketplaceRestaurantOffers/)
  assert.match(functionsSource, /syncMarketplaceRestaurantCategoryOffers/)
  assert.match(functionsSource, /deleteMarketplaceRestaurantCategoryOffers/)
  assert.doesNotMatch(functionsSource, /projectMarketplaceDishOffer\(/)
})
