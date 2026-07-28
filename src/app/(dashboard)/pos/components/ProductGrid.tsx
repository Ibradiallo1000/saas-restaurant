"use client"

import * as React from "react"
import { PosEmptyState, PosProductCard, PosProductGrid, PosLoadingState } from "@/components/pos-ui"
import { getOptimizedImage } from "@/lib/image"
import {
  getPosStockPresentation,
  type PosStockAvailability,
} from "@/modules/stock/pos-stock-availability"

type ProductGridProps = {
  products: any[]
  categories?: any[]
  loading?: boolean
  formatPrice: (product: any) => string
  onProductClick: (product: any) => void
  stockByProduct: ReadonlyMap<string, PosStockAvailability>
}

function ProductGrid({
  products,
  loading = false,
  formatPrice,
  onProductClick,
  stockByProduct,
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
        const stock = getPosStockPresentation(stockByProduct.get(product.id))
        return (
          <PosProductCard
            key={product.id}
            name={product.name}
            imageUrl={product.imageUrl ? getOptimizedImage(product.imageUrl, 260) : null}
            imageAlt={product.name}
            price={formatPrice(product)}
            availability={stock.availability}
            availabilityLabel={stock.label}
            disabled={stock.disabled}
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
