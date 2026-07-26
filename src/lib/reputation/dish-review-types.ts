export const DISH_REVIEWS_COLLECTION = "dishReviews" as const
export const DISH_REVIEW_COMMENT_MAX_LENGTH = 400 as const

export type DishReviewRating = 1 | 2 | 3 | 4 | 5
export type DishReviewStatus = "published" | "hidden" | "deleted"
export type DishReviewSource = "order_tracking" | "qr_table" | "pickup_delivery_link"

export interface DishReviewInput {
  restaurantId: string
  orderId: string
  orderItemId: string
  orderItemIndex: number
  productId: string
  productName: string
  productImageUrl?: string | null
  quantity: number
  rating: number
  reviewToken: string
  comment?: string | null
}

export interface DishReviewDocument {
  restaurantId: string
  orderId: string
  orderType: string | null
  orderItemId: string
  orderItemIndex: number
  productId: string
  productName: string
  productImageUrl: string | null
  quantity: number
  rating: DishReviewRating
  comment: string | null
  customerDisplayName?: string | null
  customerId: string | null
  customerName: string
  source: DishReviewSource
  status: DishReviewStatus
  reviewToken?: string
  orderCompletedAt: unknown
  createdAt: unknown
  updatedAt: unknown
}
