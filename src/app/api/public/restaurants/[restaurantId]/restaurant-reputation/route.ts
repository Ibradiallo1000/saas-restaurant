import { NextResponse } from "next/server"

import { adminDb } from "@/lib/firebase-admin"
import { scoreRestaurant } from "@/lib/reputation/oordera-score"
import { RESTAURANT_REVIEWS_COLLECTION, type RestaurantReviewDocument } from "@/lib/reputation/restaurant-review-types"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params
  if (!isSafeDocumentId(restaurantId)) {
    return NextResponse.json({ reputation: null }, { status: 400 })
  }

  try {
    const reviewsSnapshot = await adminDb
      .collection("restaurants")
      .doc(restaurantId)
      .collection(RESTAURANT_REVIEWS_COLLECTION)
      .where("status", "==", "published")
      .limit(1000)
      .get()

    const reputation = scoreRestaurant({
      restaurantId,
      restaurantReviews: reviewsSnapshot.docs.map((document) => ({
        id: document.id,
        ...(document.data() as RestaurantReviewDocument),
      })),
      dishReviews: [],
    })

    if (reputation.reviewCount <= 0) {
      return NextResponse.json({ reputation: null })
    }

    return NextResponse.json({
      reputation: {
        averageRating: reputation.averageRating,
        bayesianRating: reputation.bayesianRating,
        reviewCount: reputation.reviewCount,
      },
    })
  } catch (error) {
    console.error("PUBLIC RESTAURANT REPUTATION ERROR", error)
    return NextResponse.json({ reputation: null }, { status: 500 })
  }
}

function isSafeDocumentId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value)
}
