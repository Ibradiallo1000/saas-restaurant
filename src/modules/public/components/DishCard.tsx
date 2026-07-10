"use client"

import * as React from "react"
import { ChefHat } from "lucide-react"

import { productNeedsConfigurator } from "@/lib/linked-option-groups"
import { getOptimizedImage } from "@/lib/image"
import { useCart } from "../cart/CartContext"

export default function DishCard({
  product,
  onOpenDetails,
  onAddedToCart,
}: {
  product: any
  onOpenDetails: () => void
  onAddedToCart?: () => void
}) {
  const { addItem } = useCart()
  const [imgError, setImgError] = React.useState(false)
  const [added, setAdded] = React.useState(false)

  const hasImage = Boolean(product?.imageUrl && !imgError)

  const hasOptions = productNeedsConfigurator(product)

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
    onAddedToCart?.()
  }

  return (
    <article
      className="
        grid w-full max-w-full grid-cols-[94px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden
        min-h-[108px]
        rounded-[1.4rem] border border-[var(--public-card-border)]
        bg-[var(--public-card-bg)] p-2 shadow-[0_10px_26px_rgba(15,23,42,0.07)]
        backdrop-blur-xl
        transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/35 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)]
        sm:grid-cols-[102px_minmax(0,1fr)_auto] sm:min-h-[118px] sm:gap-3.5 sm:p-2.5
      "
    >
      {/* IMAGE */}
      <div
        onClick={onOpenDetails}
        className="relative h-[94px] w-[94px] shrink-0 overflow-hidden rounded-[1.25rem] bg-[var(--brand-primary-soft)] shadow-inner sm:h-[102px] sm:w-[102px]"
      >
        {hasImage ? (
          <img
            src={getOptimizedImage(product.imageUrl, 200)}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--public-text-muted)]">
            <ChefHat className="h-6 w-6 opacity-50" />
          </div>
        )}

      </div>

      {/* CONTENT */}
      <div
        onClick={onOpenDetails}
        className="min-w-0 flex-1 cursor-pointer py-1"
      >
        <h3 className="truncate text-base font-black leading-tight text-[var(--public-text-main)] sm:text-lg">
          {product.name}
        </h3>

        {product.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-[var(--public-text-muted)] sm:text-sm sm:leading-5">
            {product.description}
          </p>
        ) : null}

        <p className="mt-2 whitespace-nowrap text-base font-black leading-none text-[var(--brand-primary)] sm:text-lg">
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
          min-h-10 max-w-[78px] shrink-0 rounded-full px-3 py-2 text-[11px] font-black
          shadow-lg transition-all duration-200 active:scale-95 sm:px-4
          ${
            added
              ? "bg-green-500 text-white shadow-green-500/20"
              : "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
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
