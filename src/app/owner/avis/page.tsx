"use client"

import * as React from "react"
import { collection, limit, orderBy, query } from "firebase/firestore"
import {
  AlertTriangle,
  BarChart3,
  ChefHat,
  MessageSquareText,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { OwnerSectionPage } from "@/app/owner/_components/OwnerSectionPage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DashboardChart, DashboardChartCard } from "@/components/dashboard-ui/dashboard-chart"
import { MetricCard, MetricDelta, MetricGroup } from "@/components/dashboard-ui/dashboard-metrics"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { getOptimizedImage } from "@/lib/image"
import {
  buildCustomerVoiceAnalytics,
  filterRestaurantComments,
  sortDishSummaries,
  toReviewDate,
  type CustomerVoiceCommentFilter,
  type CustomerVoiceDishSort,
  type CustomerVoicePeriod,
  type CustomerVoiceSignal,
  type CustomerVoiceTrendGranularity,
  type CustomerVoiceDishSummary,
} from "@/lib/reputation/customer-voice-analytics"
import {
  RESTAURANT_REVIEWS_COLLECTION,
  type RestaurantReviewDocument,
} from "@/lib/reputation/restaurant-review-types"
import {
  DISH_REVIEWS_COLLECTION,
  type DishReviewDocument,
} from "@/lib/reputation/dish-review-types"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS: Array<{ value: CustomerVoicePeriod; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
]

const COMMENT_FILTERS: Array<{ value: CustomerVoiceCommentFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "positive", label: "Positifs" },
  { value: "watch", label: "A surveiller" },
]

const DISH_SORTS: Array<{ value: CustomerVoiceDishSort; label: string }> = [
  { value: "reviewCount", label: "Plus notes" },
  { value: "bestRated", label: "Mieux notes" },
  { value: "mostCommented", label: "Plus commentes" },
  { value: "lowestRated", label: "Notes faibles" },
]

