"use client"

import * as React from "react"

import { PublicProductCard } from "@/components/public-ui"
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
  const [added, setAdded] = React.useState(false)
  const addedFeedbackTimeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (addedFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(addedFeedbackTimeoutRef.current)
    }
  }, [])

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

  const handleQuickAdd = () => {
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
    if (addedFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(addedFeedbackTimeoutRef.current)
    }
    addedFeedbackTimeoutRef.current = window.setTimeout(() => {
      setAdded(false)
      addedFeedbackTimeoutRef.current = null
    }, 1200)
    onAddedToCart?.()
  }

  return (
    <PublicProductCard
      name={product.name}
      description={product.description}
      imageUrl={product.imageUrl ? getOptimizedImage(product.imageUrl, 200) : undefined}
      imageAlt={product.name}
      price={priceLabel}
      actionLabel={added ? "✓ Ajouté" : hasOptions ? "Choisir" : "Ajouter"}
      actionState={added ? "added" : "default"}
      onOpen={onOpenDetails}
      onAction={handleQuickAdd}
    />
  )
}
