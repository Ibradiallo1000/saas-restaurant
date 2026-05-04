"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChefHat, Minus, Plus, Search, X } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { getProductBasePrice, recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { cn } from "@/lib/utils"
import type { SelectedCartOption } from "@/modules/restaurant/types"

type ProductOptionChoice = {
  name: string
  price?: number
}

type ProductOption = {
  name: string
  required?: boolean
  multiple?: boolean
  choices?: ProductOptionChoice[]
}

export type ProductSelectorCartItem = {
  productId: string
  name: string
  imageUrl?: string
  selectedOptions: SelectedCartOption[]
  quantity: number
  unitPrice: number
  total: number
  product: any
}

type ProductSelectorModalProps = {
  category: any
  products: any[]
  initialProduct?: any
  mode?: "pos" | "public"
  onClose: () => void
  onAddToCart: (item: ProductSelectorCartItem) => void
}

export default function ProductSelectorModal({
  category,
  products,
  initialProduct,
  mode = "public",
  onClose,
  onAddToCart,
}: ProductSelectorModalProps) {
  const visibleProducts = React.useMemo(
    () => products.filter((product) => product?.isActive !== false),
    [products]
  )
  const [selectedProductId, setSelectedProductId] = React.useState(
    initialProduct?.id ?? visibleProducts[0]?.id ?? ""
  )
  const [productSearch, setProductSearch] = React.useState("")
  const [selections, setSelections] = React.useState<Record<number, number[]>>({})
  const [quantity, setQuantity] = React.useState(1)
  const [mounted, setMounted] = React.useState(false)

  const selectedProduct =
    visibleProducts.find((product) => product.id === selectedProductId) ??
    visibleProducts[0]
  const options = React.useMemo<ProductOption[]>(
    () => (Array.isArray(selectedProduct?.options) ? selectedProduct.options : []),
    [selectedProduct]
  )
  const basePrice = getProductBasePrice(selectedProduct)
  const imageUrl = selectedProduct?.imageUrl || category?.imageUrl || ""
  const displayedProducts = React.useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    const filteredProducts = search
      ? visibleProducts.filter((product) => {
          return (
            product.name?.toLowerCase().includes(search) ||
            product.description?.toLowerCase().includes(search)
          )
        })
      : visibleProducts.slice(0, 10)

    if (!selectedProduct) return filteredProducts
    if (filteredProducts.some((product) => product.id === selectedProduct.id)) {
      return filteredProducts
    }

    return [selectedProduct, ...filteredProducts].slice(0, 10)
  }, [productSearch, selectedProduct, visibleProducts])

  React.useEffect(() => {
    setSelections({})
    setQuantity(1)
  }, [selectedProductId])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleEsc)

    return () => {
      document.body.style.overflow = "unset"
      window.removeEventListener("keydown", handleEsc)
    }
  }, [mounted, onClose])

  const selectedOptions = React.useMemo<SelectedCartOption[]>(() => {
    return Object.entries(selections).flatMap(([optionIndex, choiceIndexes]) => {
      const option = options[Number(optionIndex)]
      if (!option) return []

      return choiceIndexes
        .map((choiceIndex) => option.choices?.[choiceIndex])
        .filter(Boolean)
        .map((choice) => ({
          optionName: option.name,
          choiceName: choice!.name,
          price: Number(choice!.price ?? 0),
        }))
    })
  }, [options, selections])

  const unitPrice = React.useMemo(() => {
    try {
      return recalculateConfiguredUnitPrice(selectedProduct, selectedOptions)
    } catch {
      return Math.round(basePrice + selectedOptions.reduce((sum, option) => sum + option.price, 0))
    }
  }, [basePrice, selectedOptions, selectedProduct])
  const total = unitPrice * quantity
  const isValid = options.every((option, optionIndex) => {
    if (!option.required) return true
    return (selections[optionIndex]?.length ?? 0) > 0
  })

  const toggleChoice = (option: ProductOption, optionIndex: number, choiceIndex: number) => {
    setSelections((current) => {
      const selectedChoices = current[optionIndex] ?? []

      if (!option.multiple) {
        return {
          ...current,
          [optionIndex]: selectedChoices.includes(choiceIndex) ? [] : [choiceIndex],
        }
      }

      return {
        ...current,
        [optionIndex]: selectedChoices.includes(choiceIndex)
          ? selectedChoices.filter((index) => index !== choiceIndex)
          : [...selectedChoices, choiceIndex],
      }
    })
  }

  const handleAdd = () => {
    if (!selectedProduct || !isValid) return

    onAddToCart({
      productId: selectedProduct.id,
      name: selectedProduct.name,
      imageUrl,
      selectedOptions,
      quantity,
      unitPrice,
      total,
      product: selectedProduct,
    })
  }

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const productSelector = (
    <section>
      <p className={cn(
        "mb-2 font-black uppercase tracking-widest text-muted-foreground",
        mode === "pos" ? "text-[9px]" : "text-[10px]"
      )}>
        Produits
      </p>
      {visibleProducts.length > 5 ? (
        <div className={cn("relative", mode === "pos" ? "mb-2" : "mb-3")}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Rechercher un produit..."
            className={cn(
              "w-full rounded-2xl border bg-card pl-9 pr-3 font-semibold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30",
              mode === "pos" ? "h-9 text-xs" : "h-10 text-sm"
            )}
          />
        </div>
      ) : null}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {displayedProducts.map((product) => {
          const active = product.id === selectedProduct.id

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedProductId(product.id)}
              className={cn(
                "shrink-0 rounded-full border font-black transition",
                mode === "pos" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              {product.name}
            </button>
          )
        })}
      </div>
      {!productSearch && visibleProducts.length > displayedProducts.length ? (
        <p className="mt-1 text-[9px] font-bold text-muted-foreground">
          {displayedProducts.length} sur {visibleProducts.length}. Recherchez pour voir plus.
        </p>
      ) : null}
    </section>
  )

  const optionsSection = (
    <section className={cn(mode === "pos" ? "space-y-2" : "space-y-4")}>
      {options.map((option, optionIndex) => (
        <div key={`${selectedProduct.id}-${option.name}-${optionIndex}`} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className={cn("font-black", mode === "pos" ? "text-xs" : "text-sm")}>
              {option.name}
            </h3>
            {option.required ? (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-red-600">
                Obligatoire
              </span>
            ) : null}
          </div>

          <div className={cn("flex flex-wrap", mode === "pos" ? "gap-1.5" : "gap-2")}>
            {(option.choices || []).map((choice, choiceIndex) => {
              const selected = selections[optionIndex]?.includes(choiceIndex)
              const price = Number(choice.price ?? 0)

              return (
                <button
                  key={`${choice.name}-${choiceIndex}`}
                  type="button"
                  onClick={() => toggleChoice(option, optionIndex, choiceIndex)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border font-bold transition",
                    mode === "pos" ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-2 text-xs",
                    selected
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                  {choice.name}
                  {price > 0 ? <span>+{price.toLocaleString()}</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {options.length === 0 ? (
        <div className={cn(
          "rounded-2xl bg-muted font-medium text-muted-foreground",
          mode === "pos" ? "p-3 text-xs" : "p-4 text-sm"
        )}>
          Aucun choix obligatoire pour ce produit.
        </div>
      ) : null}
    </section>
  )

  const quantityControls = (
    <div className="flex items-center gap-2 rounded-2xl border bg-card p-1">
      <button
        type="button"
        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-7 text-center text-sm font-black">{quantity}</span>
      <button
        type="button"
        onClick={() => setQuantity((current) => current + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )

  const addButton = (
    <button
      type="button"
      onClick={handleAdd}
      disabled={!isValid}
      className="h-12 w-full rounded-xl bg-[var(--color-primary)] px-4 text-sm font-black uppercase text-white shadow-lg transition active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
    >
      Ajouter au panier
    </button>
  )

  if (!mounted) return null

  if (!selectedProduct) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] p-4 backdrop-blur-sm"
        onMouseDown={handleOverlayMouseDown}
      >
        <div className="w-full max-w-md rounded-3xl bg-background p-6 text-center text-foreground shadow-2xl">
          <ChefHat className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-bold text-muted-foreground">Aucun produit disponible</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white"
          >
            Fermer
          </button>
        </div>
      </div>,
      document.body
    )
  }

  if (mode === "pos") {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] p-4 backdrop-blur-sm"
        onMouseDown={handleOverlayMouseDown}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl bg-background text-foreground shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">
                {category?.name || selectedProduct.name}
              </p>
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {selectedProduct.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {imageUrl ? (
                  <img
                    key={selectedProduct.id}
                    src={getOptimizedImage(imageUrl, 120)}
                    alt={selectedProduct.name}
                    width={120}
                    height={120}
                    className="h-full w-full animate-in fade-in duration-200 object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ChefHat className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black">{selectedProduct.name}</h2>
                <p className="text-sm font-black text-[var(--color-primary)]">
                  {unitPrice.toLocaleString()} FCFA
                </p>
              </div>
            </div>

            {productSelector}
            {optionsSection}

            {!isValid ? (
              <p className="text-center text-[11px] font-bold text-amber-600">
                Veuillez selectionner les options obligatoires
              </p>
            ) : null}
          </div>

          <footer className="sticky bottom-0 border-t bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              {quantityControls}
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Total
                </p>
                <p className="text-xl font-black text-[var(--color-primary)]">
                  {total.toLocaleString()} FCFA
                </p>
              </div>
            </div>
            {addButton}
          </footer>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] px-5 py-6 backdrop-blur-sm"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="z-[100] flex max-h-[90vh] w-[92%] max-w-[520px] flex-col overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl sm:max-w-[500px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b bg-card px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">
              {category?.name || selectedProduct.name}
            </p>
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              {selectedProduct.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 pb-28">
          <div className="flex items-center gap-4 rounded-3xl bg-muted/60 p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
              {imageUrl ? (
                <img
                  key={selectedProduct.id}
                  src={getOptimizedImage(imageUrl, 300)}
                  alt={selectedProduct.name}
                  width={300}
                  height={300}
                  className="h-full w-full animate-in fade-in duration-200 object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ChefHat className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-black">{selectedProduct.name}</h2>
              <p className="text-sm font-black text-[var(--color-primary)]">
                {unitPrice.toLocaleString()} FCFA
              </p>
            </div>
          </div>

          {productSelector}
          {optionsSection}
        </div>

        <footer className="sticky bottom-0 space-y-4 border-t bg-background p-5 shadow-[0_-12px_28px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="text-2xl font-black text-[var(--color-primary)]">
                {total.toLocaleString()} FCFA
              </p>
            </div>
            {quantityControls}
          </div>

          {!isValid ? (
            <p className="text-center text-xs font-bold text-amber-600">
              Veuillez selectionner les options obligatoires
            </p>
          ) : null}

          {addButton}
        </footer>
      </div>
    </div>,
    document.body
  )
}
