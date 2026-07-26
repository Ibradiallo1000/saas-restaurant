import { NextResponse } from "next/server"

import { adminDb } from "@/lib/firebase-admin"
import { DISH_REVIEWS_COLLECTION, type DishReviewDocument } from "@/lib/reputation/dish-review-types"
import { buildDishReviewSummaries } from "@/lib/reputation/customer-voice-analytics"

export const dynamic = "force-dynamic"

type ProductSummary = {
  averageRating: number
  reviewCount: number
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params
  if (!isSafeDocumentId(restaurantId)) {
    return NextResponse.json({ summaries: {} }, { status: 400 })
  }

  try {
    const restaurantRef = adminDb.collection("restaurants").doc(restaurantId)
    const productsSnapshot = await restaurantRef.collection("products").get()
    const reviewableProductIds = new Set(
      productsSnapshot.docs
        .filter((document) => document.data()?.reviewsEnabled === true)
        .map((document) => document.id)
    )

    if (reviewableProductIds.size === 0) {
      return NextResponse.json({ summaries: {} })
    }

    const reviewsSnapshot = await restaurantRef
      .collection(DISH_REVIEWS_COLLECTION)
      .where("status", "==", "published")
      .limit(1000)
      .get()

    const dishSummaries = buildDishReviewSummaries(
      reviewsSnapshot.docs
        .map((document) => ({ id: document.id, ...(document.data() as DishReviewDocument) }))
        .filter((review) => reviewableProductIds.has(review.productId || ""))
    )

    const summaries: Record<string, ProductSummary> = {}
    dishSummaries.forEach((summary) => {
      summaries[summary.productId] = {
        averageRating: Math.round(summary.averageRating * 10) / 10,
        reviewCount: summary.reviewCount,
      }
    })

    return NextResponse.json({ summaries })
  } catch (error) {
    console.error("PUBLIC DISH REVIEW SUMMARIES ERROR", error)
    return NextResponse.json({ summaries: {} }, { status: 500 })
  }
}

function isSafeDocumentId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value)
}
