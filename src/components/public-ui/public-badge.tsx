import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicBadgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1.5 rounded-[var(--radius-public-full)] font-publicBody text-public-label font-public-bold",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--surface-public-muted)] text-[var(--text-secondary)]",
        brand: "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]",
        success: "bg-[color:color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]",
        warning: "bg-[color:color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]",
        danger: "bg-[color:color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)]",
        info: "bg-[color:color-mix(in_srgb,var(--info)_14%,transparent)] text-[var(--info)]",
        inverse: "bg-[color:color-mix(in_srgb,var(--text-inverse-primary)_16%,transparent)] text-[var(--text-inverse-primary)]",
      },
      size: { sm: "min-h-5 px-2 py-0.5", md: "min-h-6 px-2.5 py-1" },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  }
)

export interface PublicBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof publicBadgeVariants> {
  label: string
  icon?: React.ReactNode
}

const PublicBadge = React.forwardRef<HTMLSpanElement, PublicBadgeProps>(
  ({ className, icon, label, variant, size, ...props }, ref) => (
    <span ref={ref} className={cn(publicBadgeVariants({ variant, size }), className)} {...props}>
      {icon && <span aria-hidden="true" className="[&_svg]:size-3.5">{icon}</span>}
      <span>{label}</span>
    </span>
  )
)
PublicBadge.displayName = "PublicBadge"

export { PublicBadge, publicBadgeVariants }
