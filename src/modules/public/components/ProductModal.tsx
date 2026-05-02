"use client"

import ProductSelectorModal, {
  type ProductSelectorCartItem,
} from "@/modules/products/components/ProductSelectorModal"
import { getConfiguredCartItemId } from "@/lib/order-pricing"

import { useCart } from "../cart/CartContext"

export default function ProductModal({ product, onClose }: any) {
  const { addItem } = useCart()

  const handleAddToCart = (item: ProductSelectorCartItem) => {
    addItem({
      id: getConfiguredCartItemId(item.productId, item.selectedOptions),
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.total,
      imageUrl: item.imageUrl,
      selectedOptions: item.selectedOptions,
    })

    onClose()
  }

  return (
    <ProductSelectorModal
      mode="public"
      category={{ id: product.categoryId, name: product.categoryName }}
      products={[product]}
      initialProduct={product}
      onClose={onClose}
      onAddToCart={handleAddToCart}
    />
  )
}
