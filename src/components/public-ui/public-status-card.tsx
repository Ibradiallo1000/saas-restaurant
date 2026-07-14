import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicStatusCardVariants = cva(
  "font-publicBody text-[var(--text-primary)]",
  {
    variants: {
      variant: {
        neutral: "border-[var(--border-public-default)] bg-[var(--surface-public-card)]",
        brand: "border-[color:color-mix(in_srgb,var(--brand-primary)_28%,var(--border-public-subtle))] bg-[var(--brand-primary-soft)]",
        success: "border-[color:color-mix(in_srgb,var(--success)_30%,var(--border-public-subtle))] bg-[color:color-mix(in_srgb,var(--success)_10%,var(--surface-public-card))]",
        warning: "border-[color:color-mix(in_srgb,var(--warning)_32%,var(--border-public-subtle))] bg-[color:color-mix(in_srgb,var(--warning)_10%,var(--surface-public-card))]",
        danger: "border-[color:color-mix(in_srgb,var(--danger)_30%,var(--border-public-subtle))] bg-[color:color-mix(in_srgb,var(--danger)_9%,var(--surface-public-card))]",
        info: "border-[color:color-mix(in_srgb,var(--info)_30%,var(--border-public-subtle))] bg-[color:color-mix(in_srgb,var(--info)_9%,var(--surface-public-card))]",
      },
      emphasis: {
        primary: "rounded-[var(--radius-public-xl)] border p-[var(--space-5)] shadow-[var(--shadow-public-sm)]",
        standard: "rounded-[var(--radius-public-lg)] border p-[var(--space-4)] shadow-[var(--shadow-public-xs)]",
        subtle: "rounded-[var(--radius-public-lg)] border p-[var(--space-4)] shadow-none",
      },
    },
    defaultVariants: { variant: "neutral", emphasis: "standard" },
  }
)

const iconColors = {
  neutral: "text-[var(--text-secondary)]",
  brand: "text-[var(--brand-primary)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  info: "text-[var(--info)]",
}

export interface PublicStatusCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title">, VariantProps<typeof publicStatusCardVariants> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
  headingAs?: "h1" | "h2" | "h3" | "div"
}

const PublicStatusCard = React.forwardRef<HTMLElement, PublicStatusCardProps>(
  ({ action, badge, children, className, description, emphasis, headingAs: Heading = "h2", icon, title, variant = "neutral", ...props }, ref) => (
    <section ref={ref} className={cn(publicStatusCardVariants({ variant, emphasis }), className)} {...props}>
      <div className="flex min-w-0 items-start gap-3.5">
        {icon ? (
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--surface-public-elevated)] shadow-[var(--shadow-public-xs)] [&_svg]:size-6", iconColors[variant ?? "neutral"])} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Heading className={cn("font-public-extrabold text-[var(--text-primary)]", emphasis === "primary" ? "text-[22px] leading-7" : "text-public-lg leading-6")}>{title}</Heading>
            {badge}
          </div>
          {description ? <p className="mt-1 text-public-sm leading-5 text-[var(--text-secondary)]">{description}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  )
)
PublicStatusCard.displayName = "PublicStatusCard"

export { PublicStatusCard, publicStatusCardVariants }
