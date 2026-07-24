import assert from "node:assert/strict"
import test from "node:test"

import {
  computeNextRestaurantReviewSummary,
  getRestaurantOrderCompletedAt,
  isRestaurantOrderReviewEligible,
  normalizeRestaurantReviewInput,
  RESTAURANT_REVIEW_COMMENT_MAX_LENGTH,
  resolveRestaurantReviewCustomer,
  resolveRestaurantReviewSource,
} from "../../src/lib/reputation/restaurant-review-core.ts"

const finishedOrder = {
  id: "order-1",
  restaurantId: "restaurant-1",
  source: "qr_table",
  orderType: "dine_in",
  kitchenStatus: "served",
  timestamps: { servedAt: new Date("2026-07-24T12:00:00.000Z") },
  customer: { name: "Awa Traoré", phone: "+22370000000" },
}

test("accepte un avis valide après commande terminée", () => {
  assert.equal(isRestaurantOrderReviewEligible(finishedOrder), true)
  assert.deepEqual(normalizeRestaurantReviewInput({
    restaurantId: " restaurant-1 ",
    orderId: " order-1 ",
    rating: 5,
    wouldRecommend: true,
    reviewToken: "00000000-0000-4000-8000-000000000000",
    comment: "  Très bonne expérience.  ",
  }), {
    restaurantId: "restaurant-1",
    orderId: "order-1",
    rating: 5,
    wouldRecommend: true,
    reviewToken: "00000000-0000-4000-8000-000000000000",
    comment: "Très bonne expérience.",
    tableSessionId: null,
  })
})

test("refuse une commande encore en préparation ou annulée", () => {
  assert.equal(isRestaurantOrderReviewEligible({ ...finishedOrder, kitchenStatus: "preparing", timestamps: {} }), false)
  assert.equal(isRestaurantOrderReviewEligible({ ...finishedOrder, kitchenStatus: "cancelled" }), false)
})

test("refuse les notes hors bornes et les commentaires trop longs", () => {
  assert.throws(() => normalizeRestaurantReviewInput({ restaurantId: "r", orderId: "o", rating: 0, wouldRecommend: true, reviewToken: "token" }), /between 1 and 5/)
  assert.throws(() => normalizeRestaurantReviewInput({ restaurantId: "r", orderId: "o", rating: 6, wouldRecommend: true, reviewToken: "token" }), /between 1 and 5/)
  assert.throws(
    () => normalizeRestaurantReviewInput({ restaurantId: "r", orderId: "o", rating: 4, wouldRecommend: true, reviewToken: "token", comment: "x".repeat(RESTAURANT_REVIEW_COMMENT_MAX_LENGTH + 1) }),
    /characters or less/
  )
})

test("résout la source et anonymise le client sans exposer le téléphone", () => {
  assert.equal(resolveRestaurantReviewSource(finishedOrder), "qr_table")
  assert.deepEqual(resolveRestaurantReviewCustomer(finishedOrder), {
    customerId: "+22370000000",
    customerName: "Awa",
  })
  assert.deepEqual(resolveRestaurantReviewCustomer({ createdByLabel: "Toi" }), {
    customerId: null,
    customerName: "Client Oordera",
  })
})

test("met à jour les agrégats de manière déterministe", () => {
  const now = new Date("2026-07-24T12:00:00.000Z")
  const first = computeNextRestaurantReviewSummary({ restaurantId: "r", rating: 5, wouldRecommend: true, now })
  assert.equal(first.reviewCount, 1)
  assert.equal(first.ratingSum, 5)
  assert.equal(first.averageRating, 5)
  assert.equal(first.wouldRecommendCount, 1)
  assert.equal(first.recommendationRate, 1)

  const second = computeNextRestaurantReviewSummary({ previous: first, restaurantId: "r", rating: 3, wouldRecommend: false, now })
  assert.equal(second.reviewCount, 2)
  assert.equal(second.ratingSum, 8)
  assert.equal(second.averageRating, 4)
  assert.equal(second.wouldRecommendCount, 1)
  assert.equal(second.recommendationRate, 0.5)
})

test("récupère le timestamp de fin canonique ou legacy", () => {
  assert.equal(getRestaurantOrderCompletedAt(finishedOrder), finishedOrder.timestamps.servedAt)
  const pickedUp = { kitchenStatus: "picked_up", timestamps: { pickedUpAt: new Date("2026-07-24T13:00:00.000Z") } }
  assert.equal(getRestaurantOrderCompletedAt(pickedUp), pickedUp.timestamps.pickedUpAt)
  const legacy = { kitchenStatus: "completed", completedAt: new Date("2026-07-24T14:00:00.000Z") }
  assert.equal(getRestaurantOrderCompletedAt(legacy), legacy.completedAt)
})
