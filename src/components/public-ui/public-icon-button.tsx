import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicIconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-public-canvas)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--surface-public-muted)] text-[var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-public-muted)_82%,var(--text-primary))]",
        ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-public-muted)]",
        outline: "border border-[var(--border-public-default)] bg-[var(--surface-public-card)] text-[var(--text-primary)] hover:border-[var(--border-public-strong)]",
        brand: "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)]",
        danger: "bg-[color:color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger)_20%,transparent)]",
      },
      size: { compact: "size-10", standard: "size-11" },
      shape: { rounded: "rounded-[var(--radius-public-md)]", full: "rounded-[var(--radius-public-full)]" },
    },
    defaultVariants: { variant: "default", size: "standard", shape: "rounded" },
  }
)

export interface PublicIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">,
    VariantProps<typeof publicIconButtonVariants> {
  "aria-label": string
}

const PublicIconButton = React.forwardRef<HTMLButtonElement, PublicIconButtonProps>(
  ({ className, type = "button", variant, size, shape, ...props }, ref) => (
    <button ref={ref} type={type} className={cn(publicIconButtonVariants({ variant, size, shape }), className)} {...props} />
  )
)
PublicIconButton.displayName = "PublicIconButton"

export { PublicIconButton, publicIconButtonVariants }
