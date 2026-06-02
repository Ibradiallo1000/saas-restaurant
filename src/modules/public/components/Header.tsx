"use client"

import { ShoppingBag } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import * as React from "react"

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

  const [scrolled, setScrolled] = React.useState(false)

  // 👉 détection scroll pour changer le style
  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-30
        flex h-16 items-center justify-between px-4 sm:h-[4.5rem] sm:px-6
        transition-all duration-300
        ${scrolled
          ? "border-b border-[var(--public-card-border)] bg-[var(--public-card-bg)] shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          : "bg-transparent"
        }
      `}
    >
      {/* OVERLAY (uniquement quand pas scroll) */}
      {!scrolled && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
      )}

      {/* CONTENT */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between">

        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-3">

          {/* LOGO */}
          {logo ? (
            <div
              className={`
                h-10 w-10 rounded-full overflow-hidden sm:h-11 sm:w-11
                transition-all duration-300
                ${scrolled
                  ? "border border-[var(--public-card-border)] bg-[var(--public-orange-soft)] shadow-sm"
                  : "border border-white/20 bg-white/[0.12] shadow-lg backdrop-blur"
                }
              `}
            >
              <img
                src={logo}
                alt={name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--public-orange)] text-sm font-black text-white shadow-lg shadow-orange-500/20 sm:h-11 sm:w-11">
              {initial}
            </div>
          )}

          {/* NAME */}
          <p
            className={`
              max-w-[48vw] truncate text-sm font-extrabold transition-colors duration-300 sm:max-w-[55vw] sm:text-base lg:max-w-none
              ${scrolled ? "text-[var(--public-text-main)]" : "text-white"}
            `}
          >
            {name}
          </p>
        </div>

        {/* RIGHT */}
        <div className="flex shrink-0 items-center gap-2">

          {/* THEME */}
          <div
            className={`
              flex h-9 w-9 items-center justify-center rounded-lg
              transition-all duration-300
              ${scrolled
                ? "border border-[var(--public-card-border)] bg-[var(--public-orange-soft)] text-[var(--public-text-main)]"
                : "border border-white/20 bg-white/[0.12] text-white backdrop-blur"
              }
            `}
          >
            <ThemeToggle />
          </div>

          {/* CART */}
          <button
            onClick={onCartClick}
            className={`
              relative flex h-9 w-9 items-center justify-center rounded-lg
              transition-all duration-300
              ${scrolled
                ? "bg-[var(--public-orange-soft)] text-[var(--public-orange)]"
                : "border border-white/20 bg-white/[0.12] text-white backdrop-blur"
              }
              active:scale-95
            `}
          >
            <ShoppingBag className="h-4 w-4" />

            {cartCount > 0 && (
              <span
                className="
                  absolute -top-1 -right-1
                  h-4 min-w-[16px]
                  flex items-center justify-center
                  rounded-full
                  bg-[var(--public-orange)]
                  text-[9px] font-black text-white px-1
                "
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  )
}
