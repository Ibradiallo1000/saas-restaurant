"use client"

import ProductSelectorModal, {
  type ProductSelectorCartItem,
} from "@/modules/products/components/ProductSelectorModal"
import { getConfiguredCartItemId } from "@/lib/order-pricing"

import { useCart } from "../cart/CartContext"

export default function CategoryModal({
  category,
  products,
  search: _search,
  onSearchChange: _onSearchChange,
  onClose,
  onOpenProduct: _onOpenProduct,
}: {
  category: any
  products: any[]
  search: string
  onSearchChange: (value: string) => void
  onClose: () => void
  onOpenProduct: (product: any) => void
}) {
  const { addItem } = useCart()

  const handleAddToCart = (item: ProductSelectorCartItem) => {
    const product = products.find((currentProduct) => currentProduct.id === item.productId)

    addItem({
      id: getConfiguredCartItemId(item.productId, item.selectedOptions),
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.total,
      imageUrl: item.imageUrl,
      selectedOptions: item.selectedOptions,
      preparationMode: product?.preparationMode,
      categoryName: product?.categoryName || category?.name,
    })

    onClose()
  }

  void _search
  void _onSearchChange
  void _onOpenProduct

  return (
    <ProductSelectorModal
      mode="public"
      category={category}
      products={products}
      onClose={onClose}
      onAddToCart={handleAddToCart}
    />
  )
}
