import * as React from "react"

import { cn } from "@/lib/utils"
import type { MarketplaceDensity } from "./marketplace-foundations"

export interface MarketplaceLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: MarketplaceDensity
}

export const MarketplaceLayout = React.forwardRef<HTMLDivElement, MarketplaceLayoutProps>(
  ({ className, density = "comfortable", ...props }, ref) => (
    <div
      ref={ref}
      data-density={density}
      className={cn(
        "marketplace-root min-h-screen min-w-0 overflow-x-hidden bg-[var(--marketplace-surface-canvas)] font-publicBody text-[var(--text-primary)]",
        className
      )}
      {...props}
    />
  )
)
MarketplaceLayout.displayName = "MarketplaceLayout"

export interface MarketplaceContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "main" | "section"
}

export const MarketplaceContainer = React.forwardRef<HTMLElement, MarketplaceContainerProps>(
  ({ as: Component = "div", className, ...props }, ref) => (
    <Component
      ref={ref as React.Ref<never>}
      className={cn("marketplace-container mx-auto w-full min-w-0 max-w-[var(--marketplace-max-content)] px-[var(--marketplace-gutter-x)]", className)}
      {...props}
    />
  )
)
MarketplaceContainer.displayName = "MarketplaceContainer"
