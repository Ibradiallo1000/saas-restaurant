"use client"

import * as React from "react"
import { ShoppingBag } from "lucide-react"

import { ThemeToggle } from "@/components/ui/theme-toggle"
import { getOptimizedImage } from "@/lib/image"

export default function PublicMenuHeader({
  restaurant,
  cartCount = 0,
  onCartClick,
}: {
  restaurant: any
  cartCount?: number
  onCartClick?: () => void
}) {
  const name = restaurant?.name || "Restaurant"
  const logo = restaurant?.logoUrl || restaurant?.logo
  const initial = name.charAt(0).toUpperCase()
  const [badgePulse, setBadgePulse] = React.useState(false)
  const previousCountRef = React.useRef(cartCount)

  React.useEffect(() => {
    if (cartCount > previousCountRef.current) {
      setBadgePulse(true)
      const timeout = window.setTimeout(() => setBadgePulse(false), 450)
      previousCountRef.current = cartCount
      return () => window.clearTimeout(timeout)
    }

    previousCountRef.current = cartCount
  }, [cartCount])

  return (
    <header className="fixed left-0 right-0 top-0 z-[60] border-b border-[var(--public-card-border)] bg-white px-4 pb-2.5 pt-[max(0.55rem,env(safe-area-inset-top))] shadow-[0_6px_18px_rgba(15,23,42,0.07)] dark:bg-slate-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--public-card-border)] bg-[var(--brand-primary-soft)] text-sm font-black text-[var(--brand-primary)] shadow-sm">
            {logo ? (
              <img
                src={getOptimizedImage(logo, 120)}
                alt={`Logo ${name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[15px] font-black leading-tight text-[var(--public-text-main)] sm:text-base">
              {name}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--public-card-border)] bg-background text-foreground shadow-sm">
            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={onCartClick}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/35"
            aria-label="Ouvrir la commande"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />

            {cartCount > 0 ? (
              <span
                className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-black leading-none text-white transition-transform duration-300 ${
                  badgePulse ? "scale-125" : "scale-100"
                }`}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  )
}
