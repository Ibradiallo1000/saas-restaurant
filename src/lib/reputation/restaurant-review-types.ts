export const RESTAURANT_REVIEWS_COLLECTION = "reviews" as const
export const RESTAURANT_REVIEW_AGGREGATES_COLLECTION = "reviewAggregates" as const
export const RESTAURANT_REVIEW_SUMMARY_ID = "summary" as const
export const RESTAURANT_REVIEW_COMMENT_MAX_LENGTH = 600 as const

export type RestaurantReviewSource =
  | "order_tracking"
  | "qr_table"
  | "pickup_delivery_link"

export type RestaurantReviewStatus = "published" | "hidden" | "deleted"

export type RestaurantReviewRating = 1 | 2 | 3 | 4 | 5

export interface RestaurantReviewInput {
  restaurantId: string
  orderId: string
  rating: number
  wouldRecommend: boolean
  reviewToken: string
  comment?: string | null
  tableSessionId?: string | null
}

export interface RestaurantReviewAuthor {
  displayName: string
  customerId: string | null
}

export interface RestaurantReviewDocument {
  restaurantId: string
  orderId: string
  orderType: string | null
  rating: RestaurantReviewRating
  wouldRecommend: boolean
  comment: string | null
  customerDisplayName?: string | null
  customerId: string | null
  customerName: string
  author: RestaurantReviewAuthor
  source: RestaurantReviewSource
  status: RestaurantReviewStatus
  reviewToken?: string
  orderCompletedAt: unknown
  createdAt: unknown
  updatedAt: unknown
}

export interface RestaurantReviewSummary {
  restaurantId: string
  reviewCount: number
  ratingSum: number
  averageRating: number
  wouldRecommendCount: number
  recommendationRate: number
  lastReviewAt: unknown
  updatedAt: unknown
}
