"use client"

import { useCart } from "../cart/CartContext"

export default function StickyCartBar({ onClick }: { onClick?: () => void }) {
  const { total, count } = useCart()

  if (count === 0) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 md:bottom-28 md:left-1/2 md:right-auto md:w-[min(28rem,calc(100vw-2rem))] md:-translate-x-1/2">
      <button
        onClick={onClick}
        className="mx-auto flex w-full max-w-md items-center justify-between gap-4 rounded-[1.4rem] bg-gradient-to-br from-[#fb923c] to-[#f97316] px-4 py-3 text-white shadow-[0_16px_35px_rgba(249,115,22,0.30)] transition active:scale-[0.98] sm:px-5 sm:py-4"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-[var(--public-orange)]">
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
