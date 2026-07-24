import * as React from "react"
import { Utensils } from "lucide-react"

import { cn } from "@/lib/utils"
import type { MarketplaceCategoryPresentation } from "./marketplace-foundations"

export interface MarketplaceCategoryRailProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  categories: MarketplaceCategoryPresentation[]
  onSelect: (category: MarketplaceCategoryPresentation) => void
  label?: string
}

export const MarketplaceCategoryRail = React.forwardRef<HTMLDivElement, MarketplaceCategoryRailProps>(
  ({ categories, className, label = "Catégories alimentaires", onSelect, ...props }, ref) => (
    <div ref={ref} aria-label={label} className={cn("marketplace-rail pb-1", className)} {...props}>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={category.active}
          disabled={category.disabled}
          onClick={() => onSelect(category)}
          className="marketplace-reduced-motion group flex min-h-[6rem] min-w-[6rem] shrink-0 flex-col items-center justify-center gap-2.5 rounded-[var(--radius-public-2xl)] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)] px-3 py-3 text-center text-public-sm font-public-bold text-[var(--text-secondary)] shadow-[var(--shadow-public-xs)] outline-none transition-[border-color,background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-[var(--brand-primary)] aria-pressed:bg-[var(--marketplace-category-active-bg)] aria-pressed:text-[var(--brand-primary)] aria-pressed:shadow-[var(--shadow-public-sm)] active:scale-[0.98] motion-reduce:transform-none"
        >
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-[var(--marketplace-category-icon-bg)] text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/10">
            {category.imageUrl ? <img src={category.imageUrl} alt="" className="size-full object-cover" /> : category.icon ?? <Utensils aria-hidden="true" className="size-5" />}
          </span>
          <span className="max-w-24 line-clamp-2 leading-4">{category.label}</span>
        </button>
      ))}
    </div>
  )
)
MarketplaceCategoryRail.displayName = "MarketplaceCategoryRail"
