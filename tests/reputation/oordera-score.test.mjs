import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDishReputationKey,
  buildOorderaReputationModel,
  rankDishes,
  rankRestaurants,
  scoreRestaurant,
} from "../../src/lib/reputation/oordera-score.ts"

const now = new Date("2026-07-26T12:00:00.000Z")

function restaurantReview(id, restaurantId, rating, createdAt, overrides = {}) {
  return {
    id,
    restaurantId,
    orderId: `order-${id}`,
    orderType: "dine_in",
    rating,
    wouldRecommend: true,
    comment: null,
    customerId: null,
    customerName: "Client",
    author: { displayName: "Client", customerId: null },
    source: "qr_table",
    status: "published",
    orderCompletedAt: new Date(createdAt),
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    ...overrides,
  }
}

function dishReview(id, restaurantId, productId, rating, createdAt, overrides = {}) {
  return {
    id,
    restaurantId,
    orderId: `order-${id}`,
    orderType: "dine_in",
    orderItemId: `item-${id}`,
    orderItemIndex: 0,
    productId,
    productName: productId === "pizza" ? "Pizza Reine" : "Burger Signature",
    productImageUrl: null,
    quantity: 1,
    rating,
    comment: null,
    customerId: null,
    customerName: "Client",
    source: "qr_table",
    status: "published",
    orderCompletedAt: new Date(createdAt),
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    ...overrides,
  }
}

test("score toujours entre 0 et 100 et restaurant sans avis reste neutre bas", () => {
  const reputation = scoreRestaurant({ restaurantId: "empty", restaurantReviews: [], dishReviews: [], now })
  assert.equal(reputation.score >= 0, true)
  assert.equal(reputation.score <= 100, true)
  assert.equal(reputation.reviewCount, 0)
  assert.equal(reputation.averageRating, null)
  assert.deepEqual(reputation.badges, [])
})

test("un seul avis 5 etoiles ne bat pas un restaurant solide avec beaucoup d'avis", () => {
  const oneFiveStar = scoreRestaurant({
    restaurantId: "one",
    now,
    restaurantReviews: [restaurantReview("one", "one", 5, "2026-07-25T10:00:00.000Z")],
    dishReviews: [],
  })
  const solid = scoreRestaurant({
    restaurantId: "solid",
    now,
    restaurantReviews: Array.from({ length: 16 }, (_, index) => restaurantReview(`solid-${index}`, "solid", index % 5 === 0 ? 4 : 5, "2026-07-20T10:00:00.000Z")),
    dishReviews: [],
  })

  assert.equal(solid.score > oneFiveStar.score, true)
  assert.equal(oneFiveStar.badges.some((badge) => badge.key === "excellent"), false)
})

test("attribue les badges restaurant uniquement avec volume et signaux suffisants", () => {
  const reputation = scoreRestaurant({
    restaurantId: "excellent",
    now,
    restaurantReviews: Array.from({ length: 14 }, (_, index) => restaurantReview(`r-${index}`, "excellent", index === 0 ? 4 : 5, "2026-07-24T10:00:00.000Z", { wouldRecommend: true })),
    dishReviews: Array.from({ length: 8 }, (_, index) => dishReview(`d-${index}`, "excellent", "pizza", 5, "2026-07-24T10:00:00.000Z")),
  })

  assert.equal(reputation.badges.some((badge) => badge.key === "excellent"), true)
  assert.equal(reputation.badges.some((badge) => badge.key === "recommended"), true)
})

test("classement stable: ouvert, score, volume puis nom", () => {
  const reputations = {
    a: { score: 70, reviewCount: 10 },
    b: { score: 90, reviewCount: 5 },
    c: { score: 90, reviewCount: 12 },
  }
  const ranked = rankRestaurants([
    { restaurantId: "a", isOpenNow: true, name: "Alpha" },
    { restaurantId: "b", isOpenNow: false, name: "Beta" },
    { restaurantId: "c", isOpenNow: false, name: "Charlie" },
  ], reputations)

  assert.deepEqual(ranked.map((restaurant) => restaurant.restaurantId), ["a", "c", "b"])
})

test("calcule la reputation des plats et les classe sans hasard", () => {
  const model = buildOorderaReputationModel({
    now,
    restaurantReviews: [],
    dishReviews: [
      dishReview("pizza-1", "r1", "pizza", 5, "2026-07-25T10:00:00.000Z"),
      dishReview("pizza-2", "r1", "pizza", 5, "2026-07-24T10:00:00.000Z"),
      dishReview("pizza-3", "r1", "pizza", 4, "2026-07-23T10:00:00.000Z"),
      dishReview("burger-1", "r1", "burger", 5, "2026-07-25T10:00:00.000Z"),
    ],
  })
  const pizza = model.dishes[buildDishReputationKey("r1", "pizza")]
  const burger = model.dishes[buildDishReputationKey("r1", "burger")]

  assert.equal(pizza.reviewCount, 3)
  assert.equal(pizza.score > burger.score, true)

  const ranked = rankDishes([
    { restaurantId: "r1", productId: "burger", name: "Burger Signature" },
    { restaurantId: "r1", productId: "pizza", name: "Pizza Reine" },
  ], model.dishes)
  assert.deepEqual(ranked.map((dish) => dish.productId), ["pizza", "burger"])
})

test("ignore les avis masques ou supprimes dans le modele global", () => {
  const model = buildOorderaReputationModel({
    now,
    restaurantReviews: [
      restaurantReview("published", "r1", 5, "2026-07-25T10:00:00.000Z"),
      restaurantReview("hidden", "r1", 1, "2026-07-25T10:00:00.000Z", { status: "hidden" }),
    ],
    dishReviews: [
      dishReview("published", "r1", "pizza", 5, "2026-07-25T10:00:00.000Z"),
      dishReview("deleted", "r1", "pizza", 1, "2026-07-25T10:00:00.000Z", { status: "deleted" }),
    ],
  })

  assert.equal(model.restaurants.r1.reviewCount, 1)
  assert.equal(model.dishes[buildDishReputationKey("r1", "pizza")].reviewCount, 1)
})
