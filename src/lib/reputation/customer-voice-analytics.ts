import type { DishReviewDocument } from "./dish-review-types"
import type { RestaurantReviewDocument } from "./restaurant-review-types"

export type CustomerVoicePeriod = "7d" | "30d" | "90d" | "all"
export type CustomerVoiceCommentFilter = "all" | "positive" | "watch"
export type CustomerVoiceDishSort = "reviewCount" | "bestRated" | "mostCommented" | "lowestRated"

export type ReviewWithId<T> = T & { id?: string }

export type CustomerVoiceTrendGranularity = "day" | "week" | "month"

export type CustomerVoiceTrendPoint = {
  key: string
  label: string
  averageRating: number | null
  reviewCount: number
}

export type CustomerVoiceRatingBucket = {
  rating: 1 | 2 | 3 | 4 | 5
  count: number
  percentage: number
}

export type CustomerVoiceSignal = {
  id: string
  tone: "positive" | "warning" | "neutral"
  title: string
  description: string
}

export type CustomerVoiceDishSummary = {
  productId: string
  productName: string
  productImageUrl: string | null
  reviewCount: number
  averageRating: number
  fiveStarCount: number
  commentCount: number
  latestComments: Array<ReviewWithId<DishReviewDocument>>
}

export type CustomerVoiceAnalytics = {
  currentRestaurantReviews: Array<ReviewWithId<RestaurantReviewDocument>>
  currentDishReviews: Array<ReviewWithId<DishReviewDocument>>
  previousRestaurantReviews: Array<ReviewWithId<RestaurantReviewDocument>>
  periodWindow: CustomerVoicePeriodWindow
  kpis: {
    averageRating: number | null
    reviewCount: number
    recommendationRate: number | null
    recommendationCount: number
    recommendationTotal: number
    ratingEvolution: number | null
  }
  trendGranularity: CustomerVoiceTrendGranularity
  trend: CustomerVoiceTrendPoint[]
  ratingDistribution: CustomerVoiceRatingBucket[]
  dishSummaries: CustomerVoiceDishSummary[]
  signals: CustomerVoiceSignal[]
}

