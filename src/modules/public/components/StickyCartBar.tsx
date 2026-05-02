"use client"

import { useCart } from "../cart/CartContext"

export default function StickyCartBar({ onClick }: { onClick?: () => void }) {
  const { total, count } = useCart()

  if (count === 0) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40">
      <button
        onClick={onClick}
        className="mx-auto flex w-full max-w-md items-center justify-between rounded-xl bg-[var(--color-primary)] px-4 py-3 text-white shadow-sm transition active:scale-[0.98]"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
            {count}
          </span>
          <span className="text-sm font-black">Voir le panier</span>
        </div>

        <span className="text-sm font-bold">
          {total.toLocaleString()} FCFA
        </span>
      </button>
    </div>
  )
}
