"use client"

import { doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore"

import {
  getDishReviewId,
  normalizeDishReviewInput,
} from "@/lib/reputation/dish-review-core"
import {
  DISH_REVIEWS_COLLECTION,
  type DishReviewInput,
} from "@/lib/reputation/dish-review-types"
import {
  getRestaurantOrderCompletedAt,
  resolveRestaurantReviewCustomer,
  resolveRestaurantReviewSource,
} from "@/lib/reputation/restaurant-review-core"

export function dishReviewRef(
  db: Firestore,
  restaurantId: string,
  orderId: string,
  orderItemId: string,
) {
  return doc(
    db,
    "restaurants",
    restaurantId,
    DISH_REVIEWS_COLLECTION,
    getDishReviewId(orderId, orderItemId),
  )
}

export async function createDishReview(
  db: Firestore,
  order: Record<string, any>,
  input: DishReviewInput,
) {
  const normalized = normalizeDishReviewInput(input)
  const orderRef = doc(
    db,
    "restaurants",
    normalized.restaurantId,
    "orders",
    normalized.orderId,
  )
  const reviewRef = dishReviewRef(
    db,
    normalized.restaurantId,
    normalized.orderId,
    normalized.orderItemId,
  )

  await runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef)

    if (!orderSnapshot.exists()) {
      throw new Error("Commande introuvable.")
    }

    const serverOrder = orderSnapshot.data()
    const customer = resolveRestaurantReviewCustomer(serverOrder || order)
    const orderCompletedAt =
      getRestaurantOrderCompletedAt(serverOrder || order) || serverTimestamp()
    const orderType = normalizeString(
      serverOrder?.orderType ||
        serverOrder?.publicOrderType ||
        serverOrder?.type ||
        serverOrder?.mode,
    )

    transaction.set(reviewRef, {
      restaurantId: normalized.restaurantId,
      orderId: normalized.orderId,
      orderType,
      orderItemId: normalized.orderItemId,
      orderItemIndex: normalized.orderItemIndex,
      productId: normalized.productId,
      productName: normalized.productName,
      productImageUrl: normalized.productImageUrl,
      quantity: normalized.quantity,
      rating: normalized.rating,
      comment: normalized.comment,
      customerDisplayName: customer.customerName,
      customerName: customer.customerName,
      customerId: customer.customerId,
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
