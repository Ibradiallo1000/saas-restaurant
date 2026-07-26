import { doc, type Firestore } from "firebase/firestore"

export const REVIEW_ACCESS_COLLECTION = "reviewAccess" as const
export const REVIEW_ACCESS_TOKEN_VERSION = 1 as const
export const REVIEW_ACCESS_TOKEN_MIN_LENGTH = 36 as const

export function generateReviewAccessToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  throw new Error("Génération sécurisée du token indisponible sur cet appareil.")
}

export function restaurantReviewAccessRef(db: Firestore, restaurantId: string, orderId: string) {
  return doc(db, "restaurants", restaurantId, REVIEW_ACCESS_COLLECTION, orderId)
}

export function rememberOrderReviewAccess(input: {
  restaurantId: string
  orderId: string
  reviewToken: string
}) {
  if (typeof window === "undefined" || !input.restaurantId || !input.orderId || !input.reviewToken) return
  window.localStorage?.setItem(orderReviewAccessKey(input.restaurantId, input.orderId), input.reviewToken)
  window.sessionStorage?.setItem(orderReviewAccessKey(input.restaurantId, input.orderId), input.reviewToken)
}

export function getStoredOrderReviewAccess(restaurantId: string, orderId: string) {
  if (typeof window === "undefined" || !restaurantId || !orderId) return null
  return (
    window.sessionStorage?.getItem(orderReviewAccessKey(restaurantId, orderId)) ||
    window.localStorage?.getItem(orderReviewAccessKey(restaurantId, orderId)) ||
    null
  )
}

export function markOrderReviewSubmitted(restaurantId: string, orderId: string) {
  if (typeof window === "undefined" || !restaurantId || !orderId) return
  window.localStorage?.setItem(orderReviewSubmittedKey(restaurantId, orderId), "true")
  window.sessionStorage?.setItem(orderReviewSubmittedKey(restaurantId, orderId), "true")
}

export function hasLocalOrderReviewSubmission(restaurantId: string, orderId: string) {
  if (typeof window === "undefined" || !restaurantId || !orderId) return false
  return (
    window.sessionStorage?.getItem(orderReviewSubmittedKey(restaurantId, orderId)) === "true" ||
    window.localStorage?.getItem(orderReviewSubmittedKey(restaurantId, orderId)) === "true"
  )
}

export function rememberDishReviewSubmission(input: {
  restaurantId: string
  orderId: string
  orderItemId: string
  rating: number
  comment: string | null
}) {
  if (typeof window === "undefined" || !input.restaurantId || !input.orderId || !input.orderItemId) return
  const serialized = JSON.stringify({
    rating: input.rating,
    comment: input.comment || null,
  })
  window.localStorage?.setItem(dishReviewSubmittedKey(input.restaurantId, input.orderId, input.orderItemId), serialized)
  window.sessionStorage?.setItem(dishReviewSubmittedKey(input.restaurantId, input.orderId, input.orderItemId), serialized)
}

export function getLocalDishReviewSubmission(restaurantId: string, orderId: string, orderItemId: string): { rating: number; comment: string | null } | null {
  if (typeof window === "undefined" || !restaurantId || !orderId || !orderItemId) return null
  const raw =
    window.sessionStorage?.getItem(dishReviewSubmittedKey(restaurantId, orderId, orderItemId)) ||
    window.localStorage?.getItem(dishReviewSubmittedKey(restaurantId, orderId, orderItemId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const rating = Number(parsed?.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null
    return {
      rating,
      comment: typeof parsed?.comment === "string" && parsed.comment.trim() ? parsed.comment.trim() : null,
    }
  } catch {
    return null
  }
}

function orderReviewAccessKey(restaurantId: string, orderId: string) {
  return `oordera:order-access:${restaurantId}:${orderId}`
}

function orderReviewSubmittedKey(restaurantId: string, orderId: string) {
  return `oordera:order-review-submitted:${restaurantId}:${orderId}`
}

function dishReviewSubmittedKey(restaurantId: string, orderId: string, orderItemId: string) {
  return `oordera:dish-review-submitted:${restaurantId}:${orderId}:${orderItemId}`
}
