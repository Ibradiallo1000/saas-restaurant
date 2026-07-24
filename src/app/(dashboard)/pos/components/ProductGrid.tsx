"use client"

import * as React from "react"
import { PosEmptyState, PosProductCard, PosProductGrid, PosLoadingState } from "@/components/pos-ui"
import { getOptimizedImage } from "@/lib/image"

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
    return <PosLoadingState label="Chargement du catalogue" />
  }

  if (products.length === 0) {
    return <PosEmptyState title="Aucun produit dans cette catégorie" />
  }

  return (
    <PosProductGrid layout="twoColumns" className="content-start gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-2 min-[1180px]:grid-cols-5 min-[1440px]:grid-cols-6">
      {products.map((product: any) => {
        return (
          <PosProductCard
            key={product.id}
            name={product.name}
            imageUrl={product.imageUrl ? getOptimizedImage(product.imageUrl, 260) : null}
            imageAlt={product.name}
            price={formatPrice(product)}
            actionLabel="Ajouter"
            onSelect={() => onProductClick(product)}
            className="lg:min-h-0 lg:p-2 [&>div:first-child]:lg:mb-1.5 [&>div:first-child]:lg:aspect-[16/9] [&>span:last-child]:lg:mt-1.5 [&>span:last-child]:lg:min-h-10 [&>span:last-child]:lg:text-[13px]"
          />
        )
      })}
    </PosProductGrid>
  )
}

export default React.memo(ProductGrid)
