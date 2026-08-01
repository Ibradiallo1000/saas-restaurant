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
    <PosProductGrid layout="twoColumns" className="content-start gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-2 min-[1180px]:grid-cols-5 min-[1440px]:grid-cols-6">
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
            availabilityLabel={stock.availability === "unknown" ? <span className="hidden md:inline">{stock.label}</span> : stock.label}
            disabled={stock.disabled}
            actionLabel="Ajouter"
            onSelect={() => onProductClick(product)}
            className="min-h-[8.75rem] p-2 [&>div:first-child]:mb-1.5 [&>div:first-child]:aspect-[16/10] [&>span:last-child]:mt-1.5 [&>span:last-child]:min-h-11 [&>span:last-child]:text-xs md:min-h-[11rem] md:p-3 md:[&>div:first-child]:mb-3 md:[&>div:first-child]:aspect-[4/3] md:[&>span:last-child]:mt-3 md:[&>span:last-child]:text-sm lg:min-h-0 lg:p-2 lg:[&>div:first-child]:mb-1.5 lg:[&>div:first-child]:aspect-[16/9] lg:[&>span:last-child]:mt-1.5 lg:[&>span:last-child]:min-h-10 lg:[&>span:last-child]:text-[13px]"
          />
        )
      })}
    </PosProductGrid>
  )
}

export default React.memo(ProductGrid)
