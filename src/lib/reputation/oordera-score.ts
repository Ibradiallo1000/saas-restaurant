import type { DishReviewDocument } from "./dish-review-types"
import type { RestaurantReviewDocument } from "./restaurant-review-types"

export type ReviewWithId<T> = T & { id?: string }

export type OorderaBadgeKey =
  | "excellent"
  | "recommended"
  | "trending"
  | "new_favorite"
  | "popular_dish"
  | "best_category"

export type OorderaBadge = {
  key: OorderaBadgeKey
  label: string
  reason: string
}

export type OorderaRestaurantReputation = {
  restaurantId: string
  score: number
  averageRating: number | null
  bayesianRating: number | null
  reviewCount: number
  recommendationRate: number | null
  recommendationCount: number
  recommendationTotal: number
  recentReviewCount: number
  recentAverageRating: number | null
  dishAverageRating: number | null
  dishReviewCount: number
  badges: OorderaBadge[]
}

export type OorderaDishReputation = {
  restaurantId: string
  productId: string
  productName: string
  score: number
  averageRating: number | null
  bayesianRating: number | null
  reviewCount: number
  recentReviewCount: number
  badges: OorderaBadge[]
}

export type OorderaReputationModel = {
  restaurants: Record<string, OorderaRestaurantReputation>
  dishes: Record<string, OorderaDishReputation>
}

export type DishReviewEligibilityMap = Record<string, boolean>

export const OORDERA_SCORE_WEIGHTS = {
  restaurantRating: 0.35,
  recommendation: 0.2,
  reviewVolume: 0.15,
  recency: 0.15,
  dishQuality: 0.15,
} as const

const GLOBAL_PRIOR_RATING = 4.1
const MIN_RESTAURANT_CONFIDENCE_REVIEWS = 8
const MIN_EXCELLENT_REVIEWS = 12
const MIN_RECOMMENDED_RESPONSES = 6
const MIN_DISH_CONFIDENCE_REVIEWS = 3
const RECENT_WINDOW_DAYS = 30
const TREND_WINDOW_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export function buildOorderaReputationModel({
  dishReviews,
  now = new Date(),
  reviewableProducts,
  restaurantReviews,
}: {
  dishReviews: Array<ReviewWithId<DishReviewDocument>>
  now?: Date
  reviewableProducts?: DishReviewEligibilityMap
  restaurantReviews: Array<ReviewWithId<RestaurantReviewDocument>>
}): OorderaReputationModel {
  const publishedDishReviews = dishReviews
    .filter((review) => review.status === "published")
    .filter((review) => isDishReviewEligibleForRanking(review, reviewableProducts))
  const restaurantReviewsByRestaurant = groupByRestaurant(restaurantReviews.filter((review) => review.status === "published"))
  const dishReviewsByRestaurant = groupByRestaurant(publishedDishReviews)
  const restaurantIds = new Set([
    ...Object.keys(restaurantReviewsByRestaurant),
    ...Object.keys(dishReviewsByRestaurant),
  ])

  const dishes = buildDishReputations(publishedDishReviews, now)
  const restaurants: Record<string, OorderaRestaurantReputation> = {}
  for (const restaurantId of restaurantIds) {
    restaurants[restaurantId] = scoreRestaurant({
      restaurantId,
      restaurantReviews: restaurantReviewsByRestaurant[restaurantId] ?? [],
      dishReviews: dishReviewsByRestaurant[restaurantId] ?? [],
      now,
    })
  }

  return { restaurants, dishes }
}

