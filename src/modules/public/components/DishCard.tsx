"use client"

import * as React from "react"
import { ChefHat, Flame } from "lucide-react"

import { productNeedsConfigurator } from "@/lib/linked-option-groups"
import { getOptimizedImage } from "@/lib/image"
import { useCart } from "../cart/CartContext"

export default function DishCard({
  product,
  onOpenDetails,
}: {
  product: any
  onOpenDetails: () => void
}) {
  const { addItem } = useCart()
  const [imgError, setImgError] = React.useState(false)
  const [added, setAdded] = React.useState(false)

  const hasImage = Boolean(product?.imageUrl && !imgError)

  const hasOptions = productNeedsConfigurator(product)

  // ✅ POPULARITÉ PLUS PROPRE
  const isPopular = (product?.orderCount || 0) > 10

  // ✅ PRIX
  const price = React.useMemo(() => {
    if (product?.basePrice > 0) return product.basePrice
    if (product?.price > 0) return product.price

    if (Array.isArray(product?.sizes)) {
      const prices = product.sizes.map((s: any) => s.price).filter(Boolean)
      if (prices.length) return Math.min(...prices)
    }

    if (Array.isArray(product?.variants)) {
      const prices = product.variants.map((v: any) => v.price).filter(Boolean)
      if (prices.length) return Math.min(...prices)
    }

    return 0
  }, [product])

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (hasOptions) {
      onOpenDetails()
      return
    }

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      unitPrice: price,
      quantity: 1,
      total: price,
      imageUrl: product.imageUrl,
      preparationMode: product.preparationMode,
      categoryName: product.categoryName,
    })

    navigator.vibrate?.(10)

    setAdded(true)
    setTimeout(() => setAdded(false), 800)
  }

  return (
    <article
      className="
        flex min-h-[112px] items-center gap-3
        rounded-[1.6rem] border border-[var(--public-card-border)]
        bg-[var(--public-card-bg)] p-3 shadow-[0_18px_45px_rgba(15,23,42,0.10)]
        backdrop-blur-xl
        transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--public-orange)]/35 hover:shadow-[0_22px_55px_rgba(15,23,42,0.14)]
        sm:min-h-[132px] sm:gap-4 sm:p-4
        md:h-full
      "
    >
      {/* IMAGE */}
      <div
        onClick={onOpenDetails}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--public-orange-soft)] shadow-inner sm:h-24 sm:w-24"
      >
        {hasImage ? (
          <img
            src={getOptimizedImage(product.imageUrl, 200)}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--public-text-muted)]">
            <ChefHat className="h-6 w-6 opacity-50" />
          </div>
        )}

        {/* BADGE */}
        {isPopular && (
          <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-[var(--public-orange)] px-2 py-0.5 text-[9px] font-black text-white shadow-lg shadow-orange-500/20">
            <Flame className="h-3 w-3" />
            Populaire
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div
        onClick={onOpenDetails}
        className="min-w-0 flex-1 cursor-pointer"
      >
        <h3 className="truncate text-sm font-black text-[var(--public-text-main)] sm:text-base">
          {product.name}
        </h3>

        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--public-text-muted)] sm:text-sm">
          {product.description || "Spécialité du restaurant"}
        </p>

        <p className="mt-2 whitespace-nowrap text-sm font-black text-[var(--public-orange)] sm:text-base">
          {price > 0
            ? hasOptions
              ? `Dès ${price.toLocaleString()} FCFA`
              : `${price.toLocaleString()} FCFA`
            : "Prix sur demande"}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={handleQuickAdd}
        className={`
          shrink-0 rounded-full px-3 py-2 text-xs font-black
          shadow-lg transition-all duration-200 active:scale-95 sm:px-4 sm:py-3
          ${
            added
              ? "bg-green-500 text-white shadow-green-500/20"
              : "bg-gradient-to-br from-[#fb923c] to-[#f97316] text-white shadow-orange-500/25"
          }
        `}
      >
        {added
          ? "Ajouté"
          : hasOptions
          ? "Options"
          : "Ajouter"}
      </button>
    </article>
  )
}
