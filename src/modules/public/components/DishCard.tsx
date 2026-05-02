"use client"

import * as React from "react"
import { ChefHat, Plus, Check } from "lucide-react"

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
  const price = Number(product?.basePrice ?? product?.price ?? 0)
  const hasOptions =
    Array.isArray(product?.options) && product.options.length > 0

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

    setAdded(true)
    setTimeout(() => setAdded(false), 1000)
  }

  return (
    <article
      onClick={onOpenDetails}
      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm transition hover:shadow-md active:scale-[0.98]"
    >
      {/* IMAGE */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {hasImage ? (
          <img
            src={getOptimizedImage(product.imageUrl, 300)}
            alt={product.name}
            loading="lazy"
            width={300}
            height={225}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <ChefHat className="h-8 w-8" />
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleQuickAdd}
          className={`absolute bottom-2 right-2 flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md transition-all
          ${
            added
              ? "bg-green-500 text-white scale-105"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" />
              Ajouté
            </>
          ) : hasOptions ? (
            "Choisir"
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Ajouter
            </>
          )}
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2">
          {product.name}
        </h3>

        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {product.description || "Plat du restaurant"}
        </p>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--color-primary)]">
            {price.toLocaleString()} FCFA
          </span>
        </div>
      </div>
    </article>
  )
}
