import type {
  DishReviewInput,
  DishReviewRating,
} from "./dish-review-types"

export const DISH_REVIEW_COMMENT_MAX_LENGTH = 400 as const

export type ReviewableOrderItem = {
  orderItemId: string
  orderItemIndex: number
  productId: string
  productName: string
  productImageUrl: string | null
  quantity: number
  reviewsEnabled: true
}

export function normalizeDishReviewInput(input: DishReviewInput) {
  const restaurantId = input.restaurantId.trim()
  const orderId = input.orderId.trim()
  const orderItemId = input.orderItemId.trim()
  const productId = input.productId.trim()
  const productName = input.productName.replace(/\s+/g, " ").trim()
  const productImageUrl = normalizeOptionalUrl(input.productImageUrl)
  const orderItemIndex = Number(input.orderItemIndex)
  const quantity = Math.max(1, Math.trunc(Number(input.quantity || 1)))
  const rating = normalizeDishReviewRating(input.rating)
  const comment = normalizeDishReviewComment(input.comment)
  const reviewToken = typeof input.reviewToken === "string" ? input.reviewToken.trim() : ""

  if (!restaurantId) throw new Error("restaurantId is required")
  if (!orderId) throw new Error("orderId is required")
  if (!orderItemId) throw new Error("orderItemId is required")
  if (!Number.isInteger(orderItemIndex) || orderItemIndex < 0) throw new Error("orderItemIndex must be a positive integer")
  if (!productId) throw new Error("productId is required")
  if (!productName) throw new Error("productName is required")
  if (!reviewToken) throw new Error("reviewToken is required")
  if (!rating) throw new Error("rating must be between 1 and 5")

  return {
    restaurantId,
    orderId,
    orderItemId,
    orderItemIndex,
    productId,
    productName,
    productImageUrl,
    quantity,
    rating,
    reviewToken,
    comment,
  }
}

export function normalizeDishReviewRating(value: unknown): DishReviewRating | null {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 5) return null
  return number as DishReviewRating
}

export function normalizeDishReviewComment(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new Error("comment must be a string")
  const trimmed = value.replace(/\s+/g, " ").trim()
  if (!trimmed) return null
  if (trimmed.length > DISH_REVIEW_COMMENT_MAX_LENGTH) {
    throw new Error(`comment must be ${DISH_REVIEW_COMMENT_MAX_LENGTH} characters or less`)
  }
  return trimmed
}

export function getReviewableOrderItems(order: Record<string, any> | null | undefined): ReviewableOrderItem[] {
  const items = Array.isArray(order?.items) ? order.items : []
  return items
    .map((item: any, index: number): ReviewableOrderItem | null => {
      if (item?.reviewsEnabled !== true) return null

      const productId = stringValue(item?.productId)
      const productName = stringValue(item?.name || item?.productName || item?.label)
      if (!productId || !productName) return null
      const quantity = Math.trunc(Number(item?.quantity || 0))
      if (!Number.isFinite(quantity) || quantity <= 0) return null

      const itemStatus = stringValue(item?.status).toLowerCase()
      if (["cancelled", "canceled", "removed", "deleted", "void", "refunded"].includes(itemStatus)) return null

      return {
        orderItemId: stringValue(item?.id) || `${index}-${productId}`,
        orderItemIndex: index,
        productId,
        productName,
        productImageUrl: normalizeOptionalUrl(item?.imageUrl || item?.image || item?.productImageUrl || item?.imageSnapshot),
        quantity,
        reviewsEnabled: true,
      }
    })
    .filter((item): item is ReviewableOrderItem => Boolean(item))
}

export function getDishReviewId(orderId: string, orderItemId: string) {
  return `${orderId}_${orderItemId}`
}

function normalizeOptionalUrl(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}
