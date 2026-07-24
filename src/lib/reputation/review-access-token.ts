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

function orderReviewAccessKey(restaurantId: string, orderId: string) {
  return `oordera:order-access:${restaurantId}:${orderId}`
}

function orderReviewSubmittedKey(restaurantId: string, orderId: string) {
  return `oordera:order-review-submitted:${restaurantId}:${orderId}`
}
