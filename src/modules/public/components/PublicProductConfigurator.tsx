"use client"

import * as React from "react"

import ProductConfiguratorModal, {
  validateConfiguratorSelections,
} from "@/components/product-configurator/ProductConfiguratorModal"
import {
  buildBundleCartLines,
  getActiveLinkedOptionGroups,
  productNeedsConfigurator,
  type LinkedOptionGroup,
  type LinkedOptionSelection,
} from "@/lib/linked-option-groups"
import { getDefaultConfigSelections } from "@/lib/product-configurator"
import {
  getConfiguredCartItemId,
  getProductBasePrice,
  recalculateConfiguredUnitPrice,
} from "@/lib/order-pricing"
import type { SelectedCartOption } from "@/modules/restaurant/types"
import { useCart } from "../cart/CartContext"

type PublicProductConfiguratorProps = {
  product: any
  catalogProducts: any[]
  onClose: () => void
  onAdded?: () => void
}

export default function PublicProductConfigurator({
  product,
  catalogProducts,
  onClose,
  onAdded,
}: PublicProductConfiguratorProps) {
  const { addItem } = useCart()
  const [embeddedSelections, setEmbeddedSelections] = React.useState<Record<string, SelectedCartOption>>(
    () => getDefaultConfigSelections(product)
  )
  const [linkedSelections, setLinkedSelections] = React.useState<LinkedOptionSelection[]>([])
  const [validationError, setValidationError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setEmbeddedSelections(getDefaultConfigSelections(product))
    setLinkedSelections([])
    setValidationError(null)
  }, [product?.id])

  const toggleEmbeddedChoice = (
    group: { name: string; multiple?: boolean },
    choice: { name: string; price?: number }
  ) => {
    const selectedOption: SelectedCartOption = {
      optionName: group.name,
      choiceName: choice.name,
      price: Number(choice.price ?? 0),
    }

    setEmbeddedSelections((current) => {
      if (!group.multiple) {
        return { ...current, [group.name]: selectedOption }
      }

      const key = `${group.name}:${choice.name}`
      if (current[key]) {
        const next = { ...current }
        delete next[key]
        return next
      }

      return { ...current, [key]: selectedOption }
    })
  }

  const toggleLinkedProduct = (group: LinkedOptionGroup, productId: string) => {
    setLinkedSelections((current) => {
      const inGroup = current.filter((selection) => selection.groupId === group.id)
      const exists = inGroup.some((selection) => selection.productId === productId)

      if (exists) {
        return current.filter(
          (selection) => !(selection.groupId === group.id && selection.productId === productId)
        )
      }

      let next = current.filter((selection) => selection.groupId !== group.id || group.maxSelect > 1)
      if (group.maxSelect === 1) {
        next = next.filter((selection) => selection.groupId !== group.id)
      } else if (inGroup.length >= group.maxSelect) {
        return current
      }

      return [
        ...next,
        {
          groupId: group.id,
          groupTitle: group.title,
          productId,
        },
      ]
    })
    setValidationError(null)
  }

  const getUnitPrice = () => {
    try {
      return recalculateConfiguredUnitPrice(product, Object.values(embeddedSelections))
    } catch {
      return getProductBasePrice(product)
    }
  }

  const handleAdd = () => {
    const error = validateConfiguratorSelections(product, embeddedSelections, linkedSelections)
    if (error) {
      setValidationError(error)
      return
    }

    const selectedOptions = Object.values(embeddedSelections)
    const mainUnitPrice = getUnitPrice()
    const linkedGroups = getActiveLinkedOptionGroups(product)

    if (linkedGroups.length > 0 || linkedSelections.length > 0) {
      const bundleLines = buildBundleCartLines({
        mainProduct: product,
        selectedOptions,
        linkedSelections,
        linkedGroups,
        catalogProducts,
        mainUnitPrice,
      })

      bundleLines.forEach((line) => {
        addItem({
          id: line.id,
          productId: line.productId,
          name: line.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          total: line.unitPrice * line.quantity,
          selectedOptions: line.selectedOptions,
          imageUrl: line.imageUrl,
          preparationMode: line.preparationMode,
          bundleId: line.bundleId,
          isBundleMain: line.isBundleMain,
          linkedGroupTitle: line.linkedGroupTitle,
        })
      })
    } else {
      addItem({
        id: getConfiguredCartItemId(product.id, selectedOptions),
        productId: product.id,
        name: product.name,
        unitPrice: mainUnitPrice,
        quantity: 1,
        total: mainUnitPrice,
        selectedOptions,
        imageUrl: product.imageUrl,
        preparationMode: product.preparationMode,
        categoryName: product.categoryName,
      })
    }

    onAdded?.()
    onClose()
  }

  if (!productNeedsConfigurator(product)) {
    return null
  }

  return (
    <ProductConfiguratorModal
      product={product}
      catalogProducts={catalogProducts}
      embeddedSelections={embeddedSelections}
      linkedSelections={linkedSelections}
      unitPrice={getUnitPrice()}
      onToggleEmbeddedChoice={toggleEmbeddedChoice}
      onToggleLinkedProduct={toggleLinkedProduct}
      onClose={onClose}
      onAdd={handleAdd}
      validationError={validationError}
      publicCommerceShell
    />
  )
}
