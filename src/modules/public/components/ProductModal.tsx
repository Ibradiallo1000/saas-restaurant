"use client"

import * as React from "react"
import ProductPreview from "@/components/menu/ProductPreview"
import { X, Minus, Plus, ShoppingBag, CheckCircle } from "lucide-react"
import { getOptimizedImage } from "@/lib/image"
import { useCart } from "../cart/CartContext"
import type { CartSelection } from "@/modules/restaurant/types"

export default function ProductModal({ product, onClose }: any) {
  const [unitPrice, setUnitPrice] = React.useState(Number(product.basePrice || 0))
  const [isValid, setIsValid] = React.useState(false)
  const [selections, setSelections] = React.useState<CartSelection>({})
  const [quantity, setQuantity] = React.useState(1)
  const [isAdding, setIsAdding] = React.useState(false)
  const [added, setAdded] = React.useState(false)

  const { addItem } = useCart()

  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onClose])

  React.useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [])

  const handleChange = (data: {
    total: number
    selections: CartSelection
    isValid: boolean
  }) => {
    setUnitPrice(data.total)
    setIsValid(data.isValid)
    setSelections(data.selections)
  }

  const buildCartItemId = () => {
    return `${product.id}-${window.btoa(JSON.stringify(selections))}`
  }

  const handleAddToCart = async () => {
    if (!isValid || isAdding) return

    setIsAdding(true)

    addItem({
      id: buildCartItemId(),
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity,
      total: unitPrice * quantity,
      selections,
      imageUrl: product.imageUrl,
    })

    setAdded(true)

    setTimeout(() => {
      setIsAdding(false)
      setTimeout(() => {
        onClose()
      }, 300)
    }, 500)
  }

  const lineTotal = unitPrice * quantity

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bg-background text-foreground w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
        <div className="relative bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4">
          <div className="absolute inset-0 bg-black/20" />

          <div className="relative flex justify-between items-center">
            <div className="flex-1">
              <h2 className="font-bold text-white text-xl">{product.name}</h2>
              <p className="text-white/80 text-xs mt-1">
                Personnalisez votre plat
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            {product.imageUrl && (
              <div className="mb-4 aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                <img
                  src={getOptimizedImage(product.imageUrl, 600)}
                  alt={product.name}
                  width={600}
                  height={450}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <ProductPreview product={product} onChange={handleChange} />
          </div>
        </div>

        <div className="border-t bg-background p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Quantite</span>

            <div className="flex items-center gap-3 bg-card rounded-xl border p-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 flex items-center justify-center"
              >
                <Minus size={16} />
              </button>

              <span className="w-8 text-center font-semibold">{quantity}</span>

              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-[var(--color-primary)]">
                {lineTotal.toLocaleString()} FCFA
              </p>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!isValid || isAdding}
              className={`flex-1 py-3 rounded-xl font-semibold transition ${
                isValid
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isAdding ? (
                "Ajout..."
              ) : added ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Ajoute
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShoppingBag size={16} /> Ajouter
                </span>
              )}
            </button>
          </div>

          {!isValid && (
            <p className="text-xs text-amber-600 mt-3 text-center">
              Selectionnez les options obligatoires
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
