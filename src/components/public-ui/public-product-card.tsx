"use client"

import * as React from "react"
import { ChefHat } from "lucide-react"

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
  pricePrefix?: React.ReactNode
  priceSuffix?: React.ReactNode
  priceFallback?: string
  actionLabel: string
  actionState?: PublicProductCardActionState
  onOpen: () => void
  onAction: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  loading?: boolean
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
      pricePrefix,
      priceSuffix,
      priceFallback = "Prix sur demande",
      actionLabel,
      actionState = "default",
      onOpen,
      onAction,
      disabled = false,
      loading = false,
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
          <h3 className="line-clamp-2 break-words text-left text-sm font-public-bold leading-[18px] text-[var(--text-primary)] sm:text-[15px] sm:leading-5">
            {name}
          </h3>

          {description ? (
            <p className="mt-0.5 line-clamp-2 break-words text-left text-xs leading-4 text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}

          <div className="mt-auto flex min-w-0 flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-1.5">
            <PublicPrice
              value={price}
              prefix={pricePrefix}
              suffix={priceSuffix}
              unavailableLabel={priceFallback}
              role="card"
              className="min-w-0 max-w-full text-[var(--text-primary)]"
            />

            <span className="pointer-events-auto relative z-10" aria-live="polite">
              <PublicButton
                variant="primary"
                size="compact"
                disabled={actionDisabled}
                loading={actionLoading}
                loadingLabel={actionLabel}
                onClick={onAction}
                className={cn(
                  "min-w-0 rounded-[var(--radius-public-lg)] px-3 text-xs",
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
