"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import {
  ProductCommerceModal,
  PublicButton,
  PublicOptionChoice,
  PublicOptionGroup,
  PublicPrice,
} from "@/components/public-ui"
import { getOptimizedImage } from "@/lib/image"

type Choice = {
  name: string
  price: number
  optionName?: string
  isDefault?: boolean
}

type PublicCartItem = {
  id: string
  productId: string
  name: string
  price: number
  unitPrice: number
  quantity: number
  total: number
  totalPrice: number
  imageUrl?: string
  preparationMode?: "kitchen" | "direct" | "bar"
  categoryName?: string
  selectedOptions?: Array<{
    optionName: string
    choiceName: string
    price: number
  }>
}

export default function ProductModal({
  product,
  onAddToCart,
  onClose,
}: {
  product: any
  onAddToCart?: (item: PublicCartItem) => void
  onClose: () => void
}) {
  const defaultSize = getSizeChoices(product)[0] || null
  const [selectedSize, setSelectedSize] = React.useState(defaultSize?.name || "petite")
  const [selectedSupplements, setSelectedSupplements] = React.useState<Choice[]>([])
  const [quantity, setQuantity] = React.useState(1)
  const [sizeError, setSizeError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSelectedSize(defaultSize?.name || "petite")
    setSelectedSupplements([])
    setQuantity(1)
    setSizeError(null)
  }, [product?.id])

  function calculateTotalPrice() {
    const sizePrice = getSelectedSizePrice(product, selectedSize)
    const supplementsTotal = selectedSupplements.reduce((sum, item) => sum + item.price, 0)
    return (getBasePrice(product) + sizePrice + supplementsTotal) * quantity
  }

  function handleAddToCart() {
    if (!product) return

    if (getSizeChoices(product).length > 0 && !selectedSize) {
      setSizeError("Sélectionnez une taille")
      return
    }

    const selectedSizeChoice = getSizeChoices(product).find((choice: Choice) => choice.name === selectedSize)
    const computedPrice = getBasePrice(product) + getSelectedSizePrice(product, selectedSize) +
      selectedSupplements.reduce((sum, item) => sum + item.price, 0)

    const selectedOptions = [
      ...(selectedSizeChoice
        ? [{
            optionName: selectedSizeChoice.optionName || "taille",
            choiceName: selectedSizeChoice.name,
            price: selectedSizeChoice.price,
          }]
        : []),
      ...selectedSupplements.map((supplement) => ({
        optionName: supplement.optionName || "Supplement",
        choiceName: supplement.name,
        price: supplement.price,
      })),
    ]

    const item = {
      id: `${product.id}_${selectedSize}_${selectedSupplements.map((supplement) => supplement.name).join("_") || "base"}`,
      productId: product.id,
      name: product.name,
      price: computedPrice,
      unitPrice: computedPrice,
      quantity: quantity || 1,
      total: calculateTotalPrice(),
      totalPrice: calculateTotalPrice(),
      imageUrl: product.imageUrl,
      preparationMode: product.preparationMode,
      categoryName: product.categoryName,
      selectedOptions,
    }

    if (!onAddToCart) {
      console.error("onAddToCart is undefined")
      return
    }

    onAddToCart(item)
  }

  const sizeChoices = getSizeChoices(product)
  const supplementChoices = getSupplementChoices(product)
  const imageUrl = product?.imageUrl

  return (
    <ProductCommerceModal
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      title={product.name}
      description={product.description}
      imageUrl={imageUrl ? getOptimizedImage(imageUrl, 900) : undefined}
      imageAlt={product.name}
      imageFallback={<Plus className="size-10" />}
      price={`${(getBasePrice(product) + getSelectedSizePrice(product, selectedSize)).toLocaleString()} FCFA`}
      footer={
        <PublicButton type="button" size="action" fullWidth onClick={handleAddToCart}>
          <span className="min-w-0 flex-1 truncate text-left">Ajouter à la commande</span>
          <span className="shrink-0 whitespace-nowrap">{calculateTotalPrice().toLocaleString()} FCFA</span>
        </PublicButton>
      }
    >
      <div className="space-y-6">
          {sizeChoices.length > 0 ? (
            <PublicOptionGroup
              title="Choisir la taille"
              description="Sélectionnez la taille souhaitée."
              required
              min={1}
              max={1}
              selectedCount={selectedSize ? 1 : 0}
              error={sizeError}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sizeChoices.map((size: Choice) => {
                  const selected = selectedSize === size.name

                  return (
                    <PublicOptionChoice
                      key={size.name}
                      name={`${product.id}-size`}
                      value={size.name}
                      label={formatSizeName(size.name)}
                      price={size.price > 0 ? `+${size.price.toLocaleString()} FCFA` : "Prix de base"}
                      selected={selected}
                      required
                      controlType="radio"
                      presentation="card"
                      onSelect={() => {
                        setSelectedSize(size.name)
                        setSizeError(null)
                      }}
                    />
                  )
                })}
              </div>
            </PublicOptionGroup>
          ) : null}

          {supplementChoices.length > 0 ? (
            <PublicOptionGroup
              title="Suppléments"
              description="Ajoutez ce qui vous fait plaisir."
              selectedCount={selectedSupplements.length}
            >
              <div className="space-y-2">
                {supplementChoices.map((supplement: Choice) => {
                  const selected = selectedSupplements.some((item) => item.name === supplement.name)
                  return (
                    <PublicOptionChoice
                      key={supplement.name}
                      name={`${product.id}-supplements`}
                      value={supplement.name}
                      label={supplement.name}
                      description="Supplément"
                      price={`+${supplement.price.toLocaleString()} FCFA`}
                      selected={selected}
                      controlType="checkbox"
                      presentation="row"
                      onSelect={() => {
                        setSelectedSupplements((current) =>
                          selected
                            ? current.filter((item) => item.name !== supplement.name)
                            : [...current, supplement]
                        )
                      }}
                    />
                  )
                })}
              </div>
            </PublicOptionGroup>
          ) : null}

          <section className="rounded-2xl border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Prix mis à jour automatiquement
                </p>
              </div>
              <PublicPrice value={`${calculateTotalPrice().toLocaleString()} FCFA`} role="total" className="shrink-0 whitespace-nowrap text-[var(--brand-primary)]" />
            </div>
          </section>
      </div>
    </ProductCommerceModal>
  )
}

