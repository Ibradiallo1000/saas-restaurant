import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8")

test("la projection est publiquement lisible mais jamais publiquement inscriptible", () => {
  assert.match(rules, /match \/marketplaceDishOffers\/\{offerId\}/)
  assert.match(rules, /allow read: if resource\.data\.discoverable == true/)
  assert.match(rules, /allow write: if false/)
})

test("la taxonomie expose uniquement les catégories actives et refuse les écritures client", () => {
  assert.match(rules, /match \/marketplaceFoodCategories\/\{categoryId\}/)
  assert.match(rules, /allow read: if isSuperAdmin\(\)/)
  assert.match(rules, /resource\.data\.active == true/)
  assert.match(rules, /resource\.data\.schemaVersion == 1/)
})

test("les projections restaurant-catégorie sont publiques uniquement si découvrables", () => {
  assert.match(rules, /match \/marketplaceRestaurantCategoryOffers\/\{offerId\}/)
  assert.match(rules, /allow read: if resource\.data\.discoverable == true/)
  assert.match(rules, /allow write: if false/)
})