export type CustomerVoicePeriodWindow = {
  period: CustomerVoicePeriod
  currentStart: Date | null
  currentEnd: Date
  previousStart: Date | null
  previousEnd: Date | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function buildCustomerVoiceAnalytics({
  dishReviews,
  now = new Date(),
  period,
  restaurantReviews,
}: {
  dishReviews: Array<ReviewWithId<DishReviewDocument>>
  now?: Date
  period: CustomerVoicePeriod
  restaurantReviews: Array<ReviewWithId<RestaurantReviewDocument>>
}): CustomerVoiceAnalytics {
  const periodWindow = getCustomerVoicePeriodWindow(period, now)
  const publishedRestaurantReviews = restaurantReviews.filter((review) => review.status === "published")
  const publishedDishReviews = dishReviews.filter((review) => review.status === "published")
  const currentRestaurantReviews = filterReviewsByPeriod(publishedRestaurantReviews, periodWindow, "createdAt")
  const currentDishReviews = filterReviewsByPeriod(publishedDishReviews, periodWindow, "createdAt")
  const previousRestaurantReviews = filterPreviousReviews(publishedRestaurantReviews, periodWindow, "createdAt")
  const currentAverage = calculateAverageRating(currentRestaurantReviews)
  const previousAverage = calculateAverageRating(previousRestaurantReviews)
  const recommendation = calculateRecommendationRate(currentRestaurantReviews)
  const dishSummaries = buildDishReviewSummaries(currentDishReviews)

  return {
    currentRestaurantReviews,
    currentDishReviews,
    previousRestaurantReviews,
    periodWindow,
    kpis: {
      averageRating: currentAverage,
      reviewCount: currentRestaurantReviews.length,
      recommendationRate: recommendation.rate,
      recommendationCount: recommendation.positive,
      recommendationTotal: recommendation.total,
      ratingEvolution: period === "all" || currentAverage === null || previousAverage === null ? null : currentAverage - previousAverage,
    },
    trendGranularity: getTrendGranularity(period),
    trend: buildRatingTrend(currentRestaurantReviews, period),
    ratingDistribution: buildRatingDistribution(currentRestaurantReviews),
    dishSummaries,
    signals: buildCustomerVoiceSignals(currentRestaurantReviews, previousRestaurantReviews, dishSummaries, recommendation.rate, period),
  }
}

export function getCustomerVoicePeriodWindow(period: CustomerVoicePeriod, now = new Date()): CustomerVoicePeriodWindow {
  const currentEnd = new Date(now)
  if (period === "all") {
    return { period, currentStart: null, currentEnd, previousStart: null, previousEnd: null }
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  const currentStart = new Date(currentEnd.getTime() - days * DAY_MS)
  const previousEnd = new Date(currentStart)
  const previousStart = new Date(previousEnd.getTime() - days * DAY_MS)
  return { period, currentStart, currentEnd, previousStart, previousEnd }
}

export function filterRestaurantComments(
  reviews: Array<ReviewWithId<RestaurantReviewDocument>>,
  filter: CustomerVoiceCommentFilter
) {
  const withComments = reviews.filter((review) => Boolean(review.comment?.trim()))
  if (filter === "positive") return withComments.filter((review) => Number(review.rating || 0) >= 4)
  if (filter === "watch") return withComments.filter((review) => Number(review.rating || 0) <= 3 || review.wouldRecommend === false)
  return withComments
}

export function sortDishSummaries(
  summaries: CustomerVoiceDishSummary[],
  sort: CustomerVoiceDishSort
) {
  const sorted = [...summaries]
  if (sort === "bestRated") {
    return sorted.sort((a, b) => {
      const aReliable = a.reviewCount >= 3 ? 1 : 0
      const bReliable = b.reviewCount >= 3 ? 1 : 0
      return bReliable - aReliable || b.averageRating - a.averageRating || b.reviewCount - a.reviewCount || a.productName.localeCompare(b.productName)
    })
  }
  if (sort === "mostCommented") {
    return sorted.sort((a, b) => b.commentCount - a.commentCount || b.reviewCount - a.reviewCount || b.averageRating - a.averageRating || a.productName.localeCompare(b.productName))
  }
  if (sort === "lowestRated") {
    return sorted.sort((a, b) => a.averageRating - b.averageRating || b.reviewCount - a.reviewCount || a.productName.localeCompare(b.productName))
  }
  return sorted.sort((a, b) => b.reviewCount - a.reviewCount || b.averageRating - a.averageRating || a.productName.localeCompare(b.productName))
}

export function toReviewDate(value: unknown): Date | null {
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

function filterReviewsByPeriod<T extends { createdAt?: unknown }>(
  reviews: Array<ReviewWithId<T>>,
  window: CustomerVoicePeriodWindow,
  field: keyof T
) {
  if (!window.currentStart) return [...reviews]
  return reviews.filter((review) => {
    const date = toReviewDate(review[field])
    return Boolean(date && date >= window.currentStart! && date <= window.currentEnd)
  })
}

function filterPreviousReviews<T extends { createdAt?: unknown }>(
  reviews: Array<ReviewWithId<T>>,
  window: CustomerVoicePeriodWindow,
  field: keyof T
) {
  if (!window.previousStart || !window.previousEnd) return []
  return reviews.filter((review) => {
    const date = toReviewDate(review[field])
    return Boolean(date && date >= window.previousStart! && date < window.previousEnd!)
  })
}

function calculateAverageRating(reviews: Array<{ rating?: number }>) {
  if (reviews.length === 0) return null
  return reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
}

function calculateRecommendationRate(reviews: Array<{ wouldRecommend?: boolean | null }>) {
  const recommendationReviews = reviews.filter((review) => typeof review.wouldRecommend === "boolean")
  const positive = recommendationReviews.filter((review) => review.wouldRecommend).length
  return {
    positive,
    total: recommendationReviews.length,
    rate: recommendationReviews.length > 0 ? positive / recommendationReviews.length : null,
  }
}

function getTrendGranularity(period: CustomerVoicePeriod): CustomerVoiceTrendGranularity {
  if (period === "7d" || period === "30d") return "day"
  if (period === "90d") return "week"
  return "month"
}

function buildRatingTrend(
  reviews: Array<ReviewWithId<RestaurantReviewDocument>>,
  period: CustomerVoicePeriod
): CustomerVoiceTrendPoint[] {
  const granularity = getTrendGranularity(period)
  const groups = new Map<string, { label: string; count: number; sum: number; time: number }>()

  for (const review of reviews) {
    const date = toReviewDate(review.createdAt)
    if (!date) continue
    const group = getTrendGroup(date, granularity)
    const existing = groups.get(group.key)
    if (existing) {
      existing.count += 1
      existing.sum += Number(review.rating || 0)
    } else {
      groups.set(group.key, { label: group.label, count: 1, sum: Number(review.rating || 0), time: group.time })
    }
  }

  return Array.from(groups.entries())
    .sort(([, a], [, b]) => a.time - b.time)
    .map(([key, group]) => ({
      key,
      label: group.label,
      averageRating: group.count > 0 ? group.sum / group.count : null,
      reviewCount: group.count,
    }))
}

function getTrendGroup(date: Date, granularity: CustomerVoiceTrendGranularity) {
  if (granularity === "day") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    return {
      key: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      time: start.getTime(),
    }
  }
  if (granularity === "week") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
    return {
      key: start.toISOString().slice(0, 10),
      label: `Semaine ${start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`,
      time: start.getTime(),
    }
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  return {
    key: start.toISOString().slice(0, 7),
    label: start.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    time: start.getTime(),
  }
}

function buildRatingDistribution(reviews: Array<ReviewWithId<RestaurantReviewDocument>>): CustomerVoiceRatingBucket[] {
  return ([5, 4, 3, 2, 1] as const).map((rating) => {
    const count = reviews.filter((review) => Number(review.rating || 0) === rating).length
    return { rating, count, percentage: reviews.length > 0 ? count / reviews.length : 0 }
  })
}

export function buildDishReviewSummaries(reviews: Array<ReviewWithId<DishReviewDocument>>): CustomerVoiceDishSummary[] {
  const summaries = new Map<string, CustomerVoiceDishSummary & { ratingSum: number }>()

  for (const review of reviews) {
    const productId = review.productId || review.orderItemId
    if (!productId) continue
    const rating = Number(review.rating || 0)
    const existing = summaries.get(productId)
    if (existing) {
      existing.reviewCount += 1
      existing.ratingSum += rating
      existing.averageRating = existing.ratingSum / existing.reviewCount
      if (rating === 5) existing.fiveStarCount += 1
      if (review.comment?.trim()) {
        existing.commentCount += 1
        existing.latestComments.push(review)
      }
    } else {
      summaries.set(productId, {
        productId,
        productName: review.productName || "Plat",
        productImageUrl: review.productImageUrl || null,
        reviewCount: 1,
        ratingSum: rating,
        averageRating: rating,
        fiveStarCount: rating === 5 ? 1 : 0,
        commentCount: review.comment?.trim() ? 1 : 0,
        latestComments: review.comment?.trim() ? [review] : [],
      })
    }
  }

  return Array.from(summaries.values()).map(({ ratingSum, ...summary }) => ({
    ...summary,
    latestComments: [...summary.latestComments].sort((a, b) => {
      const aDate = toReviewDate(a.createdAt)?.getTime() || 0
      const bDate = toReviewDate(b.createdAt)?.getTime() || 0
      return bDate - aDate
    }),
  }))
}

function buildCustomerVoiceSignals(
  restaurantReviews: Array<ReviewWithId<RestaurantReviewDocument>>,
  previousReviews: Array<ReviewWithId<RestaurantReviewDocument>>,
  dishSummaries: CustomerVoiceDishSummary[],
  recommendationRate: number | null,
  period: CustomerVoicePeriod
): CustomerVoiceSignal[] {
  const signals: CustomerVoiceSignal[] = []
  const currentAverage = calculateAverageRating(restaurantReviews)
  const previousAverage = calculateAverageRating(previousReviews)
  const watchReviews = restaurantReviews.filter((review) => Number(review.rating || 0) <= 3 || review.wouldRecommend === false)
  const bestDish = sortDishSummaries(dishSummaries.filter((dish) => dish.reviewCount >= 3), "bestRated")[0]

  if (period !== "all" && currentAverage !== null && previousAverage !== null && currentAverage - previousAverage >= 0.25) {
    signals.push({
      id: "rating-improved",
      tone: "positive",
      title: "La satisfaction progresse",
      description: `La note moyenne gagne ${(currentAverage - previousAverage).toFixed(1)} point par rapport a la periode precedente.`,
    })
  }

  if (watchReviews.length > 0) {
    signals.push({
      id: "watch-comments",
      tone: "warning",
      title: "Avis a surveiller",
      description: `${watchReviews.length} retour client demande une attention particuliere sur la periode.`,
    })
  }

  if (bestDish) {
    signals.push({
      id: "best-dish",
      tone: "positive",
      title: "Plat tres apprecie",
      description: `${bestDish.productName} obtient ${bestDish.averageRating.toFixed(1)}/5 sur ${bestDish.reviewCount} avis.`,
    })
  }

  if (recommendationRate !== null && recommendationRate < 0.7) {
    signals.push({
      id: "recommendation-low",
      tone: "warning",
      title: "Recommandation perfectible",
      description: `Le taux de recommandation est de ${Math.round(recommendationRate * 100)}%.`,
    })
  }

  if (signals.length === 0) {
    signals.push({
      id: "not-enough-data",
      tone: "neutral",
      title: "Donnees en construction",
      description: "Les prochains avis permettront de degager des tendances plus fiables.",
    })
  }

  return signals.slice(0, 3)
}
