import * as React from "react"
import { ChefHat, Store } from "lucide-react"

import { PublicBadge, PublicButton, PublicPrice, publicButtonVariants } from "@/components/public-ui"
import { cn } from "@/lib/utils"
import type { MarketplaceOfferPresentation } from "./marketplace-foundations"

export interface MarketplaceOfferCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect"> {
  offer: MarketplaceOfferPresentation
  onSelect?: (offer: MarketplaceOfferPresentation) => void
  actionLabel?: string
  disabled?: boolean
}

export const MarketplaceOfferCard = React.forwardRef<HTMLElement, MarketplaceOfferCardProps>(
  ({ actionLabel = "Choisir ce restaurant", className, disabled, offer, onSelect, ...props }, ref) => (
    <article ref={ref} data-quality={offer.quality ?? "complete"} className={cn("flex min-w-0 gap-3 rounded-[var(--radius-public-xl)] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)] p-3 shadow-[var(--shadow-public-xs)]", className)} {...props}>
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-public-lg)] bg-[var(--marketplace-surface-media)] text-[var(--text-muted)] sm:size-24">
        {offer.imageUrl ? <img src={offer.imageUrl} alt="" className="size-full object-cover" /> : <ChefHat aria-hidden="true" className="size-6" />}
      </div>
      <div className="min-w-0 flex-1">
        {offer.name ? <p className="mb-1 line-clamp-2 text-public-md font-public-bold text-[var(--text-primary)]">{offer.name}</p> : null}
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--marketplace-surface-media)] text-[var(--text-muted)]">{offer.restaurant.logoUrl ? <img src={offer.restaurant.logoUrl} alt="" className="size-full object-cover" /> : <Store aria-hidden="true" className="size-3.5" />}</span>
            <div className="min-w-0">
            <h3 className="truncate text-public-md font-public-bold">{offer.restaurant.name}</h3>
            {offer.restaurant.location ? <p className="truncate text-public-xs text-[var(--text-muted)]">{offer.restaurant.location}</p> : null}
            </div>
          </div>
          {offer.badgeLabel ? <PublicBadge label={offer.badgeLabel} size="sm" /> : null}
        </div>
        {offer.description ? <p className="mt-2 line-clamp-2 text-public-sm text-[var(--text-secondary)]">{offer.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <PublicPrice value={offer.priceLabel} role="card" />
            {offer.availabilityLabel ? <p className="text-public-xs text-[var(--text-muted)]">{offer.availabilityLabel}</p> : null}
          </div>
          {offer.href && !disabled ? (
            <a href={offer.href} className={publicButtonVariants({ size: "compact" })} aria-label={`${actionLabel} : ${offer.name ?? "plat"} chez ${offer.restaurant.name}`}>{actionLabel}</a>
          ) : (
            <PublicButton size="compact" onClick={() => onSelect?.(offer)} disabled={disabled || !onSelect}>{actionLabel}</PublicButton>
          )}
        </div>
      </div>
    </article>
  )
)
MarketplaceOfferCard.displayName = "MarketplaceOfferCard"
