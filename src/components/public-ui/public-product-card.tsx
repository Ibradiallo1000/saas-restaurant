"use client"

import * as React from "react"
import { ChefHat, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicButton } from "./public-button"
import { PublicPrice } from "./public-price"

export type PublicProductCardActionState =
  | "default"
  | "added"
  | "loading"
  | "disabled"

export interface PublicProductCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onClick"> {
  name: string
  description?: string | null
  imageUrl?: string
  imageAlt?: string
  price?: number | string | null
  ratingLabel?: string | null
  ratingSummary?: { averageRating: number; reviewCount: number } | null
  pricePrefix?: React.ReactNode
  priceSuffix?: React.ReactNode
  priceFallback?: string
  actionLabel: string
  actionState?: PublicProductCardActionState
  onOpen: () => void
  onAction: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  loading?: boolean
  availabilityLabel?: string | null
  imageFallback?: React.ReactNode
}

const PublicProductCard = React.forwardRef<HTMLElement, PublicProductCardProps>(
  (
    {
      name,
      description,
      imageUrl,
      imageAlt,
      price,
      ratingLabel,
      ratingSummary,
      pricePrefix,
      priceSuffix,
      priceFallback = "Prix sur demande",
      actionLabel,
      actionState = "default",
      onOpen,
      onAction,
      disabled = false,
      loading = false,
      availabilityLabel,
      imageFallback,
      className,
      ...props
    },
    ref
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false)

    React.useEffect(() => setImageFailed(false), [imageUrl])

    const showImage = Boolean(imageUrl) && !imageFailed
    const actionLoading = loading || actionState === "loading"
    const actionDisabled = disabled || actionState === "disabled"
    const actionAdded = actionState === "added"
    const normalizedRating =
      ratingSummary && ratingSummary.reviewCount > 0 && Number.isFinite(ratingSummary.averageRating)
        ? Math.max(0, Math.min(5, ratingSummary.averageRating))
        : null
    const reviewCount = ratingSummary?.reviewCount ?? 0
    const reviewLabel = normalizedRating !== null
      ? `${normalizedRating.toFixed(1).replace(".", ",")} (${reviewCount} avis)`
      : ratingLabel

    return (
      <article
        ref={ref}
        className={cn(
          "relative grid min-h-24 w-full max-w-full grid-cols-[72px_minmax(0,1fr)] gap-2 overflow-hidden rounded-[var(--radius-public-xl)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] p-2 font-publicBody text-[var(--text-primary)] shadow-[var(--shadow-public-sm)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--border-public-default)] motion-reduce:transition-none sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-3 sm:p-3",
          disabled && "opacity-60",
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          aria-label={`Voir les détails de ${name}`}
          className="absolute inset-0 z-0 rounded-[var(--radius-public-xl)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed"
        />

        <div className="pointer-events-none relative z-[1] size-[72px] overflow-hidden rounded-[var(--radius-public-lg)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-muted)] text-[var(--text-muted)] sm:size-20">
          {showImage ? (
            <img
              src={imageUrl}
              alt={imageAlt ?? name}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span aria-hidden="true" className="flex size-full items-center justify-center">
              {imageFallback ?? <ChefHat className="size-6 opacity-60" />}
            </span>
          )}
        </div>

        <div className="pointer-events-none relative z-[1] flex min-w-0 flex-col">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <h3 className="line-clamp-2 break-words text-left text-sm font-public-bold leading-[18px] text-[var(--text-primary)] sm:text-[15px] sm:leading-5">
              {name}
            </h3>

            <PublicPrice
              value={price}
              prefix={pricePrefix}
              suffix={priceSuffix}
              unavailableLabel={priceFallback}
              role="card"
              className="max-w-[112px] shrink-0 text-right font-public-bold leading-[18px] text-[var(--color-primary)] sm:max-w-[132px]"
            />
          </div>

          {reviewLabel ? (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-public-semibold leading-4 text-[var(--text-secondary)]">
              {normalizedRating !== null ? (
                <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "size-3.5",
                        star <= Math.round(normalizedRating)
                          ? "fill-[var(--color-primary)] text-[var(--color-primary)]"
                          : "fill-transparent text-[var(--text-muted)]"
                      )}
                    />
                  ))}
                </span>
              ) : (
                <Star className="size-3 fill-[var(--color-primary)] text-[var(--color-primary)]" aria-hidden="true" />
              )}
              <span className="truncate">{reviewLabel}</span>
            </div>
          ) : null}
          {availabilityLabel ? (
            <span className="mt-1 w-fit rounded-full bg-[var(--order-status-cancelled-bg)] px-2 py-0.5 text-[10px] font-public-bold text-[var(--order-status-cancelled-fg)]">
              {availabilityLabel}
            </span>
          ) : null}

          <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,1fr)_92px] items-end gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_104px]">
            {description ? (
              <p className="line-clamp-2 min-w-0 break-words text-left text-[11px] leading-[15px] text-[var(--text-secondary)] sm:text-xs sm:leading-4">
                {description}
              </p>
            ) : (
              <span aria-hidden="true" />
            )}

            <span className="pointer-events-auto relative z-10 w-[92px] shrink-0 sm:w-[104px]" aria-live="polite">
              <PublicButton
                variant="primary"
                size="compact"
                disabled={actionDisabled}
                loading={actionLoading}
                loadingLabel={actionLabel}
                onClick={onAction}
                className={cn(
                  "w-full min-w-0 rounded-[var(--radius-public-lg)] px-2 text-xs",
                  actionAdded &&
                    "bg-[var(--success)] text-[var(--text-inverse)] hover:bg-[var(--success)] active:bg-[var(--success)]"
                )}
              >
                {actionLabel}
              </PublicButton>
            </span>
          </div>
        </div>
      </article>
    )
  }
)
PublicProductCard.displayName = "PublicProductCard"

export { PublicProductCard }
