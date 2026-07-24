import * as React from "react"
import { ChefHat } from "lucide-react"

import { PublicBadge, PublicPrice } from "@/components/public-ui"
import { cn } from "@/lib/utils"
import type { MarketplaceDishPresentation, MarketplaceDensity } from "./marketplace-foundations"

export interface MarketplaceDishCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "onClick" | "onSelect"> {
  dish: MarketplaceDishPresentation
  onSelect: (dish: MarketplaceDishPresentation) => void
  actionLabel?: string
  density?: MarketplaceDensity
}

export const MarketplaceDishCard = React.forwardRef<HTMLElement, MarketplaceDishCardProps>(
  ({ actionLabel = "Voir les restaurants", className, density = "comfortable", dish, onSelect, ...props }, ref) => (
    <article
      ref={ref}
      data-density={density}
      data-quality={dish.quality ?? "complete"}
      className={cn("group relative overflow-hidden rounded-[var(--radius-public-xl)] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)] shadow-[var(--shadow-public-sm)]", className)}
      {...props}
    >
      <button
        type="button"
        disabled={dish.disabled}
        onClick={() => onSelect(dish)}
        aria-label={`${actionLabel} pour ${dish.name}`}
        className="absolute inset-0 z-10 rounded-[var(--radius-public-xl)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed"
      />
      <div className="aspect-[4/3] overflow-hidden bg-[var(--marketplace-surface-media)]">
        {dish.imageUrl ? <img src={dish.imageUrl} alt="" className="size-full object-cover transition-transform [transition-duration:var(--marketplace-motion-standard)] group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:transform-none" /> : <span className="flex size-full items-center justify-center text-[var(--text-muted)]"><ChefHat aria-hidden="true" className="size-9" /></span>}
      </div>
      <div className={cn("flex min-w-0 flex-col", density === "compact" ? "gap-1.5 p-3" : "gap-2 p-4")}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-public-md font-public-bold text-[var(--text-primary)]">{dish.name}</h3>
          {dish.badgeLabel ? <PublicBadge label={dish.badgeLabel} variant="brand" size="sm" /> : null}
        </div>
        {dish.description ? <p className="line-clamp-2 text-public-sm text-[var(--text-secondary)]">{dish.description}</p> : null}
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            {dish.categoryLabel ? <p className="truncate text-public-xs font-public-semibold text-[var(--text-muted)]">{dish.categoryLabel}</p> : null}
            {dish.priceLabel ? <PublicPrice value={dish.priceLabel} role="card" /> : null}
          </div>
          {dish.offerCountLabel ? <span className="shrink-0 text-public-xs font-public-bold text-[var(--brand-primary)]">{dish.offerCountLabel}</span> : null}
        </div>
      </div>
    </article>
  )
)
MarketplaceDishCard.displayName = "MarketplaceDishCard"
