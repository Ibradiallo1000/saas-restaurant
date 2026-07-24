import type {
  RestaurantReviewInput,
  RestaurantReviewRating,
  RestaurantReviewSource,
} from "./restaurant-review-types"

export const RESTAURANT_REVIEW_COMMENT_MAX_LENGTH = 600 as const

const FINAL_ORDER_STATUSES = new Set(["served", "picked_up", "completed", "delivered", "livree", "livré", "recuperee", "récupérée", "terminee", "terminée"])
const BLOCKED_ORDER_STATUSES = new Set(["cancelled", "canceled", "annulee", "annulée", "refused", "rejected", "failed"])
const FAILED_PAYMENT_STATUSES = new Set(["failed", "rejected", "cancelled", "canceled"])

export function normalizeRestaurantReviewInput(input: RestaurantReviewInput) {
  const restaurantId = input.restaurantId.trim()
  const orderId = input.orderId.trim()
  const rating = normalizeRestaurantReviewRating(input.rating)
  const comment = normalizeRestaurantReviewComment(input.comment)
  const reviewToken = typeof input.reviewToken === "string" ? input.reviewToken.trim() : ""

  if (!restaurantId) throw new Error("restaurantId is required")
  if (!orderId) throw new Error("orderId is required")
  if (!reviewToken) throw new Error("reviewToken is required")
  if (!rating) throw new Error("rating must be between 1 and 5")
  if (typeof input.wouldRecommend !== "boolean") throw new Error("wouldRecommend must be boolean")

  return {
    restaurantId,
    orderId,
    rating,
    wouldRecommend: input.wouldRecommend,
    reviewToken,
    comment,
    tableSessionId: typeof input.tableSessionId === "string" && input.tableSessionId.trim() ? input.tableSessionId.trim() : null,
  }
}

export function normalizeRestaurantReviewRating(value: unknown): RestaurantReviewRating | null {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 5) return null
  return number as RestaurantReviewRating
}

export function normalizeRestaurantReviewComment(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new Error("comment must be a string")
  const trimmed = value.replace(/\s+/g, " ").trim()
  if (!trimmed) return null
  if (trimmed.length > RESTAURANT_REVIEW_COMMENT_MAX_LENGTH) {
    throw new Error(`comment must be ${RESTAURANT_REVIEW_COMMENT_MAX_LENGTH} characters or less`)
  }
  return trimmed
}

export function isRestaurantOrderReviewEligible(order: Record<string, any> | null | undefined) {
  if (!order) return false
  if (order.restaurantId && typeof order.restaurantId === "string" && !order.restaurantId.trim()) return false
  if (isBlockedStatus(order.status) || isBlockedStatus(order.orderStatus) || isBlockedStatus(order.kitchenStatus)) return false
  if (isFailedPaymentStatus(order.paymentStatus) || isFailedPaymentStatus(order.paymentIntentStatus) || isFailedPaymentStatus(order.paymentVerificationStatus)) return false

  return Boolean(getRestaurantOrderCompletedAt(order))
}

export function getRestaurantOrderCompletedAt(order: Record<string, any> | null | undefined): unknown | null {
  if (!order) return null
  const timestamp =
    order.timestamps?.servedAt ??
    order.timestamps?.pickedUpAt ??
    order.timestamps?.deliveredAt ??
    order.servedAt ??
    order.pickedUpAt ??
    order.deliveredAt ??
    order.completedAt ??
    null

  if (timestamp) return timestamp

  if (
    isFinalStatus(order.kitchenStatus) ||
    isFinalStatus(order.orderStatus) ||
    isFinalStatus(order.status) ||
    isFinalStatus(order.deliveryStatus) ||
    isFinalStatus(order.pickupStatus) ||
    isFinalStatus(order.fulfillmentStatus)
  ) {
    return order.updatedAt ?? order.createdAt ?? null
  }

  return null
}

export function resolveRestaurantReviewSource(order: Record<string, any> | null | undefined): RestaurantReviewSource {
  const source = String(order?.source || "").toLowerCase()
  const orderType = String(order?.orderType || order?.publicOrderType || order?.type || "").toLowerCase()
  if (source === "qr_table" || source === "qr" || orderType === "dine_in") return "qr_table"
  return "pickup_delivery_link"
}

export function resolveRestaurantReviewCustomer(order: Record<string, any> | null | undefined) {
  const rawName =
    stringValue(order?.customer?.name) ||
    stringValue(order?.customerName) ||
    stringValue(order?.createdByLabel)
  const phone =
    stringValue(order?.customer?.phone) ||
    stringValue(order?.phoneNumber) ||
    stringValue(order?.customerPhone)
  const createdBy = stringValue(order?.createdBy)

  return {
    customerId: createdBy || normalizeCustomerPhoneIdentifier(phone),
    customerName: anonymizeCustomerName(rawName),
  }
}

export function buildInitialRestaurantReviewSummary(restaurantId: string, now: unknown) {
  return {
    restaurantId,
    reviewCount: 0,
    ratingSum: 0,
    averageRating: 0,
    wouldRecommendCount: 0,
    recommendationRate: 0,
    lastReviewAt: null,
    updatedAt: now,
  }
}

export function computeNextRestaurantReviewSummary(input: {
  previous?: Record<string, any> | null
  restaurantId: string
  rating: number
  wouldRecommend: boolean
  now: unknown
}) {
  const previous = input.previous || {}
  const reviewCount = Math.max(0, Number(previous.reviewCount || 0)) + 1
  const ratingSum = Math.max(0, Number(previous.ratingSum || 0)) + input.rating
  const wouldRecommendCount = Math.max(0, Number(previous.wouldRecommendCount || 0)) + (input.wouldRecommend ? 1 : 0)

  return {
    restaurantId: input.restaurantId,
    reviewCount,
    ratingSum,
    averageRating: Number((ratingSum / reviewCount).toFixed(2)),
    wouldRecommendCount,
    recommendationRate: Number((wouldRecommendCount / reviewCount).toFixed(4)),
    lastReviewAt: input.now,
    updatedAt: input.now,
  }
}

function isFinalStatus(value: unknown) {
  return FINAL_ORDER_STATUSES.has(String(value || "").toLowerCase())
}

function isBlockedStatus(value: unknown) {
  return BLOCKED_ORDER_STATUSES.has(String(value || "").toLowerCase())
}

function isFailedPaymentStatus(value: unknown) {
  return FAILED_PAYMENT_STATUSES.has(String(value || "").toLowerCase())
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function anonymizeCustomerName(value: string) {
  if (!value || value.toLowerCase() === "toi") return "Client Oordera"
  const first = value.split(/\s+/)[0]?.trim()
  if (!first) return "Client Oordera"
  return first.length <= 2 ? `${first[0] || "C"}.` : first
}

function normalizeCustomerPhoneIdentifier(value: string) {
  const digits = value.replace(/[^\d+]/g, "")
  return digits || null
}
