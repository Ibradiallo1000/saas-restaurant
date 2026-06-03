"use client"

import * as React from "react"
import { Plus, ShoppingCart } from "lucide-react"

import { PreparationBadge } from "@/components/PreparationBadge"
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
  categories = [],
  loading = false,
  formatPrice,
  onProductClick,
}: ProductGridProps) {
  const categoriesById = React.useMemo(() => {
    return new Map(categories.map((category: any) => [category.id, category.name || ""]))
  }, [categories])

  if (loading) {
    return (
      <div className="grid h-full min-h-0 grid-cols-2 content-start gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-[210px] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed bg-card text-sm font-bold text-muted-foreground">
        Aucun produit dans cette catégorie
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-2 content-start gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:auto-rows-fr">
      {products.map((product: any) => {
        const categoryName = categoriesById.get(product.categoryId) || ""

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onProductClick(product)}
            className={cn(
              "group flex h-[210px] flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all 2xl:h-[198px]",
              "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:border-primary active:bg-primary/10"
            )}
          >
            <div className="relative h-24 w-full shrink-0 bg-muted 2xl:h-20">
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
              <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Plus className="h-4 w-4" />
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-between p-3">
              <div className="min-h-0 space-y-2">
                <p className="line-clamp-2 text-sm font-black leading-tight text-foreground">
                  {product.name}
                </p>
                <PreparationBadge
                  item={{
                    preparationMode: product.preparationMode,
                    categoryName,
                  }}
                />
              </div>
              <p className="mt-2 whitespace-nowrap text-base font-black text-primary">{formatPrice(product)}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default React.memo(ProductGrid)
