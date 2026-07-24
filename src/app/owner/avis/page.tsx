"use client"

import * as React from "react"
import { collection, limit, orderBy, query, where } from "firebase/firestore"
import { MessageSquareText, Star, ThumbsUp } from "lucide-react"

import { OwnerSectionPage } from "@/app/owner/_components/OwnerSectionPage"
import { Badge } from "@/components/ui/badge"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import {
  RESTAURANT_REVIEWS_COLLECTION,
  type RestaurantReviewDocument,
} from "@/lib/reputation/restaurant-review-types"
import { cn } from "@/lib/utils"

export default function OwnerReviewsPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, RESTAURANT_REVIEWS_COLLECTION),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      limit(50)
    )
  }, [db, restaurantId])
  const { data: reviews, isLoading } = useCollection<RestaurantReviewDocument>(reviewsQuery)
  const loadedReviewCount = reviews?.length || 0
  const loadedRatingAverage = loadedReviewCount
    ? reviews!.reduce((sum, review) => sum + Number(review.rating || 0), 0) / loadedReviewCount
    : 0
  const loadedRecommendationRate = loadedReviewCount
    ? reviews!.filter((review) => review.wouldRecommend).length / loadedReviewCount
    : 0

  return (
    <OwnerSectionPage
      title="Avis clients"
      description="Lecture des avis restaurant envoyés depuis le suivi de commande."
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReviewMetric label="Note moyenne chargée" value={loadedReviewCount ? `${loadedRatingAverage.toFixed(2)}/5` : "--"} icon={<Star />} />
          <ReviewMetric label="Avis chargés" value={String(loadedReviewCount)} icon={<MessageSquareText />} />
          <ReviewMetric label="Recommandation chargée" value={loadedReviewCount ? `${Math.round(loadedRecommendationRate * 100)}%` : "--"} icon={<ThumbsUp />} />
        </div>

        <section className="space-y-3" aria-labelledby="owner-reviews-list-title">
          <div>
            <h2 id="owner-reviews-list-title" className="text-lg font-black">Derniers avis</h2>
            <p className="text-sm text-muted-foreground">Les indicateurs portent uniquement sur les 50 derniers avis chargés. Les données client sensibles ne sont pas affichées.</p>
          </div>

          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
              ))}
            </div>
          ) : reviews && reviews.length > 0 ? (
            <div className="grid gap-3">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center">
              <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-black">Aucun avis pour le moment</p>
              <p className="mt-1 text-sm text-muted-foreground">Les avis apparaîtront ici après les commandes terminées.</p>
            </div>
          )}
        </section>
      </div>
    </OwnerSectionPage>
  )
}

function ReviewMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
          <p className="text-xl font-black">{value}</p>
        </div>
      </div>
    </article>
  )
}

function ReviewCard({ review }: { review: RestaurantReviewDocument & { id: string } }) {
  return (
    <article className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1" aria-label={`Note ${review.rating} sur 5`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Star key={value} className={cn("h-4 w-4 text-muted-foreground", value <= review.rating && "fill-primary text-primary")} aria-hidden="true" />
            ))}
          </div>
          <p className="mt-2 text-sm font-black">{review.customerName || "Client Oordera"}</p>
          <p className="text-xs text-muted-foreground">Commande {review.orderId}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={review.wouldRecommend ? "default" : "secondary"}>
            {review.wouldRecommend ? "Recommande" : "Ne recommande pas"}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatReviewDate(review.createdAt)}</span>
        </div>
      </div>
      {review.comment ? (
        <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{review.comment}</p>
      ) : null}
    </article>
  )
}

function formatReviewDate(value: unknown) {
  const date = toDate(value)
  if (!date) return "Date inconnue"
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") return value.toDate()
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}
