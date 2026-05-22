"use client"

import * as React from "react"
import { Plus, ShoppingCart } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"

type ProductGridProps = {
  products: any[]
  loading?: boolean
  formatPrice: (product: any) => string
  onProductClick: (product: any) => void
}

export default function ProductGrid({
  products,
  loading = false,
  formatPrice,
  onProductClick,
}: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 2xl:grid-cols-5">
        {Array.from({ length: 20 }).map((_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-dashed bg-card text-sm font-bold text-muted-foreground">
        Aucun produit dans cette categorie
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-3 2xl:grid-cols-5">
      {products.map((product: any) => (
        <button
          key={product.id}
          type="button"
          onClick={() => onProductClick(product)}
          className={cn(
            "group flex min-h-44 flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-colors",
            "hover:border-orange-300 hover:bg-orange-50/60 active:border-primary active:bg-orange-100 dark:hover:bg-orange-950/20"
          )}
        >
          <div className="relative h-24 w-full bg-muted">
            {product.imageUrl ? (
              <img
                src={getOptimizedImage(product.imageUrl, 260)}
                className="h-full w-full object-cover"
                alt={product.name}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingCart className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Plus className="h-4 w-4" />
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-between p-3">
            <p className="line-clamp-2 text-sm font-black leading-tight text-foreground">
              {product.name}
            </p>
            <p className="mt-2 text-base font-black text-primary">{formatPrice(product)}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
