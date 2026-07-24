import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const functionsSource = await readFile(new URL("../../functions/src/index.ts", import.meta.url), "utf8")

test("le Lot 1 réputation ne dépend plus d'une callable Cloud Function", () => {
  assert.doesNotMatch(functionsSource, /submitRestaurantReview/)
  assert.doesNotMatch(functionsSource, /from "firebase-functions\/v2\/https"/)
  assert.doesNotMatch(functionsSource, /onCall/)
})

test("les autres triggers marketplace restent présents", () => {
  assert.match(functionsSource, /syncMarketplaceDishOfferOnProductWrite/)
  assert.match(functionsSource, /syncMarketplaceDishOffersOnCategoryWrite/)
  assert.match(functionsSource, /syncMarketplaceDishOffersOnRestaurantWrite/)
})
