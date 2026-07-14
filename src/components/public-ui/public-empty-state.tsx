import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicEmptyStateVariants = cva("flex max-w-lg font-publicBody", {
  variants: {
    variant: {
      default: "gap-[var(--space-4)] py-[var(--space-8)]",
      compact: "gap-[var(--space-3)] py-[var(--space-4)]",
      error: "gap-[var(--space-4)] rounded-[var(--radius-public-lg)] border border-[color:color-mix(in_srgb,var(--danger)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_7%,transparent)] p-[var(--space-5)]",
    },
    align: { center: "mx-auto items-center text-center", left: "items-start text-left" },
  },
  defaultVariants: { variant: "default", align: "center" },
})

export interface PublicEmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof publicEmptyStateVariants> {
  title: React.ReactNode
  headingAs?: "h1" | "h2" | "h3"
  description?: React.ReactNode
  icon?: React.ReactNode
  primaryAction?: React.ReactNode
  secondaryAction?: React.ReactNode
}

const PublicEmptyState = React.forwardRef<HTMLDivElement, PublicEmptyStateProps>(
  ({ align, className, description, headingAs: Heading = "h2", icon, primaryAction, secondaryAction, title, variant, ...props }, ref) => (
    <div ref={ref} className={cn(publicEmptyStateVariants({ variant, align }), "flex-col", className)} {...props}>
      {icon && <div aria-hidden="true" className="flex size-12 items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--surface-public-muted)] text-[var(--text-secondary)] [&_svg]:size-6">{icon}</div>}
      <div className="grid gap-1.5">
        <Heading className="text-public-heading-3 font-public-bold text-[var(--text-primary)]">{title}</Heading>
        {description && <p className="text-public-sm text-[var(--text-secondary)]">{description}</p>}
      </div>
      {(primaryAction || secondaryAction) && <div className={cn("flex flex-wrap gap-[var(--space-2)]", align === "center" && "justify-center")}>{primaryAction}{secondaryAction}</div>}
    </div>
  )
)
PublicEmptyState.displayName = "PublicEmptyState"

export { PublicEmptyState, publicEmptyStateVariants }
