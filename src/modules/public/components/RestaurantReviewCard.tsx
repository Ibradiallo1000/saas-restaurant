"use client"

import * as React from "react"
import { CheckCircle2, MessageSquareText, Star } from "lucide-react"

import { PublicButton, PublicSurface } from "@/components/public-ui"
import { useFirestore } from "@/firebase"
import { isRestaurantOrderReviewEligible } from "@/lib/reputation/restaurant-review-core"
import { RESTAURANT_REVIEW_COMMENT_MAX_LENGTH } from "@/lib/reputation/restaurant-review-types"
import { hasLocalOrderReviewSubmission, markOrderReviewSubmitted } from "@/lib/reputation/review-access-token"
import { cn } from "@/lib/utils"
import { createRestaurantReview } from "@/services/restaurant-review.service"

const RATING_LABELS: Record<number, string> = {
  1: "Très décevant",
  2: "Décevant",
  3: "Correct",
  4: "Très bien",
  5: "Excellent",
}

export function RestaurantReviewCard({
  order,
  restaurantId,
  reviewToken,
}: {
  order: any
  restaurantId: string
  reviewToken: string | null
}) {
  const db = useFirestore()
  const [rating, setRating] = React.useState(0)
  const [hoveredRating, setHoveredRating] = React.useState(0)
  const [wouldRecommend, setWouldRecommend] = React.useState<boolean | null>(null)
  const [comment, setComment] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitted, setSubmitted] = React.useState(() => hasLocalOrderReviewSubmission(restaurantId, order?.id))
  const eligible = isRestaurantOrderReviewEligible(order)
  const hasReviewAccess = Boolean(reviewToken)
  const currentRating = hoveredRating || rating
  const currentRatingLabel =
    currentRating >= 1 && currentRating <= 5
      ? RATING_LABELS[currentRating]
      : null
  const canSubmit = eligible && hasReviewAccess && rating >= 1 && rating <= 5 && typeof wouldRecommend === "boolean" && !isSubmitting
  const descriptionId = React.useId()

  React.useEffect(() => {
    setSubmitted(hasLocalOrderReviewSubmission(restaurantId, order?.id))
  }, [order?.id, restaurantId])

  if (!eligible && !submitted) return null

  if (!hasReviewAccess && !submitted) {
    return (
      <PublicSurface as="section" level="card" border="subtle" radius="lg" padding="standard" elevation="xs">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-public-muted)] text-[var(--text-muted)]">
            <MessageSquareText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-public-md font-public-bold text-[var(--text-primary)]">Évaluation indisponible</h2>
            <p className="mt-1 text-public-sm text-[var(--text-secondary)]">Cette commande ne possède pas l’accès sécurisé nécessaire pour laisser un avis.</p>
          </div>
        </div>
      </PublicSurface>
    )
  }

  async function handleSubmit() {
    if (!canSubmit || !order?.id || !reviewToken) return
    setIsSubmitting(true)
    setError(null)
    try {
      await createRestaurantReview(db, order, {
        restaurantId,
        orderId: order.id,
        rating,
        wouldRecommend: Boolean(wouldRecommend),
        comment,
        reviewToken,
        tableSessionId: order.tableSessionId || order.sessionId || null,
      })
      markOrderReviewSubmitted(restaurantId, order.id)
      setSubmitted(true)
      setComment("")
    } catch (submitError) {
      setError(getPublicReviewError(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <PublicSurface as="section" level="card" border="subtle" radius="lg" padding="standard" elevation="xs" className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--success)_12%,var(--surface-public-card))] text-[var(--success)]">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-public-md font-public-bold text-[var(--text-primary)]">Merci pour votre retour !</h2>
            <p className="mt-1 text-public-sm text-[var(--text-secondary)]">Votre avis a bien été envoyé et aidera le restaurant à améliorer son service.</p>
          </div>
        </div>
      </PublicSurface>
    )
  }

  return (
    <PublicSurface as="section" level="card" border="subtle" radius="lg" padding="standard" elevation="xs" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
          <MessageSquareText className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-public-md font-public-bold text-[var(--text-primary)]">Comment s'est passée votre expérience ?</h2>
          <p id={descriptionId} className="mt-1 text-public-sm text-[var(--text-secondary)]">Votre retour aide le restaurant à améliorer son service.</p>
        </div>
      </div>

      <fieldset aria-describedby={descriptionId} className="space-y-2">
        <legend className="sr-only">Note globale</legend>

        <div className="flex min-h-6 items-center justify-between gap-3">
          <span className="text-public-sm font-public-semibold text-[var(--text-primary)]">Note globale</span>

          <span
            aria-live="polite"
            className={cn(
              "text-right text-public-sm font-public-bold transition",
              currentRatingLabel
                ? "text-[var(--brand-primary)]"
                : "text-[var(--text-muted)]"
            )}
          >
            {currentRatingLabel
              ? `${currentRatingLabel} · ${currentRating}/5`
              : "Sélectionnez une note"}
          </span>
        </div>

        <div className="flex gap-1" onMouseLeave={() => setHoveredRating(0)}>
          {[1, 2, 3, 4, 5].map((value) => {
            const isActive = value <= currentRating

            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onFocus={() => setHoveredRating(value)}
                onBlur={() => setHoveredRating(0)}
                aria-label={`${value} étoile${value > 1 ? "s" : ""} sur 5, ${RATING_LABELS[value]}`}
                aria-pressed={rating === value}
                className="rounded-full p-1 text-[var(--text-muted)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transform-none"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    "size-8 transition",
                    isActive
                      ? "fill-[var(--brand-primary)] text-[var(--brand-primary)]"
                      : "fill-transparent text-[var(--text-muted)]"
                  )}
                />
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-public-sm font-public-semibold text-[var(--text-primary)]">Recommanderiez-vous ce restaurant ?</legend>
        <div className="grid grid-cols-2 gap-2">
          <RecommendationButton selected={wouldRecommend === true} onClick={() => setWouldRecommend(true)}>Oui</RecommendationButton>
          <RecommendationButton selected={wouldRecommend === false} onClick={() => setWouldRecommend(false)}>Non</RecommendationButton>
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="restaurant-review-comment" className="block text-public-sm font-public-semibold text-[var(--text-primary)]">Un commentaire à ajouter ?</label>
        <textarea
          id="restaurant-review-comment"
          value={comment}
          maxLength={RESTAURANT_REVIEW_COMMENT_MAX_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Dites-nous ce que vous avez apprécié ou ce que nous pouvons améliorer."
          className="min-h-24 w-full resize-none rounded-[var(--radius-public-md)] border border-[var(--border-public-default)] bg-[var(--surface-public-card)] px-4 py-3 font-publicBody text-public-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)]"
        />
        <p className="text-right text-public-xs text-[var(--text-muted)]">{comment.length}/{RESTAURANT_REVIEW_COMMENT_MAX_LENGTH}</p>
      </div>

      {error ? <p role="alert" className="text-public-sm font-public-semibold text-[var(--danger)]">{error}</p> : null}

      <PublicButton fullWidth size="action" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} loadingLabel="Envoi de votre avis">
        Envoyer mon avis
      </PublicButton>
    </PublicSurface>
  )
}

function RecommendationButton({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode
  onClick: () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-11 rounded-[var(--radius-public-md)] border px-4 text-public-sm font-public-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        selected
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
          : "border-[var(--border-public-default)] bg-[var(--surface-public-card)] text-[var(--text-primary)] hover:bg-[var(--surface-public-muted)]"
      )}
    >
      {children}
    </button>
  )
}

function getPublicReviewError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (/already-exists/i.test(message) || /déjà|deja/i.test(message)) return "Un avis a déjà été envoyé pour cette commande."
  if (/failed-precondition/i.test(message) || /termin/i.test(message)) return "Vous pourrez laisser un avis lorsque la commande sera terminée."
  if (/invalid-argument/i.test(message)) return "Vérifiez la note, la recommandation et le commentaire."
  return "Impossible d'envoyer votre avis pour le moment. Réessayez dans quelques instants."
}