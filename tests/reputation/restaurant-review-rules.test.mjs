import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8")

test("les avis restaurant sont stockés sous le restaurant et créés uniquement avec token", () => {
  assert.match(rules, /match \/reviews\/\{reviewId\}/)
  assert.match(rules, /allow create: if canCreateRestaurantReview\(restaurantId, reviewId\)/)
  assert.match(rules, /allow update, delete: if false/)
  assert.match(rules, /reviewAccessDoc\(restaurantId, reviewId\)\.data\.reviewToken == request\.resource\.data\.reviewToken/)
})

test("les capacités d'avis ne sont jamais lisibles publiquement", () => {
  assert.match(rules, /match \/reviewAccess\/\{orderId\}/)
  assert.match(rules, /allow create: if isValidReviewAccessCreate\(restaurantId, orderId\)/)
  assert.match(rules, /allow get, list, update, delete: if false/)
})

test("les agrégats d'avis ne sont pas modifiables par le client", () => {
  assert.match(rules, /match \/reviewAggregates\/\{aggregateId\}/)
  assert.match(rules, /allow get, list: if canReadRestaurantReviewDocs\(restaurantId\)/)
  assert.match(rules, /allow create, update, delete: if false/)
})
