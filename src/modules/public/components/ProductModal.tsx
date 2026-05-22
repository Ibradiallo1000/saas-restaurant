"use client"

import * as React from "react"
import { X } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"

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

  React.useEffect(() => {
    setSelectedSize(defaultSize?.name || "petite")
    setSelectedSupplements([])
    setQuantity(1)
  }, [product?.id])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  function calculateTotalPrice() {
    const sizePrice = getSelectedSizePrice(product, selectedSize)
    const supplementsTotal = selectedSupplements.reduce((sum, item) => sum + item.price, 0)
    return (getBasePrice(product) + sizePrice + supplementsTotal) * quantity
  }

  function handleAddToCart() {
    console.log("HANDLE ADD TRIGGERED")

    if (!product) return

    if (getSizeChoices(product).length > 0 && !selectedSize) {
      alert("Choisissez une taille")
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
      selectedOptions,
    }

    console.log("ITEM BUILT", item)

    if (!onAddToCart) {
      console.error("onAddToCart is undefined")
      return
    }

    console.log("ADD TO CART", item)
    onAddToCart(item)
  }

  const sizeChoices = getSizeChoices(product)
  const supplementChoices = getSupplementChoices(product)
  const imageUrl = product?.imageUrl

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-[400px] max-w-full overflow-hidden rounded-xl bg-white p-5 text-foreground shadow-2xl dark:bg-[#1a1a1a]">
        <div className="relative aspect-[4/3] bg-muted">
          {imageUrl ? (
            <img
              src={getOptimizedImage(imageUrl, 600)}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <h2 className="text-2xl font-black leading-tight">{product.name}</h2>
            {product.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
            ) : null}
            <p className="mt-2 text-base font-black text-[var(--color-primary)]">
              {(getBasePrice(product) + getSelectedSizePrice(product, selectedSize)).toLocaleString()} FCFA
            </p>
          </div>

          {sizeChoices.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Taille</p>
              <div className="flex flex-wrap gap-2">
                {sizeChoices.map((size: Choice) => (
                  <button
                    key={size.name}
                    type="button"
                    onClick={() => setSelectedSize(size.name)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-xs font-bold",
                      selectedSize === size.name
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-border bg-card"
                    )}
                  >
                    {formatSizeLabel(size)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {supplementChoices.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Supplements</p>
              <div className="flex flex-wrap gap-2">
                {supplementChoices.map((supplement: Choice) => {
                  const selected = selectedSupplements.some((item) => item.name === supplement.name)
                  return (
                    <button
                      key={supplement.name}
                      type="button"
                      onClick={() => {
                        setSelectedSupplements((current) =>
                          selected
                            ? current.filter((item) => item.name !== supplement.name)
                            : [...current, supplement]
                        )
                      }}
                      className={cn(
                        "rounded-full border px-3 py-2 text-xs font-bold",
                        selected
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-border bg-card"
                      )}
                    >
                      {supplement.name} +{supplement.price.toLocaleString()}
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => {
              console.log("CLICK ADD PUBLIC")
              handleAddToCart()
            }}
            className="h-12 w-full rounded-xl bg-[var(--color-primary)] text-sm font-black uppercase text-white shadow-lg active:scale-[0.98]"
          >
            Ajouter à la commande · {calculateTotalPrice().toLocaleString()} FCFA
          </button>
        </div>
      </div>
    </div>
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

function formatSizeLabel(size: Choice) {
  const name = size.name.charAt(0).toUpperCase() + size.name.slice(1)
  if (size.isDefault) return `${name} (par défaut)`
  if (size.price > 0) return `${name} +${size.price.toLocaleString()} FCFA`
  return name
}