export function scoreRestaurant({
  dishReviews,
  now = new Date(),
  restaurantId,
  restaurantReviews,
}: {
  dishReviews: Array<ReviewWithId<DishReviewDocument>>
  now?: Date
  restaurantId: string
  restaurantReviews: Array<ReviewWithId<RestaurantReviewDocument>>
}): OorderaRestaurantReputation {
  const ratings = restaurantReviews.map((review) => Number(review.rating || 0)).filter(isValidRating)
  const reviewCount = ratings.length
  const ratingAverage = reviewCount ? average(ratings) : null
  const bayesianRating = reviewCount ? weightedRating(ratingAverage!, reviewCount, GLOBAL_PRIOR_RATING, MIN_RESTAURANT_CONFIDENCE_REVIEWS) : null
  const recommendationReviews = restaurantReviews.filter((review) => typeof review.wouldRecommend === "boolean")
  const recommendationCount = recommendationReviews.filter((review) => review.wouldRecommend).length
  const recommendationTotal = recommendationReviews.length
  const recommendationRate = recommendationTotal ? recommendationCount / recommendationTotal : null
  const recentReviews = filterSince(restaurantReviews, now, RECENT_WINDOW_DAYS)
  const recentAverageRating = recentReviews.length ? average(recentReviews.map((review) => Number(review.rating || 0)).filter(isValidRating)) : null
  const trendReviews = filterSince(restaurantReviews, now, TREND_WINDOW_DAYS)
  const dishRatings = dishReviews.map((review) => Number(review.rating || 0)).filter(isValidRating)
  const dishAverageRating = dishRatings.length ? average(dishRatings) : null

  const ratingComponent = bayesianRating === null ? 0 : normalizeRating(bayesianRating)
  const recommendationComponent = recommendationRate === null ? 0.45 : recommendationRate
  const volumeComponent = confidenceCurve(reviewCount, MIN_EXCELLENT_REVIEWS)
  const recencyComponent = Math.min(1, recentReviews.length / 8)
  const dishQualityComponent = dishAverageRating === null ? 0.45 : normalizeRating(weightedRating(dishAverageRating, dishRatings.length, GLOBAL_PRIOR_RATING, MIN_DISH_CONFIDENCE_REVIEWS))
  const score = clampScore(100 * (
    OORDERA_SCORE_WEIGHTS.restaurantRating * ratingComponent
    + OORDERA_SCORE_WEIGHTS.recommendation * recommendationComponent
    + OORDERA_SCORE_WEIGHTS.reviewVolume * volumeComponent
    + OORDERA_SCORE_WEIGHTS.recency * recencyComponent
    + OORDERA_SCORE_WEIGHTS.dishQuality * dishQualityComponent
  ))

  return {
    restaurantId,
    score,
    averageRating: roundNullable(ratingAverage, 2),
    bayesianRating: roundNullable(bayesianRating, 2),
    reviewCount,
    recommendationRate: roundNullable(recommendationRate, 4),
    recommendationCount,
    recommendationTotal,
    recentReviewCount: recentReviews.length,
    recentAverageRating: roundNullable(recentAverageRating, 2),
    dishAverageRating: roundNullable(dishAverageRating, 2),
    dishReviewCount: dishRatings.length,
    badges: buildRestaurantBadges({
      score,
      reviewCount,
      recommendationRate,
      recommendationTotal,
      trendReviews,
      bayesianRating,
    }),
  }
}

export function rankRestaurants<T extends { restaurantId: string; isOpenNow?: boolean; name?: string }>(
  restaurants: T[],
  reputations: Record<string, OorderaRestaurantReputation>
) {
  return [...restaurants].sort((a, b) => {
    const aReputation = reputations[a.restaurantId]
    const bReputation = reputations[b.restaurantId]
    return Number(b.isOpenNow ?? false) - Number(a.isOpenNow ?? false)
      || (bReputation?.score ?? 0) - (aReputation?.score ?? 0)
      || (bReputation?.reviewCount ?? 0) - (aReputation?.reviewCount ?? 0)
      || String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr")
  })
}

export function rankDishes<T extends { restaurantId: string; productId: string; name?: string }>(
  dishes: T[],
  reputations: Record<string, OorderaDishReputation>
) {
  return [...dishes].sort((a, b) => {
    const aReputation = reputations[buildDishReputationKey(a.restaurantId, a.productId)]
    const bReputation = reputations[buildDishReputationKey(b.restaurantId, b.productId)]
    return (bReputation?.score ?? 0) - (aReputation?.score ?? 0)
      || (bReputation?.reviewCount ?? 0) - (aReputation?.reviewCount ?? 0)
      || String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr")
  })
}

export function buildDishReputationKey(restaurantId: string, productId: string) {
  return `${restaurantId}__${productId}`
}

function isDishReviewEligibleForRanking(review: ReviewWithId<DishReviewDocument>, reviewableProducts?: DishReviewEligibilityMap) {
  if (!reviewableProducts) return true
  if (!review.restaurantId || !review.productId) return false
  return reviewableProducts[buildDishReputationKey(review.restaurantId, review.productId)] === true
}

