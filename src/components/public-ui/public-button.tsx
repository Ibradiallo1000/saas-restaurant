import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicButtonVariants = cva(
  "relative inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-public-lg)] px-5 font-publicBody text-public-sm font-public-bold outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-public-canvas)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] shadow-[var(--shadow-public-xs)] hover:bg-[var(--action-primary-hover)] active:bg-[var(--action-primary-active)]",

        secondary:
          "bg-[var(--surface-public-muted)] text-[var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-public-muted)_82%,var(--text-primary))]",

        outline:
          "border border-[var(--border-public-default)] bg-[var(--surface-public-card)] text-[var(--text-primary)] hover:border-[var(--border-public-strong)] hover:bg-[var(--surface-public-muted)]",

        ghost:
          "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-public-muted)]",

        danger:
          "bg-[var(--danger)] text-[var(--surface-2)] hover:bg-[color:color-mix(in_srgb,var(--danger)_88%,black)] active:bg-[color:color-mix(in_srgb,var(--danger)_80%,black)]",
      },

      size: {
        compact: "h-10 px-4",
        standard: "h-11",
        action: "h-[52px] px-6 text-public-md",
        hero: "h-14 px-7 text-public-md",
      },

      shape: {
        transactional: "rounded-[var(--radius-public-lg)]",
        marketing: "rounded-[var(--radius-public-full)]",
      },

      fullWidth: {
        true: "w-full min-w-0",
      },
    },

    defaultVariants: {
      variant: "primary",
      size: "standard",
      shape: "transactional",
    },
  }
)

export interface PublicButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof publicButtonVariants> {
  loading?: boolean
  loadingLabel?: string
}

const PublicButton = React.forwardRef<
  HTMLButtonElement,
  PublicButtonProps
>(
  (
    {
      children,
      className,
      disabled,
      loading = false,
      loadingLabel = "Chargement",
      type = "button",
      variant,
      size,
      shape,
      fullWidth,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          publicButtonVariants({
            variant,
            size,
            shape,
            fullWidth,
          }),
          className
        )}
        disabled={disabled || loading}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        ) : null}

        <span
          className={cn(
            "min-w-0 items-center justify-center gap-2",
            loading ? "sr-only" : "inline-flex"
          )}
        >
          {children}
        </span>

        {loading ? (
          <span className="sr-only">{loadingLabel}</span>
        ) : null}
      </button>
    )
  }
)

PublicButton.displayName = "PublicButton"

export { PublicButton, publicButtonVariants }