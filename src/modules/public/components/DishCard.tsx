"use client"

import * as React from "react"
import { ChefHat, Plus, Check, Flame } from "lucide-react"

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

  const hasOptions =
    (Array.isArray(product?.options) && product.options.length > 0) ||
    (Array.isArray(product?.sizes) && product.sizes.length > 0) ||
    (Array.isArray(product?.variants) && product.variants.length > 0)

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
    })

    navigator.vibrate?.(10)

    setAdded(true)
    setTimeout(() => setAdded(false), 800)
  }

  return (
    <article
      className="
        flex items-center gap-3
        bg-card border border-border
        rounded-2xl p-3
        shadow-sm
        transition-all duration-200
      "
    >
      {/* IMAGE */}
      <div
        onClick={onOpenDetails}
        className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0"
      >
        {hasImage ? (
          <img
            src={getOptimizedImage(product.imageUrl, 200)}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ChefHat className="h-6 w-6 opacity-50" />
          </div>
        )}

        {/* BADGE */}
        {isPopular && (
          <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Populaire
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div
        onClick={onOpenDetails}
        className="flex-1 cursor-pointer min-w-0"
      >
        <h3 className="text-sm font-bold text-foreground truncate">
          {product.name}
        </h3>

        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {product.description || "Spécialité du restaurant"}
        </p>

        <p className="text-[var(--color-primary)] font-bold mt-1 text-sm">
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
          px-3 py-2 rounded-xl text-xs font-bold
          transition-all duration-200 shrink-0
          ${
            added
              ? "bg-green-500 text-white"
              : "bg-[var(--color-primary)] text-white"
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