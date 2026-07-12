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

  const priceLabel =
    price > 0
      ? hasOptions
        ? `Dès ${price.toLocaleString()} FCFA`
        : `${price.toLocaleString()} FCFA`
      : "Prix sur demande"

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
    setTimeout(() => setAdded(false), 500)
    onAddedToCart?.()
  }

  return (
    <article
      className="
        grid min-h-[98px] w-full max-w-full grid-cols-[minmax(0,1fr)_112px] gap-2.5 overflow-hidden
        rounded-[1.2rem] border border-[var(--public-card-border)]
        bg-[var(--bg-card)] p-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)]
        transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/35 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)]
        dark:shadow-[0_10px_26px_rgba(0,0,0,0.24)]
        sm:grid-cols-[minmax(0,1fr)_120px] sm:gap-3 sm:p-2.5
      "
    >
      <div
        onClick={onOpenDetails}
        className="grid min-w-0 cursor-pointer grid-cols-[78px_minmax(0,1fr)] gap-2.5 overflow-hidden sm:grid-cols-[86px_minmax(0,1fr)] sm:gap-3"
      >
        <div className="relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[1rem] bg-[var(--brand-primary-soft)] shadow-inner sm:h-[86px] sm:w-[86px]">
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

        <div className="min-w-0 overflow-hidden py-0.5">
          <h3 className="truncate text-[14px] font-black leading-tight text-[var(--public-text-main)] sm:text-[15px]">
            {product.name}
          </h3>

          {product.description ? (
            <p className="mt-1 line-clamp-2 break-words text-[11.5px] leading-[15px] text-[var(--public-text-muted)] sm:text-xs sm:leading-4">
              {product.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex w-[112px] shrink-0 flex-col items-end justify-between gap-2 py-0.5 sm:w-[120px]">
        <p className="max-w-full text-right text-[13px] font-black leading-tight text-[var(--brand-primary)] sm:text-sm">
          {priceLabel}
        </p>

        <button
          onClick={handleQuickAdd}
          className={`
            min-h-8 max-w-full rounded-full px-3 py-1 text-[10.5px] font-black
            shadow-md transition-all duration-200 active:scale-95 sm:px-3.5
            ${
              added
                ? "bg-green-500 text-white shadow-green-500/20"
                : "bg-[var(--brand-primary)] text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]"
            }
          `}
        >
          {added ? "✓ Ajouté" : hasOptions ? "Options" : "Ajouter"}
        </button>
      </div>
    </article>
  )
}
