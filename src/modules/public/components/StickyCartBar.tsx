"use client"

import { useCart } from "../cart/CartContext"

export default function StickyCartBar({ onClick }: { onClick?: () => void }) {
  const { total, count } = useCart()

  if (count === 0) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 md:bottom-24 md:left-1/2 md:right-auto md:w-[min(28rem,calc(100vw-2rem))] md:-translate-x-1/2">
      <button
        onClick={onClick}
        className="mx-auto flex w-full max-w-md items-center justify-between gap-4 rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-white shadow-lg shadow-[var(--color-primary)]/20 transition active:scale-[0.98] sm:px-5 sm:py-4"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
            {count}
          </span>
          <span className="truncate text-sm font-black">Voir la commande</span>
        </div>

        <span className="shrink-0 whitespace-nowrap text-sm font-bold">
          {total.toLocaleString()} FCFA
        </span>
      </button>
    </div>
  )
}
