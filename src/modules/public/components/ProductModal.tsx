"use client"

import * as React from "react"
import { Check, Plus, X } from "lucide-react"

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-background text-foreground shadow-2xl ring-1 ring-black/5 dark:ring-white/10 sm:rounded-[2rem]">
        <div className="relative m-4 mb-0 overflow-hidden rounded-[1.75rem] bg-muted shadow-sm">
          <div className="aspect-[16/11] w-full">
            {imageUrl ? (
              <img
                src={getOptimizedImage(imageUrl, 900)}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                <Plus className="h-10 w-10" />
              </div>
            )}
          </div>
          {product?.isPopular || product?.popular ? (
            <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--color-primary)] shadow-sm backdrop-blur">
              Populaire
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/70 active:scale-95"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-5 pt-4">
          <div>
            <h2 className="text-3xl font-black leading-tight tracking-tight">{product.name}</h2>
            {product.description ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.description}</p>
            ) : null}
            <p className="mt-4 whitespace-nowrap text-2xl font-black text-[var(--color-primary)]">
              {(getBasePrice(product) + getSelectedSizePrice(product, selectedSize)).toLocaleString()} FCFA
            </p>
          </div>

          {sizeChoices.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide">Choisir la taille</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">Sélection obligatoire</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-black uppercase text-[var(--color-primary)]">
                  Obligatoire
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {sizeChoices.map((size: Choice) => {
                  const selected = selectedSize === size.name

                  return (
                    <button
                      key={size.name}
                      type="button"
                      onClick={() => setSelectedSize(size.name)}
                      className={cn(
                        "min-h-24 rounded-2xl border p-3 text-left shadow-sm transition active:scale-[0.98] sm:p-4",
                        selected
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-2 ring-[var(--color-primary)]/25"
                          : "border-border bg-card hover:border-[var(--color-primary)]/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black leading-tight sm:text-base">{formatSizeName(size.name)}</p>
                          <p className="mt-2 whitespace-nowrap text-sm font-bold text-muted-foreground">
                            {size.price > 0 ? `+${size.price.toLocaleString()} FCFA` : "Prix de base"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                            selected
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                              : "border-border bg-background"
                          )}
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {supplementChoices.length > 0 ? (
            <section className="space-y-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide">Suppléments</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Ajoutez ce qui vous fait plaisir</p>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
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
                        "flex min-h-16 w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 active:scale-[0.99]",
                        selected ? "bg-[var(--color-primary)]/10" : "bg-card hover:bg-muted/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                          selected
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                            : "border-border bg-muted text-muted-foreground"
                        )}
                      >
                        {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{supplement.name}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                          Supplément
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-sm font-black text-[var(--color-primary)]">
                        +{supplement.price.toLocaleString()} FCFA
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Prix mis à jour automatiquement
                </p>
              </div>
              <p className="shrink-0 whitespace-nowrap text-2xl font-black text-[var(--color-primary)]">
                {calculateTotalPrice().toLocaleString()} FCFA
              </p>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              console.log("CLICK ADD PUBLIC")
              handleAddToCart()
            }}
            className="flex h-14 w-full items-center justify-between gap-4 rounded-2xl bg-[var(--color-primary)] px-5 text-sm font-black uppercase text-white shadow-lg shadow-[var(--color-primary)]/20 transition active:scale-[0.98]"
          >
            <span className="min-w-0 truncate">Ajouter à la commande</span>
            <span className="shrink-0 whitespace-nowrap">{calculateTotalPrice().toLocaleString()} FCFA</span>
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

function formatSizeName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
