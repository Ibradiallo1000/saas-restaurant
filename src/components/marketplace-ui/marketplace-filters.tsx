import * as React from "react"

import { PublicBadge, PublicButton, PublicSheet } from "@/components/public-ui"
import { cn } from "@/lib/utils"
import type { MarketplaceFilterPresentation } from "./marketplace-foundations"

export interface MarketplaceFilterListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onToggle"> {
  filters: MarketplaceFilterPresentation[]
  onToggle: (filter: MarketplaceFilterPresentation) => void
  label?: string
}

export const MarketplaceFilterList = React.forwardRef<HTMLDivElement, MarketplaceFilterListProps>(
  ({ className, filters, label = "Filtres Marketplace", onToggle, ...props }, ref) => (
    <div ref={ref} aria-label={label} className={cn("flex flex-wrap gap-2", className)} {...props}>
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          aria-pressed={filter.selected}
          disabled={filter.disabled}
          onClick={() => onToggle(filter)}
          className="marketplace-reduced-motion inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--marketplace-border-default)] bg-[var(--marketplace-surface-card)] px-4 text-public-sm font-public-semibold text-[var(--text-secondary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-[var(--brand-primary)] aria-pressed:bg-[var(--brand-primary-soft)] aria-pressed:text-[var(--brand-primary)]"
        >
          {filter.label}
          {filter.countLabel ? <PublicBadge label={filter.countLabel} size="sm" /> : null}
        </button>
      ))}
    </div>
  )
)
MarketplaceFilterList.displayName = "MarketplaceFilterList"

export interface MarketplaceFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  activeCountLabel?: string
  onClear?: () => void
  onApply?: () => void
  applyLabel?: string
  clearLabel?: string
}

export function MarketplaceFilterSheet({
  activeCountLabel, applyLabel = "Afficher les résultats", children, clearLabel = "Effacer",
  description = "Affinez les résultats avec les filtres disponibles.", onApply, onClear,
  onOpenChange, open, title = "Filtres",
}: MarketplaceFilterSheetProps) {
  return (
    <PublicSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={(onClear || onApply) ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onClear ? <PublicButton variant="ghost" size="action" onClick={onClear}>{clearLabel}</PublicButton> : null}
          {onApply ? <PublicButton size="action" onClick={onApply}>{applyLabel}{activeCountLabel ? ` · ${activeCountLabel}` : ""}</PublicButton> : null}
        </div>
      ) : undefined}
    >
      {children}
    </PublicSheet>
  )
}