export default function OwnerReviewsPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const [period, setPeriod] = React.useState<CustomerVoicePeriod>("30d")
  const [commentFilter, setCommentFilter] = React.useState<CustomerVoiceCommentFilter>("all")
  const [dishSort, setDishSort] = React.useState<CustomerVoiceDishSort>("reviewCount")

  const reviewsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, RESTAURANT_REVIEWS_COLLECTION),
      orderBy("createdAt", "desc"),
      limit(300)
    )
  }, [db, restaurantId])
  const { data: reviews, isLoading } = useCollection<RestaurantReviewDocument>(reviewsQuery)

  const dishReviewsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, DISH_REVIEWS_COLLECTION),
      orderBy("createdAt", "desc"),
      limit(500)
    )
  }, [db, restaurantId])
  const { data: dishReviews, isLoading: dishReviewsLoading } = useCollection<DishReviewDocument>(dishReviewsQuery)

  const productsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, "products"),
      limit(500)
    )
  }, [db, restaurantId])
  const { data: products, isLoading: productsLoading } = useCollection<any>(productsQuery)

  const analytics = React.useMemo(() => buildCustomerVoiceAnalytics({
    dishReviews: dishReviews || [],
    period,
    restaurantReviews: reviews || [],
  }), [dishReviews, period, reviews])

  const filteredComments = React.useMemo(
    () => filterRestaurantComments(analytics.currentRestaurantReviews, commentFilter),
    [analytics.currentRestaurantReviews, commentFilter]
  )
  const activeDishSummaries = React.useMemo(() => {
    const productsById = new Map((products || []).map((product: any) => [product.id, product]))

    return analytics.dishSummaries
      .map((summary) => {
        const product = productsById.get(summary.productId)
        if (!product || product.reviewsEnabled !== true) return null

        return {
          ...summary,
          productName: product.name || summary.productName,
          productImageUrl: product.imageUrl ? getOptimizedImage(product.imageUrl, 160) : null,
        }
      })
      .filter((summary): summary is CustomerVoiceDishSummary => Boolean(summary))
  }, [analytics.dishSummaries, products])

  const sortedDishSummaries = React.useMemo(
    () => sortDishSummaries(activeDishSummaries, dishSort),
    [activeDishSummaries, dishSort]
  )
  const activeDishReviewCount = React.useMemo(
    () => activeDishSummaries.reduce((total, summary) => total + summary.reviewCount, 0),
    [activeDishSummaries]
  )

  const loading = isLoading || dishReviewsLoading || productsLoading

  return (
    <OwnerSectionPage
      title="Voix du client"
      description="Analyse des avis restaurant et des avis plats issus des commandes terminees."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black">Periode d'analyse</p>
            <p className="text-xs text-muted-foreground">Par defaut: 30 derniers jours. Les donnees client sensibles ne sont pas affichees.</p>
          </div>
          <SegmentedControl<CustomerVoicePeriod> options={PERIOD_OPTIONS} value={period} onChange={setPeriod} ariaLabel="Filtrer la periode des avis" />
        </div>

        <MetricGroup>
          <MetricCard
            icon={<Star />}
            label="Note restaurant"
            value={analytics.kpis.averageRating === null ? "--" : analytics.kpis.averageRating.toFixed(2)}
            unit="/5"
            delta={<RatingEvolution value={analytics.kpis.ratingEvolution} />}
            description="Moyenne des avis restaurant sur la periode."
          />
          <MetricCard
            icon={<MessageSquareText />}
            label="Avis restaurant"
            value={analytics.kpis.reviewCount}
            description="Nombre total d'avis restaurant publies sur la periode."
          />
          <MetricCard
            icon={<ThumbsUp />}
            label="Recommandation"
            value={analytics.kpis.recommendationRate === null ? "--" : `${Math.round(analytics.kpis.recommendationRate * 100)}%`}
            description={`${analytics.kpis.recommendationCount}/${analytics.kpis.recommendationTotal} avis avec reponse oui/non.`}
          />
          <MetricCard
            icon={<ChefHat />}
            label="Plats notes"
            value={activeDishSummaries.length}
            description={`${activeDishReviewCount} avis plats actifs publies sur la periode.`}
          />
        </MetricGroup>

        {loading ? <LoadingRows /> : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <DashboardChartCard
            title="Evolution de la note"
            description={getTrendDescription(analytics.trendGranularity)}
          >
            {analytics.trend.length > 0 ? (
              <DashboardChart label="Evolution de la note" description="Courbe de la note moyenne des avis restaurant">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.trend} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                      <YAxis domain={[1, 5]} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={28} />
                      <Tooltip
                        formatter={(value, name) => [value === null ? "--" : `${Number(value).toFixed(2)}/5`, name === "averageRating" ? "Note" : name]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Line
                        type="monotone"
                        dataKey="averageRating"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                        name="Note"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </DashboardChart>
            ) : (
              <EmptyState icon={<TrendingUp />} title="Pas encore de tendance" description="Les points apparaissent des que des avis restaurant existent sur la periode." />
            )}
          </DashboardChartCard>

          <DashboardChartCard
            title="Repartition des notes"
            description="Nombre et part des avis de 5 a 1 etoile."
          >
            <div className="space-y-3">
              {analytics.ratingDistribution.map((bucket) => (
                <div key={bucket.rating} className="grid grid-cols-[48px_minmax(0,1fr)_52px] items-center gap-3">
                  <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
                    {bucket.rating}
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
                  </span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(bucket.percentage * 100)}%` }} />
                  </div>
                  <span className="text-right text-xs font-semibold text-muted-foreground">{bucket.count}</span>
                </div>
              ))}
            </div>
          </DashboardChartCard>
        </section>

        <section className="space-y-3" aria-labelledby="customer-voice-signals">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="customer-voice-signals" className="text-lg font-black">A retenir</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {analytics.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="customer-voice-comments">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="customer-voice-comments" className="text-lg font-black">Derniers commentaires</h2>
              <p className="text-sm text-muted-foreground">Commentaires restaurant recents, sans informations personnelles inutiles.</p>
            </div>
            <SegmentedControl<CustomerVoiceCommentFilter> options={COMMENT_FILTERS} value={commentFilter} onChange={setCommentFilter} ariaLabel="Filtrer les commentaires" />
          </div>

          {filteredComments.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredComments.slice(0, 12).map((review) => (
                <ReviewCommentCard key={review.id || review.orderId} review={review} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<MessageSquareText />} title="Aucun commentaire" description="Aucun commentaire ne correspond au filtre selectionne." />
          )}
        </section>

        <section className="space-y-3" aria-labelledby="customer-voice-dishes">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="customer-voice-dishes" className="text-lg font-black">Performance des plats</h2>
              <p className="text-sm text-muted-foreground">Moyenne, volume et derniers retours par plat commande.</p>
            </div>
            <SegmentedControl<CustomerVoiceDishSort> options={DISH_SORTS} value={dishSort} onChange={setDishSort} ariaLabel="Trier les plats" />
          </div>

          {sortedDishSummaries.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {sortedDishSummaries.map((summary) => (
                <DishPerformanceCard key={summary.productId} summary={summary} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<ChefHat />} title="Aucun plat note" description="Les avis plats apparaissent ici apres les commandes terminees." />
          )}
        </section>
      </div>
    </OwnerSectionPage>
  )
}

function SegmentedControl<T extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  value: T
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border bg-background p-1" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "ghost"}
          className={cn("h-8 rounded-lg px-3 text-xs", value !== option.value && "text-muted-foreground")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function RatingEvolution({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs font-semibold text-muted-foreground">Comparaison indisponible</span>
  }
  const rounded = Math.abs(value).toFixed(1)
  return (
    <MetricDelta
      direction={value > 0 ? "up" : value < 0 ? "down" : "flat"}
      tone={value > 0 ? "positive" : value < 0 ? "negative" : "neutral"}
      value={`${value > 0 ? "+" : value < 0 ? "-" : ""}${rounded}`}
      context="vs periode precedente"
    />
  )
}

function SignalCard({ signal }: { signal: CustomerVoiceSignal }) {
  return (
    <article className={cn(
      "rounded-2xl border p-4 shadow-sm",
      signal.tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
      signal.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
      signal.tone === "neutral" && "bg-background"
    )}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70">
          {signal.tone === "warning" ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div>
          <h3 className="text-sm font-black">{signal.title}</h3>
          <p className="mt-1 text-sm leading-6 opacity-80">{signal.description}</p>
        </div>
      </div>
    </article>
  )
}

function ReviewCommentCard({ review }: { review: RestaurantReviewDocument & { id?: string } }) {
  const orderReference = getReadableReviewOrderReference(review)

  return (
    <article className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <StarRow rating={review.rating} />
          <p className="mt-2 text-xs text-muted-foreground">{formatReviewDate(review.createdAt)}</p>
        </div>
        {typeof review.wouldRecommend === "boolean" ? (
          <Badge variant={review.wouldRecommend ? "default" : "secondary"}>
            {review.wouldRecommend ? "Recommande" : "Ne recommande pas"}
          </Badge>
        ) : null}
      </div>
      <p className="mt-3 line-clamp-4 rounded-xl bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{review.comment}</p>
      {orderReference ? (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">Commande {orderReference}</p>
      ) : null}
    </article>
  )
}

function DishPerformanceCard({ summary }: { summary: CustomerVoiceDishSummary }) {
  return (
    <article className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex gap-3">
        {summary.productImageUrl ? (
          <img src={summary.productImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ChefHat className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-black">{summary.productName}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{summary.reviewCount} avis · {summary.fiveStarCount} note(s) 5 etoiles</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-black text-primary">
              <Star className="h-4 w-4 fill-primary" aria-hidden="true" />
              {summary.averageRating.toFixed(2)}
            </div>
          </div>

          {summary.latestComments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {summary.latestComments.slice(0, 2).map((review, index) => (
                <p key={review.id || `${review.orderId}-${review.orderItemId}-${index}`} className="line-clamp-2 rounded-xl bg-muted/50 p-2 text-xs leading-5 text-muted-foreground">
                  {review.comment}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Aucun commentaire recent.</p>
          )}
        </div>
      </div>
    </article>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Note ${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={cn("h-4 w-4 text-muted-foreground", value <= rating && "fill-primary text-primary")} aria-hidden="true" />
      ))}
    </div>
  )
}

function EmptyState({ description, icon, title }: { description: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </span>
      <p className="mt-3 font-black">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Chargement des avis">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      ))}
    </div>
  )
}

function getTrendDescription(granularity: CustomerVoiceTrendGranularity) {
  if (granularity === "day") return "Regroupement quotidien des avis publies."
  if (granularity === "week") return "Regroupement hebdomadaire des avis publies."
  return "Regroupement mensuel des avis publies."
}

function formatReviewDate(value: unknown) {
  const date = toReviewDate(value)
  if (!date) return "Date inconnue"
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function getReadableReviewOrderReference(review: RestaurantReviewDocument & { id?: string }) {
  const record = review as unknown as Record<string, unknown>
  const candidates = [
    record.commercialReference,
    record.orderReference,
    record.orderDisplayId,
    record.displayId,
    record.orderNumber,
    record.number,
  ]

  for (const candidate of candidates) {
    const value = formatBusinessOrderReference(candidate)
    if (value) return value
  }

  return null
}

function formatBusinessOrderReference(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `CMD-${String(value).padStart(4, "0")}`
  }

  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^[A-Z]{2,}-?\d+$/i.test(trimmed)) return trimmed.toUpperCase()
  if (/^\d{1,8}$/.test(trimmed)) return `CMD-${trimmed.padStart(4, "0")}`
  return null
}
