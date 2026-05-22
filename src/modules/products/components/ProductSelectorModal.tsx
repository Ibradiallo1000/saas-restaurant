"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChefHat, Minus, Plus, Search, X } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { getProductBasePrice, recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { buildSelectionOptionsFromComponents } from "@/lib/product-components"
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
  const [selectedSize, setSelectedSize] = React.useState("petite")
  const [mounted, setMounted] = React.useState(false)
  const [animateIn, setAnimateIn] = React.useState(false)

  const selectedProduct =
    visibleProducts.find((product) => product.id === selectedProductId) ??
    visibleProducts[0]
  const options = React.useMemo<ProductOption[]>(
    () => getProductSelectionOptions(selectedProduct),
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

  // ✅ PRIX MINIMUM AFFICHÉ (jamais 0)
  const baseDisplayPrice = React.useMemo(() => {
    if (basePrice > 0) return basePrice

    const requiredOptions = options.filter((o) => o.required)
    const prices: number[] = []

    requiredOptions.forEach((opt) => {
      opt.choices?.forEach((c) => {
        if (c.price && c.price > 0) prices.push(c.price)
      })
    })

    return prices.length ? Math.min(...prices) : 0
  }, [basePrice, options])

  React.useEffect(() => {
    setSelections({})
    setQuantity(1)
    setSelectedSize("petite")
  }, [selectedProductId])

  React.useEffect(() => {
    setSelections((current) => {
      const next = { ...current }
      let changed = false

      options.forEach((option, optionIndex) => {
        if (!option.required || option.multiple || next[optionIndex]?.length) return
        if (!option.choices?.length) return

        next[optionIndex] = [0]
        if (option.name === "Taille") {
          setSelectedSize(option.choices[0]?.name || "petite")
        }
        changed = true
      })

      return changed ? next : current
    })
  }, [options])

  React.useEffect(() => {
    if (!selectedProduct) return

    try {
      const saved = localStorage.getItem("lastProductSelection")
      if (!saved) return

      const parsed = JSON.parse(saved)

      if (parsed.productId === selectedProduct.id) {
        setSelections(parsed.selections || {})
        setQuantity(parsed.quantity || 1)
      }
    } catch (e) {
      console.error("Erreur lastProductSelection", e)
    }
  }, [selectedProductId])

  React.useEffect(() => {
    setSelections((current) => {
      const next = { ...current }
      let changed = false

      options.forEach((option, optionIndex) => {
        if (!option.required || option.multiple || next[optionIndex]?.length) return
        if (!option.choices?.length) return

        next[optionIndex] = [0]
        if (option.name === "Taille") {
          setSelectedSize(option.choices[0]?.name || "petite")
        }
        changed = true
      })

      return changed ? next : current
    })
  }, [options, selectedProductId])

  React.useEffect(() => {
    setMounted(true)
    // Animation d'entrée
    requestAnimationFrame(() => {
      setAnimateIn(true)
    })
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

  const toggleChoice = React.useCallback(
    (option: ProductOption, optionIndex: number, choiceIndex: number) => {
      if (option.name === "Taille") {
        setSelectedSize(option.choices?.[choiceIndex]?.name || "petite")
      }

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
    },
    []
  )

  const handleAddToCart = React.useCallback(() => {
    if (!selectedProduct) {
      console.log("ADD TO CART", null)
      return
    }

    const sizeOptionIndex = options.findIndex((option) => option.name === "Taille")
    if (sizeOptionIndex >= 0 && !selectedSize) {
      alert("Choisissez une taille")
      return
    }

    if (!isValid) {
      alert("Choisissez les options obligatoires")
      return
    }

    try {
      localStorage.setItem(
        "lastProductSelection",
        JSON.stringify({
          productId: selectedProduct.id,
          selections,
          quantity,
        })
      )
    } catch (e) {
      console.error("Erreur sauvegarde lastProductSelection", e)
    }

    const item = {
      id: selectedProduct.id,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      image: selectedProduct.image,
      basePrice: selectedProduct.price,
      size: selectedSize,
      supplements: selectedOptions.filter((option) => option.optionName !== "Taille"),
      totalPrice: total,
      imageUrl,
      selectedOptions,
      quantity,
      unitPrice,
      total,
      product: selectedProduct,
    }

    console.log("ADD TO CART", item)
    try {
      onAddToCart(item)
    } catch (error) {
      console.error("ADD TO CART failed", error)
      alert("Impossible d'ajouter ce produit au panier")
    }
  }, [selectedProduct, options, selectedSize, isValid, selections, quantity, imageUrl, selectedOptions, unitPrice, total, onAddToCart])

  const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  // ================== POS MODE ==================
  const posProductSelector = mode === "pos" && (
    <section>
      <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        Produits
      </p>
      {visibleProducts.length > 5 ? (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Rechercher un produit..."
            className="h-9 w-full rounded-2xl border bg-card pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
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
                "px-3 py-1.5 text-[11px]",
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
    <section className={mode === "pos" ? "space-y-2" : "space-y-5"}>
      {options.map((option, optionIndex) => (
        <div key={`${selectedProduct.id}-${option.name}-${optionIndex}`} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className={cn("font-black", mode === "pos" ? "text-xs" : "text-sm")}>
              {option.name}
            </h3>
            {option.required && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-red-600">
                Obligatoire
              </span>
            )}
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
                  {selected && <Check className="h-3 w-3" />}
                  {choice.name}
                  {price > 0 && <span>+{price.toLocaleString()}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {options.length === 0 && (
        <div
          className={cn(
            "rounded-2xl bg-muted font-medium text-muted-foreground",
            mode === "pos" ? "p-3 text-xs" : "p-4 text-sm"
          )}
        >
          Aucun choix obligatoire pour ce produit.
        </div>
      )}
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
      onClick={() => handleAddToCart()}
      className="h-12 w-full rounded-xl bg-[var(--color-primary)] px-4 text-sm font-black uppercase text-white shadow-lg transition active:scale-[0.98]"
    >
      Ajouter – {total.toLocaleString()} FCFA
    </button>
  )

  if (!mounted) return null

  if (!selectedProduct) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        onMouseDown={handleOverlayMouseDown}
      >
        <div className="w-full max-w-md rounded-3xl bg-card border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 p-6 text-center text-foreground">
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

  // ================== POS MODE RENDER ==================
  if (mode === "pos") {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all duration-300"
        onMouseDown={handleOverlayMouseDown}
      >
        <div
          className={cn(
            "w-full max-w-md overflow-hidden rounded-2xl bg-card border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-all duration-300 ease-out",
            animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-white/10 bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{category?.name || selectedProduct.name}</p>
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {selectedProduct.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 hover:bg-muted transition"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/30 p-2">
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

            {posProductSelector}
            {optionsSection}

            {!isValid && (
              <p className="text-center text-[11px] font-bold text-amber-600">
                Veuillez selectionner les options obligatoires
              </p>
            )}
          </div>

          <footer className="sticky bottom-0 border-t border-white/10 bg-background/95 backdrop-blur-sm p-4">
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

  // ================== PUBLIC MODE RENDER ==================
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4 transition-all duration-300"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className={cn(
          "w-full max-w-[520px] rounded-t-3xl sm:rounded-3xl bg-background shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-300 ease-out sm:max-w-[500px]",
          animateIn ? "translate-y-0 sm:scale-100 opacity-100" : "translate-y-full sm:translate-y-0 sm:scale-95 opacity-0"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* HERO IMAGE CONTAINER */}
        <div className="relative h-48 sm:h-64 w-full bg-muted shrink-0">
          {imageUrl ? (
            <img
              key={selectedProduct.id}
              src={getOptimizedImage(imageUrl, 600)}
              alt={selectedProduct.name}
              className="h-full w-full object-cover animate-in fade-in duration-500"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/30">
              <ChefHat className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          
          {/* Gradient over image */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />
          
          {/* Close button inside image */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white active:scale-95 hover:bg-black/60 transition shadow-sm ring-1 ring-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-28 -mt-6 relative z-10">
          {/* DETAILS */}
          <div className="mb-6">
            <h2 className="text-2xl font-black leading-tight text-foreground">{selectedProduct.name}</h2>
            {selectedProduct.description && (
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {selectedProduct.description}
              </p>
            )}
            {baseDisplayPrice > 0 && (
              <p className="mt-2 text-base font-black text-[var(--color-primary)]">
                À partir de {baseDisplayPrice.toLocaleString()} FCFA
              </p>
            )}
          </div>

          {optionsSection}
        </div>

        <footer className="absolute bottom-0 left-0 right-0 border-t bg-background/90 backdrop-blur-xl p-4 sm:p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="text-xl font-black text-[var(--color-primary)]">
                {total.toLocaleString()} FCFA
              </p>
            </div>
            {quantityControls}
          </div>

          {!isValid && (
            <p className="mb-2 text-center text-xs font-bold text-amber-600">
              Veuillez sélectionner les options obligatoires
            </p>
          )}

          {addButton}
        </footer>
      </div>
    </div>,
    document.body
  )
}

function getProductSelectionOptions(product: any): ProductOption[] {
  if (!product) return []

  const componentOptions = buildSelectionOptionsFromComponents(product)
  if (
    componentOptions.length > 0 &&
    (!Array.isArray(product.sizes) || product.sizes.length === 0) &&
    (!Array.isArray(product.variants) || product.variants.length === 0) &&
    (!Array.isArray(product.options) || product.options.length === 0)
  ) {
    return componentOptions
  }

  const options: ProductOption[] = []

  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    options.push({
      name: "Taille",
      required: true,
      multiple: false,
      choices: product.sizes.map((size: any) => ({
        name: size.name || size.label || size.size || "Taille",
        price: Number(size.price ?? 0),
      })),
    })
  }

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    options.push({
      name: "Variante",
      required: true,
      multiple: false,
      choices: product.variants.map((variant: any) => ({
        name: variant.name || variant.label || "Variante",
        price: Number(variant.price ?? 0),
      })),
    })
  }

  if (Array.isArray(product.options)) {
    options.push(...product.options)
  }

  return options
}
