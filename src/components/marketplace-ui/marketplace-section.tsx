import * as React from "react"

import { SectionHeader } from "@/components/public-ui"
import { cn } from "@/lib/utils"
import { MARKETPLACE_LAYOUT_CLASSES, type MarketplaceSectionPresentation } from "./marketplace-foundations"

export interface MarketplaceSectionProps extends React.HTMLAttributes<HTMLElement> {
  presentation: MarketplaceSectionPresentation
  action?: React.ReactNode
  emptyState?: React.ReactNode
}

export const MarketplaceSection = React.forwardRef<HTMLElement, MarketplaceSectionProps>(
  ({ action, children, className, emptyState, presentation, ...props }, ref) => {
    const layout = presentation.layout ?? "grid"
    const hasChildren = React.Children.count(children) > 0
    return (
      <section ref={ref} aria-labelledby={presentation.id} data-quality={presentation.quality ?? "complete"} className={cn("space-y-[var(--marketplace-section-gap)]", className)} {...props}>
        <SectionHeader id={presentation.id} title={presentation.title} description={presentation.description} action={action} />
        {hasChildren ? <div className={MARKETPLACE_LAYOUT_CLASSES[layout]} data-density={presentation.density ?? "comfortable"}>{children}</div> : emptyState ?? null}
      </section>
    )
  }
)
MarketplaceSection.displayName = "MarketplaceSection"
