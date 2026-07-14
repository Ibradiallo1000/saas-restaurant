import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicSurfaceVariants = cva("font-publicBody text-[var(--text-primary)]", {
  variants: {
    level: {
      canvas: "bg-[var(--surface-public-canvas)]",
      card: "bg-[var(--surface-public-card)]",
      muted: "bg-[var(--surface-public-muted)]",
      elevated: "bg-[var(--surface-public-elevated)]",
      translucent: "bg-[var(--surface-public-translucent)] backdrop-blur-md",
    },
    elevation: {
      none: "shadow-none", xs: "shadow-[var(--shadow-public-xs)]", sm: "shadow-[var(--shadow-public-sm)]",
      md: "shadow-[var(--shadow-public-md)]", lg: "shadow-[var(--shadow-public-lg)]", top: "shadow-[var(--shadow-public-top)]",
    },
    radius: {
      sm: "rounded-[var(--radius-public-sm)]", md: "rounded-[var(--radius-public-md)]",
      lg: "rounded-[var(--radius-public-lg)]", xl: "rounded-[var(--radius-public-xl)]",
      "2xl": "rounded-[var(--radius-public-2xl)]", full: "rounded-[var(--radius-public-full)]",
    },
    border: {
      none: "border-0", subtle: "border border-[var(--border-public-subtle)]",
      default: "border border-[var(--border-public-default)]", strong: "border border-[var(--border-public-strong)]",
    },
    padding: { none: "p-0", compact: "p-[var(--space-3)]", standard: "p-[var(--space-4)]", comfortable: "p-[var(--space-6)]" },
  },
  defaultVariants: { level: "card", elevation: "none", radius: "lg", border: "none", padding: "none" },
})

export interface PublicSurfaceProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof publicSurfaceVariants> {
  as?: "div" | "section" | "article" | "aside" | "header" | "footer" | "main"
}

const PublicSurface = React.forwardRef<HTMLElement, PublicSurfaceProps>(
  ({ as: Component = "div", className, level, elevation, radius, border, padding, ...props }, ref) => (
    <Component ref={ref as React.Ref<never>} className={cn(publicSurfaceVariants({ level, elevation, radius, border, padding }), className)} {...props} />
  )
)
PublicSurface.displayName = "PublicSurface"

export { PublicSurface, publicSurfaceVariants }
