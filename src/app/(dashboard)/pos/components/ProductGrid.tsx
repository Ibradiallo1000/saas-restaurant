"use client"

import * as React from "react"
import { Plus, ShoppingCart } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"

type ProductGridProps = {
  products: any[]
  categories?: any[]
  loading?: boolean
  formatPrice: (product: any) => string
  onProductClick: (product: any) => void
}

function ProductGrid({
  products,
  loading = false,
  formatPrice,
  onProductClick,
}: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid h-full min-h-0 grid-cols-2 content-start gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-[198px] animate-pulse rounded-[1.2rem] bg-muted" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-[1.35rem] border border-dashed bg-card/90 text-sm font-bold text-muted-foreground">
        Aucun produit dans cette catégorie
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-2 content-start gap-3 pr-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product: any) => {
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onProductClick(product)}
            className={cn(
              "group relative flex h-[198px] flex-col rounded-[1.2rem] border bg-white p-2.5 text-center shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition-all dark:bg-card",
              "hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/35 hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)] active:translate-y-0 active:border-[var(--brand-primary)]"
            )}
          >
            <div className="relative mx-auto h-[94px] w-[94px] shrink-0 overflow-hidden rounded-[1rem] bg-muted shadow-inner">
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
            </div>
            <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition group-hover:scale-105">
              <Plus className="h-4 w-4" />
            </span>

            <div className="flex min-h-0 flex-1 flex-col items-center pt-2.5">
              <p className="line-clamp-2 h-9 w-full text-center text-[13px] font-semibold leading-tight text-foreground">
                {product.name}
              </p>
              <p className="mt-2 h-6 whitespace-nowrap text-center text-[15px] font-semibold leading-6 text-[var(--brand-primary)]">{formatPrice(product)}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default React.memo(ProductGrid)
