"use client"

import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore"

import {
  RESTAURANT_REVIEWS_COLLECTION,
  type RestaurantReviewInput,
} from "@/lib/reputation/restaurant-review-types"
import {
  getRestaurantOrderCompletedAt,
  normalizeRestaurantReviewInput,
  resolveRestaurantReviewCustomer,
  resolveRestaurantReviewSource,
} from "@/lib/reputation/restaurant-review-core"

export function restaurantReviewRef(db: Firestore, restaurantId: string, orderId: string) {
  return doc(db, "restaurants", restaurantId, RESTAURANT_REVIEWS_COLLECTION, orderId)
}

export async function createRestaurantReview(db: Firestore, order: Record<string, any>, input: RestaurantReviewInput) {
  const normalized = normalizeRestaurantReviewInput(input)
  const orderRef = doc(db, "restaurants", normalized.restaurantId, "orders", normalized.orderId)
  const reviewRef = restaurantReviewRef(db, normalized.restaurantId, normalized.orderId)

  await runTransaction(db, async (transaction) => {
    const [orderSnapshot, reviewSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(reviewRef),
    ])

    if (!orderSnapshot.exists()) {
      throw new Error("Commande introuvable.")
    }

    if (reviewSnapshot.exists()) {
      throw new Error("Un avis a déjà été envoyé pour cette commande.")
    }

    const serverOrder = orderSnapshot.data()
    const customer = resolveRestaurantReviewCustomer(serverOrder || order)
    const orderCompletedAt = getRestaurantOrderCompletedAt(serverOrder || order) || serverTimestamp()
    const orderType = normalizeString(serverOrder?.orderType || serverOrder?.publicOrderType || serverOrder?.type || serverOrder?.mode)

    transaction.set(reviewRef, {
      restaurantId: normalized.restaurantId,
      orderId: normalized.orderId,
      orderType,
      rating: normalized.rating,
      wouldRecommend: normalized.wouldRecommend,
      comment: normalized.comment,
      customerDisplayName: customer.customerName,
      customerName: customer.customerName,
      customerId: customer.customerId,
      author: {
        displayName: customer.customerName,
        customerId: customer.customerId,
      },
      source: resolveRestaurantReviewSource(serverOrder || order),
      status: "published",
      reviewToken: normalized.reviewToken,
      orderCompletedAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}
