import * as React from "react"

import { cn } from "@/lib/utils"

export interface PublicBottomNavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  onSelect?: () => void
  href?: string
  active?: boolean
  disabled?: boolean
  badge?: string | number | null
  ariaLabel?: string
  hidden?: boolean
}

export interface PublicBottomNavigationProps extends React.HTMLAttributes<HTMLElement> {
  items: PublicBottomNavigationItem[]
  activeId?: string
  variant?: "menu" | "tracking"
  ariaLabel?: string
}

function normalizeBadge(badge: PublicBottomNavigationItem["badge"]) {
  if (badge === null || badge === undefined || badge === "" || badge === 0) return null
  if (typeof badge === "number") return badge > 99 ? "99+" : String(Math.max(0, Math.floor(badge)))
  return badge
}

const PublicBottomNavigation = React.forwardRef<HTMLElement, PublicBottomNavigationProps>(
  ({ activeId, ariaLabel = "Navigation publique", className, items, variant = "menu", ...props }, ref) => {
    const visibleItems = items.filter((item) => !item.hidden)

    return (
      <nav
        ref={ref}
        aria-label={ariaLabel}
        data-variant={variant}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 w-full border-t border-[var(--border-public-subtle)] bg-[var(--surface-public-elevated)] pb-[var(--safe-bottom)] font-publicBody shadow-[var(--shadow-public-top)]",
          className
        )}
        {...props}
      >
        <div
          className="mx-auto grid h-[var(--public-navigation-height)] w-full max-w-[var(--public-max-transaction)] items-center gap-1 [padding-left:calc(var(--public-gutter-x)+var(--safe-left))] [padding-right:calc(var(--public-gutter-x)+var(--safe-right))]"
          style={{ gridTemplateColumns: `repeat(${Math.max(visibleItems.length, 1)}, minmax(0, 1fr))` }}
        >
          {visibleItems.map((item) => {
            const active = item.active ?? activeId === item.id
            const disabled = item.disabled || (!item.href && !item.onSelect)
            const badge = normalizeBadge(item.badge)
            const itemClassName = cn(
              "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-public-md)] px-1 text-[11px] font-public-semibold leading-4 outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-public-elevated)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
              active
                ? "bg-[var(--brand-primary-soft)] font-public-bold text-[var(--brand-primary)] after:absolute after:bottom-0.5 after:h-0.5 after:w-5 after:rounded-full after:bg-[var(--brand-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-public-muted)] hover:text-[var(--text-primary)]",
              disabled && "cursor-not-allowed opacity-50 active:scale-100"
            )
            const content = (
              <>
                <span className="relative flex h-5 items-center justify-center [&_svg]:size-[18px]" aria-hidden="true">
                  {item.icon}
                  {badge && (
                    <span
                      key={String(badge)}
                      className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] animate-in items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--text-primary)] px-1 text-[9px] font-public-extrabold leading-none text-[var(--surface-public-card)] zoom-in-75 motion-reduce:animate-none"
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </>
            )

            if (item.href && !disabled) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={itemClassName}
                  aria-label={item.ariaLabel ?? item.label}
                  aria-current={active ? "page" : undefined}
                >
                  {content}
                </a>
              )
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onSelect}
                disabled={disabled}
                aria-disabled={disabled || undefined}
                aria-label={item.ariaLabel ?? item.label}
                aria-current={active ? "page" : undefined}
                className={itemClassName}
              >
                {content}
              </button>
            )
          })}
        </div>
      </nav>
    )
  }
)
PublicBottomNavigation.displayName = "PublicBottomNavigation"

export { PublicBottomNavigation }
