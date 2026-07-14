"use client"

import * as React from "react"
import { ShoppingBag } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicIconButton } from "./public-icon-button"

export interface PublicHeaderProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "menu" | "tracking"
  restaurantName: string
  logoUrl?: string | null
  logoAlt?: string
  fallbackText?: string
  context?: React.ReactNode
  themeAction?: React.ReactNode
  cartAction?: React.ReactNode
  onCartClick?: () => void
  cartCount?: number
  cartLabel?: string
  backAction?: React.ReactNode
  secondaryAction?: React.ReactNode
}

const PublicHeader = React.forwardRef<HTMLElement, PublicHeaderProps>(
  ({
    backAction,
    cartAction,
    cartCount = 0,
    cartLabel = "Ouvrir la commande",
    className,
    context,
    fallbackText,
    logoAlt,
    logoUrl,
    onCartClick,
    restaurantName,
    secondaryAction,
    themeAction,
    variant = "menu",
    ...props
  }, ref) => {
    const normalizedCount = Number.isFinite(cartCount) ? Math.max(0, Math.floor(cartCount)) : 0
    const badgeLabel = normalizedCount > 99 ? "99+" : String(normalizedCount)
    const accessibleCartLabel = normalizedCount > 0
      ? `${cartLabel}, ${normalizedCount} article${normalizedCount > 1 ? "s" : ""}`
      : cartLabel
    const fallback = fallbackText?.trim() || restaurantName.trim().charAt(0).toUpperCase() || "R"

    return (
      <header
        ref={ref}
        data-variant={variant}
        className={cn(
          "fixed inset-x-0 top-0 z-[60] border-b border-[var(--border-public-subtle)] bg-[var(--surface-public-translucent)] pt-[var(--safe-top)] font-publicBody text-[var(--text-primary)] shadow-[var(--shadow-public-xs)] backdrop-blur-xl",
          className
        )}
        {...props}
      >
        <div className="mx-auto flex h-[var(--public-header-height)] w-full max-w-[var(--public-max-marketing)] items-center gap-2 [padding-left:calc(var(--public-gutter-x)+var(--safe-left))] [padding-right:calc(var(--public-gutter-x)+var(--safe-right))]">
          {backAction && <div className="flex size-10 shrink-0 items-center justify-center">{backAction}</div>}

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-public-full)] border border-[var(--border-public-subtle)] bg-[var(--brand-primary-soft)] text-public-sm font-public-extrabold text-[var(--brand-primary)] shadow-[var(--shadow-public-xs)]">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={logoAlt ?? `Logo de ${restaurantName}`}
                  className="size-full object-cover"
                />
              ) : (
                <span aria-hidden="true">{fallback}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-public-bold leading-5 sm:text-public-md" title={restaurantName}>
                {restaurantName}
              </p>
              {context && <p className="truncate text-public-xs text-[var(--text-muted)]">{context}</p>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {themeAction && (
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-public-md)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] text-[var(--text-primary)] shadow-[var(--shadow-public-xs)] [&>button]:size-10 [&>button]:shrink-0">
                {themeAction}
              </div>
            )}
            {secondaryAction}
            {cartAction ?? (onCartClick ? (
              <PublicIconButton
                aria-label={accessibleCartLabel}
                onClick={onCartClick}
                variant="brand"
                size="compact"
                shape="full"
                className="relative"
              >
                <ShoppingBag className="size-[18px]" />
                {normalizedCount > 0 && (
                  <span
                    key={badgeLabel}
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-in items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--text-primary)] px-1 text-[10px] font-public-extrabold leading-none text-[var(--surface-public-card)] zoom-in-75 motion-reduce:animate-none"
                  >
                    {badgeLabel}
                  </span>
                )}
              </PublicIconButton>
            ) : null)}
          </div>
        </div>
      </header>
    )
  }
)
PublicHeader.displayName = "PublicHeader"

export { PublicHeader }
