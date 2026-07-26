import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCustomerVoiceAnalytics,
  filterRestaurantComments,
  sortDishSummaries,
} from "../../src/lib/reputation/customer-voice-analytics.ts"

const now = new Date("2026-07-26T12:00:00.000Z")

function restaurantReview(id, rating, createdAt, overrides = {}) {
  return {
    id,
    restaurantId: "restaurant-1",
    orderId: `order-${id}`,
    rating,
    wouldRecommend: true,
    comment: "",
    status: "published",
    createdAt: new Date(createdAt),
    ...overrides,
  }
}

function dishReview(id, productId, rating, createdAt, overrides = {}) {
  return {
    id,
    restaurantId: "restaurant-1",
    orderId: `order-${id}`,
    orderItemId: `item-${id}`,
    productId,
    productName: productId === "burger" ? "Burger" : productId === "pizza" ? "Pizza" : "Riz africain",
    productImageUrl: null,
    quantity: 1,
    rating,
    comment: "",
    status: "published",
    createdAt: new Date(createdAt),
    ...overrides,
  }
}

test("calcule les KPIs restaurant sur la periode courante et ignore les recommandations absentes", () => {
  const analytics = buildCustomerVoiceAnalytics({
    now,
    period: "30d",
    restaurantReviews: [
      restaurantReview("recent-1", 5, "2026-07-25T10:00:00.000Z", { wouldRecommend: true }),
      restaurantReview("recent-2", 3, "2026-07-20T10:00:00.000Z", { wouldRecommend: false }),
      restaurantReview("recent-3", 4, "2026-07-15T10:00:00.000Z", { wouldRecommend: null }),
      restaurantReview("old", 1, "2026-05-01T10:00:00.000Z", { wouldRecommend: false }),
    ],
    dishReviews: [],
  })

  assert.equal(analytics.kpis.reviewCount, 3)
  assert.equal(analytics.kpis.averageRating, 4)
  assert.equal(analytics.kpis.recommendationCount, 1)
  assert.equal(analytics.kpis.recommendationTotal, 2)
  assert.equal(analytics.kpis.recommendationRate, 0.5)
})

test("calcule l'evolution par rapport a la periode precedente sauf pour Tout", () => {
  const reviews = [
    restaurantReview("current-1", 5, "2026-07-25T10:00:00.000Z"),
    restaurantReview("current-2", 4, "2026-07-24T10:00:00.000Z"),
    restaurantReview("previous-1", 2, "2026-07-17T10:00:00.000Z"),
    restaurantReview("previous-2", 4, "2026-07-16T10:00:00.000Z"),
  ]

  const sevenDays = buildCustomerVoiceAnalytics({ now, period: "7d", restaurantReviews: reviews, dishReviews: [] })
  assert.equal(sevenDays.kpis.ratingEvolution, 1.5)

  const all = buildCustomerVoiceAnalytics({ now, period: "all", restaurantReviews: reviews, dishReviews: [] })
  assert.equal(all.kpis.ratingEvolution, null)
})

test("construit une distribution 5 a 1 et une tendance sans fausses notes zero", () => {
  const analytics = buildCustomerVoiceAnalytics({
    now,
    period: "30d",
    restaurantReviews: [
      restaurantReview("a", 5, "2026-07-25T10:00:00.000Z"),
      restaurantReview("b", 5, "2026-07-25T12:00:00.000Z"),
      restaurantReview("c", 2, "2026-07-24T10:00:00.000Z"),
    ],
    dishReviews: [],
  })

  assert.deepEqual(analytics.ratingDistribution.map((bucket) => [bucket.rating, bucket.count]), [[5, 2], [4, 0], [3, 0], [2, 1], [1, 0]])
  assert.equal(analytics.trend.length, 2)
  assert.ok(analytics.trend.every((point) => point.averageRating !== 0))
})

test("filtre les commentaires positifs et a surveiller", () => {
  const reviews = [
    restaurantReview("positive", 5, "2026-07-25T10:00:00.000Z", { comment: "Excellent" }),
    restaurantReview("low", 2, "2026-07-25T10:00:00.000Z", { comment: "Trop lent" }),
    restaurantReview("not-recommended", 4, "2026-07-25T10:00:00.000Z", { comment: "Pas convaincu", wouldRecommend: false }),
    restaurantReview("empty", 5, "2026-07-25T10:00:00.000Z", { comment: "" }),
  ]

  assert.deepEqual(filterRestaurantComments(reviews, "positive").map((review) => review.id), ["positive", "not-recommended"])
  assert.deepEqual(filterRestaurantComments(reviews, "watch").map((review) => review.id), ["low", "not-recommended"])
  assert.deepEqual(filterRestaurantComments(reviews, "all").map((review) => review.id), ["positive", "low", "not-recommended"])
})

test("synthétise les avis plats et evite de classer automatiquement un avis unique comme meilleur", () => {
  const analytics = buildCustomerVoiceAnalytics({
    now,
    period: "30d",
    restaurantReviews: [],
    dishReviews: [
      dishReview("burger-1", "burger", 4, "2026-07-25T10:00:00.000Z", { comment: "Bon" }),
      dishReview("burger-2", "burger", 5, "2026-07-24T10:00:00.000Z"),
      dishReview("burger-3", "burger", 5, "2026-07-23T10:00:00.000Z"),
      dishReview("pizza-1", "pizza", 5, "2026-07-25T10:00:00.000Z", { comment: "Top" }),
    ],
  })

  const byCount = sortDishSummaries(analytics.dishSummaries, "reviewCount")
  assert.equal(byCount[0].productId, "burger")
  assert.equal(byCount[0].fiveStarCount, 2)
  assert.equal(byCount[0].commentCount, 1)

  const bestRated = sortDishSummaries(analytics.dishSummaries, "bestRated")
  assert.equal(bestRated[0].productId, "burger")
})

test("retourne des etats vides deterministes", () => {
  const analytics = buildCustomerVoiceAnalytics({ now, period: "30d", restaurantReviews: [], dishReviews: [] })
  assert.equal(analytics.kpis.averageRating, null)
  assert.equal(analytics.kpis.recommendationRate, null)
  assert.equal(analytics.trend.length, 0)
  assert.equal(analytics.signals[0].id, "not-enough-data")
})