function buildDishReputations(reviews: Array<ReviewWithId<DishReviewDocument>>, now: Date) {
  const byDish = new Map<string, Array<ReviewWithId<DishReviewDocument>>>()
  for (const review of reviews) {
    if (!review.restaurantId || !review.productId) continue
    const key = buildDishReputationKey(review.restaurantId, review.productId)
    byDish.set(key, [...(byDish.get(key) ?? []), review])
  }

  const reputations: Record<string, OorderaDishReputation> = {}
  for (const [key, dishReviews] of byDish.entries()) {
    const first = dishReviews[0]
    const ratings = dishReviews.map((review) => Number(review.rating || 0)).filter(isValidRating)
    const averageRating = ratings.length ? average(ratings) : null
    const bayesianRating = averageRating === null ? null : weightedRating(averageRating, ratings.length, GLOBAL_PRIOR_RATING, MIN_DISH_CONFIDENCE_REVIEWS)
    const recentReviewCount = filterSince(dishReviews, now, RECENT_WINDOW_DAYS).length
    const score = bayesianRating === null ? 0 : clampScore(100 * (
      0.55 * normalizeRating(bayesianRating)
      + 0.25 * confidenceCurve(ratings.length, 8)
      + 0.20 * Math.min(1, recentReviewCount / 5)
    ))
    reputations[key] = {
      restaurantId: first.restaurantId,
      productId: first.productId,
      productName: first.productName || "Plat",
      score,
      averageRating: roundNullable(averageRating, 2),
      bayesianRating: roundNullable(bayesianRating, 2),
      reviewCount: ratings.length,
      recentReviewCount,
      badges: buildDishBadges(first.productName || "Plat", ratings.length, bayesianRating, recentReviewCount),
    }
  }
  return reputations
}

function buildRestaurantBadges({
  bayesianRating,
  recommendationRate,
  recommendationTotal,
  reviewCount,
  score,
  trendReviews,
}: {
  bayesianRating: number | null
  recommendationRate: number | null
  recommendationTotal: number
  reviewCount: number
  score: number
  trendReviews: Array<ReviewWithId<RestaurantReviewDocument>>
}): OorderaBadge[] {
  const badges: OorderaBadge[] = []
  if (reviewCount >= MIN_EXCELLENT_REVIEWS && score >= 82 && bayesianRating !== null && bayesianRating >= 4.4) {
    badges.push({ key: "excellent", label: "Excellent", reason: "Score eleve avec volume d'avis suffisant." })
  }
  if (recommendationTotal >= MIN_RECOMMENDED_RESPONSES && recommendationRate !== null && recommendationRate >= 0.9) {
    badges.push({ key: "recommended", label: "Recommande", reason: "Taux de recommandation client superieur a 90%." })
  }
  if (trendReviews.length >= 4 && average(trendReviews.map((review) => Number(review.rating || 0)).filter(isValidRating)) >= 4.5) {
    badges.push({ key: "trending", label: "Tendance", reason: "Avis recents nombreux et tres positifs." })
  }
  if (reviewCount >= 3 && reviewCount < MIN_EXCELLENT_REVIEWS && bayesianRating !== null && bayesianRating >= 4.35) {
    badges.push({ key: "new_favorite", label: "Nouveau favori", reason: "Tres bons premiers retours, volume encore limite." })
  }
  return badges.slice(0, 2)
}

function buildDishBadges(productName: string, reviewCount: number, bayesianRating: number | null, recentReviewCount: number): OorderaBadge[] {
  if (reviewCount >= 5 && bayesianRating !== null && bayesianRating >= 4.45) {
    return [{ key: "popular_dish", label: "Plat populaire", reason: `${productName} obtient une excellente note avec un volume suffisant.` }]
  }
  if (recentReviewCount >= 3 && bayesianRating !== null && bayesianRating >= 4.3) {
    return [{ key: "trending", label: "Tendance", reason: `${productName} reçoit plusieurs bons avis recents.` }]
  }
  return []
}

function groupByRestaurant<T extends { restaurantId: string }>(reviews: T[]) {
  return reviews.reduce<Record<string, T[]>>((groups, review) => {
    if (!review.restaurantId) return groups
    groups[review.restaurantId] = [...(groups[review.restaurantId] ?? []), review]
    return groups
  }, {})
}

function filterSince<T extends { createdAt?: unknown }>(reviews: T[], now: Date, days: number) {
  const start = new Date(now.getTime() - days * DAY_MS)
  return reviews.filter((review) => {
    const date = toReviewDate(review.createdAt)
    return Boolean(date && date >= start && date <= now)
  })
}

function toReviewDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function weightedRating(averageRating: number, reviewCount: number, prior: number, minimumReviews: number) {
  return (reviewCount / (reviewCount + minimumReviews)) * averageRating
    + (minimumReviews / (reviewCount + minimumReviews)) * prior
}

function confidenceCurve(count: number, target: number) {
  return Math.min(1, Math.log1p(Math.max(0, count)) / Math.log1p(target))
}

function normalizeRating(value: number) {
  return Math.max(0, Math.min(1, (value - 1) / 4))
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function isValidRating(value: number) {
  return Number.isFinite(value) && value >= 1 && value <= 5
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function roundNullable(value: number | null, digits: number) {
  return value === null ? null : Number(value.toFixed(digits))
}
