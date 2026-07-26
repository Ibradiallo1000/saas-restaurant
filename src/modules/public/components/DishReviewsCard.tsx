"use client"

import * as React from "react"
import { CheckCircle2, ImageIcon, Star, UtensilsCrossed } from "lucide-react"

import { PublicButton, PublicSurface } from "@/components/public-ui"
import { useFirestore } from "@/firebase"
import {
  DISH_REVIEW_COMMENT_MAX_LENGTH,
  getReviewableOrderItems,
  type ReviewableOrderItem,
} from "@/lib/reputation/dish-review-core"
import {
  getLocalDishReviewSubmission,
  rememberDishReviewSubmission,
} from "@/lib/reputation/review-access-token"
import { cn } from "@/lib/utils"
import { createDishReview } from "@/services/dish-review.service"

export function DishReviewsCard({
  order,
  restaurantId,
  reviewToken,
}: {
  order: any
  restaurantId: string
  reviewToken: string | null
}) {
  const items = React.useMemo(() => getReviewableOrderItems(order), [order])
  const hasReviewAccess = Boolean(reviewToken)

  if (!order?.id || !hasReviewAccess || items.length === 0) return null

  return (
    <PublicSurface as="section" level="card" border="subtle" radius="lg" padding="standard" elevation="xs" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
          <UtensilsCrossed className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-public-md font-public-bold text-[var(--text-primary)]">Comment avez-vous trouvé vos plats ?</h2>
          <p className="mt-1 text-public-sm text-[var(--text-secondary)]">Notez uniquement les plats présents dans cette commande.</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <DishReviewLine
            key={item.orderItemId}
            item={item}
            order={order}
            restaurantId={restaurantId}
            reviewToken={reviewToken!}
          />
        ))}
      </div>
    </PublicSurface>
  )
}

function DishReviewLine({
  item,
  order,
  restaurantId,
  reviewToken,
}: {
  item: ReviewableOrderItem
  order: any
  restaurantId: string
  reviewToken: string
}) {
  const db = useFirestore()
  const [rating, setRating] = React.useState(0)
  const [hoveredRating, setHoveredRating] = React.useState(0)
  const [comment, setComment] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submission, setSubmission] = React.useState(() =>
    getLocalDishReviewSubmission(restaurantId, order?.id, item.orderItemId)
  )
  const currentRating = hoveredRating || rating
  const canSubmit = rating >= 1 && rating <= 5 && !isSubmitting && !submission

  React.useEffect(() => {
    setSubmission(getLocalDishReviewSubmission(restaurantId, order?.id, item.orderItemId))
    setRating(0)
    setHoveredRating(0)
    setComment("")
    setError(null)
  }, [item.orderItemId, order?.id, restaurantId])

  async function handleSubmit() {
    if (!canSubmit || !order?.id) return
    setIsSubmitting(true)
    setError(null)
    try {
      await createDishReview(db, order, {
        restaurantId,
        orderId: order.id,
        orderItemId: item.orderItemId,
        orderItemIndex: item.orderItemIndex,
        productId: item.productId,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
        quantity: item.quantity,
        rating,
        comment,
        reviewToken,
      })
      const storedComment = comment.replace(/\s+/g, " ").trim() || null
      rememberDishReviewSubmission({
        restaurantId,
        orderId: order.id,
        orderItemId: item.orderItemId,
        rating,
        comment: storedComment,
      })
      setSubmission({ rating, comment: storedComment })
      setComment("")
      setRating(0)
    } catch (submitError) {
      setError(getPublicDishReviewError(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article className="rounded-[var(--radius-public-md)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] p-3">
      <div className="flex gap-3">
        <DishImage item={item} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-public-sm font-public-bold text-[var(--text-primary)]">{item.productName}</h3>
              {item.quantity > 1 ? (
                <p className="mt-0.5 text-public-xs font-public-semibold text-[var(--text-muted)]">Quantité : {item.quantity}</p>
              ) : null}
            </div>
            {submission ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--success)_12%,var(--surface-public-card))] px-2 py-1 text-[11px] font-public-bold text-[var(--success)]">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Noté
              </span>
            ) : null}
          </div>

          {submission ? (
            <div className="space-y-2">
              <StarRating value={submission.rating} readonly />
              {submission.comment ? (
                <p className="rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] p-2 text-public-xs text-[var(--text-secondary)]">{submission.comment}</p>
              ) : (
                <p className="text-public-xs text-[var(--text-muted)]">Aucun commentaire ajouté.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <StarRating
                value={currentRating}
                selectedValue={rating}
                onChange={setRating}
                onHover={setHoveredRating}
              />

              <textarea
                value={comment}
                maxLength={DISH_REVIEW_COMMENT_MAX_LENGTH}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Commentaire facultatif"
                className="min-h-20 w-full resize-none rounded-[var(--radius-public-sm)] border border-[var(--border-public-default)] bg-[var(--surface-public-card)] px-3 py-2 font-publicBody text-public-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)]"
              />

              {error ? <p role="alert" className="text-public-xs font-public-semibold text-[var(--danger)]">{error}</p> : null}

              <PublicButton size="compact" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} loadingLabel="Envoi">
                Envoyer
              </PublicButton>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function DishImage({ item }: { item: ReviewableOrderItem }) {
  if (!item.productImageUrl) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-public-md)] bg-[var(--surface-public-muted)] text-[var(--text-muted)]">
        <ImageIcon className="size-5" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={item.productImageUrl}
      alt=""
      className="size-16 shrink-0 rounded-[var(--radius-public-md)] object-cover"
      loading="lazy"
    />
  )
}

function StarRating({
  value,
  selectedValue,
  readonly = false,
  onChange,
  onHover,
}: {
  value: number
  selectedValue?: number
  readonly?: boolean
  onChange?: (value: number) => void
  onHover?: (value: number) => void
}) {
  return (
    <div className="flex gap-0.5" onMouseLeave={() => onHover?.(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value
        if (readonly) {
          return (
            <Star
              key={star}
              aria-hidden="true"
              className={cn("size-5", active ? "fill-[var(--brand-primary)] text-[var(--brand-primary)]" : "fill-transparent text-[var(--text-muted)]")}
            />
          )
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => onHover?.(star)}
            onFocus={() => onHover?.(star)}
            onBlur={() => onHover?.(0)}
            aria-label={`${star} étoile${star > 1 ? "s" : ""} sur 5`}
            aria-pressed={selectedValue === star}
            className="rounded-full p-0.5 text-[var(--text-muted)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transform-none"
          >
            <Star
              aria-hidden="true"
              className={cn("size-6 transition", active ? "fill-[var(--brand-primary)] text-[var(--brand-primary)]" : "fill-transparent text-[var(--text-muted)]")}
            />
          </button>
        )
      })}
    </div>
  )
}

function getPublicDishReviewError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (/already-exists|permission-denied/i.test(message)) return "Ce plat ne peut pas être noté une seconde fois pour cette commande."
  if (/invalid-argument/i.test(message)) return "Sélectionnez une note avant d'envoyer."
  return "Impossible d'envoyer cet avis pour le moment."
}