function getSizeChoices(product: any) {
  const basePrice = getBasePrice(product)
  const sizeGroup = getSizeGroup(product)

  if (sizeGroup) {
    const choices = getOptionChoices(sizeGroup)
    if (choices.length > 0) {
      return choices.map((choice: any, index: number) => ({
        name: choice.label || choice.name || choice.size || "petite",
        price: Number(choice.price ?? 0),
        optionName: sizeGroup.name || "taille",
        isDefault: index === 0,
      }))
    }
  }

  if (Array.isArray(product?.sizes) && product.sizes.length > 0) {
    return product.sizes.map((size: any, index: number) => ({
      name: size.name || size.label || size.size || "petite",
      price: getLegacySizeDelta(Number(size.price ?? 0), basePrice, index),
      optionName: "taille",
      isDefault: index === 0,
    }))
  }

  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    return product.variants.map((variant: any, index: number) => ({
      name: variant.name || variant.label || "petite",
      price: getLegacySizeDelta(Number(variant.price ?? 0), basePrice, index),
      optionName: "taille",
      isDefault: index === 0,
    }))
  }

  return [
    {
      name: "petite",
      price: 0,
      optionName: "taille",
      isDefault: true,
    },
  ].filter(() => basePrice > 0)
}

function getSupplementChoices(product: any) {
  if (!Array.isArray(product?.options)) return []

  return product.options
    .filter((option: any) => !isSizeGroup(option) && (option?.multiple || option?.type === "multi_select" || option?.type === "checkbox"))
    .flatMap((option: any) =>
      getOptionChoices(option).map((choice: any) => ({
        name: choice.name || choice.label || "Supplement",
        price: Number(choice.price ?? 0),
        optionName: option.name || "Supplement",
      }))
    )
    .filter((choice: { price: number }) => choice.price > 0)
}

function getSelectedSizePrice(product: any, selectedSize: string) {
  const choices = getSizeChoices(product)
  const selected = choices.find((choice: Choice) => choice.name === selectedSize)
  return Number(selected?.price ?? 0)
}

function getBasePrice(product: any) {
  const price = Number(product?.unitPrice ?? product?.basePrice ?? product?.price ?? 0)
  return Number.isFinite(price) ? price : 0
}

function getSizeGroup(product: any) {
  if (!Array.isArray(product?.options)) return null
  return product.options.find((option: any) => isSizeGroup(option) && getOptionChoices(option).length > 0) || null
}

function isSizeGroup(option: any) {
  const name = normalizeOptionName(option?.name)
  return name === "taille" || name === "size" || name === "variante"
}

function getOptionChoices(option: any) {
  if (Array.isArray(option?.options)) return option.options
  if (Array.isArray(option?.choices)) return option.choices
  return []
}

function getLegacySizeDelta(rawPrice: number, basePrice: number, index: number) {
  if (!Number.isFinite(rawPrice)) return 0
  if (index === 0 && rawPrice === basePrice) return 0
  if (basePrice > 0 && rawPrice > basePrice) return rawPrice - basePrice
  return rawPrice
}

function normalizeOptionName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

function formatSizeName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
