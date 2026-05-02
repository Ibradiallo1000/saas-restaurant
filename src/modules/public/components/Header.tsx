"use client"

import { ShoppingBag } from "lucide-react"

import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function Header({
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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">

      {/* LEFT */}
      <div className="flex min-w-0 items-center gap-3">
        {logo ? (
          <img
            src={logo}
            alt={`${name} logo`}
            className="h-10 w-10 shrink-0 rounded-full object-cover border"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-base font-black text-white">
            {initial}
          </div>
        )}

        <p className="truncate text-base font-black text-foreground">
          {name}
        </p>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <button
          type="button"
          onClick={onCartClick}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[var(--color-primary)] transition hover:bg-muted/80 active:scale-95"
          aria-label="Ouvrir le panier"
        >
          <ShoppingBag className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[10px] font-black text-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>

    </header>
  )
}
