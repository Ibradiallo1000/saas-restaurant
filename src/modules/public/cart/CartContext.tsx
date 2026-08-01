"use client"

import * as React from "react"

import type { CartItem, CartSelection, SelectedCartOption } from "@/modules/restaurant/types"
import { getCartLinesForBundleRemoval } from "@/lib/linked-option-groups"
import { readRestaurantCart, writeRestaurantCart } from "./cart-storage"
import {
  productUnavailableMessage,
  resolveEffectiveProductAvailability,
  type OperationalAvailabilityState,
} from "@/lib/product-availability"

export type UnavailableCartItem = {
  id: string
  productId: string
  name: string
  state: OperationalAvailabilityState
  message: string
}

type AddCartItemInput = {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity?: number
  total?: number
  selections?: CartSelection
  selectedOptions?: SelectedCartOption[]
  imageUrl?: string
  preparationMode?: CartItem["preparationMode"]
  categoryName?: string
  reviewsEnabled?: boolean
  bundleId?: string
  isBundleMain?: boolean
  linkedGroupTitle?: string
}

type CartContextType = {
  items: CartItem[]
  addItem: (item: AddCartItemInput) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  updateQuantity: (id: string, qty: number) => void
  clear: () => void
  clearCart: () => void
  total: number
  count: number
  totalPrice: number
  totalItems: number
  restaurantId: string | null
  setRestaurantScope: (restaurantId: string) => void
  syncCatalogAvailability: (products: any[]) => void
  unavailableItems: UnavailableCartItem[]
  hasUnavailableItems: boolean
}

const CartContext = React.createContext<CartContextType | null>(null)

export const useCart = () => {
  const ctx = React.useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null)
  const itemsRef = React.useRef(items)
  const [catalogProducts, setCatalogProducts] = React.useState<any[]>([])
  const [catalogAvailabilityReady, setCatalogAvailabilityReady] = React.useState(false)
  itemsRef.current = items

  const setRestaurantScope = React.useCallback((nextRestaurantId: string) => {
    if (!nextRestaurantId || nextRestaurantId === restaurantId) return

    if (restaurantId) {
      writeRestaurantCart(window.localStorage, restaurantId, itemsRef.current)
    }

    setItems(readRestaurantCart(window.localStorage, nextRestaurantId, normalizeStoredItem))
    setRestaurantId(nextRestaurantId)
  }, [restaurantId])

  React.useEffect(() => {
    if (!restaurantId) return
    writeRestaurantCart(window.localStorage, restaurantId, items)
  }, [items, restaurantId])

  const addItem = (input: AddCartItemInput) => {
    const item = normalizeInputItem(input)
    if (!item) return

    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)

      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                total: i.unitPrice * (i.quantity + item.quantity),
                selectedOptions: i.selectedOptions ?? item.selectedOptions,
              }
            : i
        )
      }

      return [...prev, item]
    })
  }

  const removeItem = (id: string) => {
    setItems((prev) => {
      const idsToRemove = new Set(getCartLinesForBundleRemoval(prev, id))
      return prev.filter((item) => !idsToRemove.has(item.id))
    })
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id)
      return
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: qty, total: i.unitPrice * qty } : i
      )
    )
  }

  const clear = () => setItems([])

  const total = items.reduce(
    (sum, item) => sum + item.total,
    0
  )

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const unavailableItems = React.useMemo(() => {
    const byId = new Map(catalogProducts.map((product) => [product.id, product]))
    return items.flatMap((item) => {
      const product = byId.get(item.productId)
      if (!product) return catalogAvailabilityReady ? [{
        id: item.id,
        productId: item.productId,
        name: item.name,
        state: "PAUSED" as const,
        message: `${item.name} n'est plus disponible.`,
      }] : []
      const availability = resolveEffectiveProductAvailability(product)
      if (availability.orderable) return []
      return [{
        id: item.id,
        productId: item.productId,
        name: item.name,
        state: availability.operationalState,
        message: productUnavailableMessage(item.name, availability.operationalState),
      }]
    })
  }, [catalogAvailabilityReady, catalogProducts, items])
  const syncCatalogAvailability = React.useCallback((products: any[]) => {
    setCatalogProducts(Array.isArray(products) ? products : [])
    setCatalogAvailabilityReady(true)
  }, [])

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        updateQuantity: updateQty,
        clear,
        clearCart: clear,
        total,
        count,
        totalPrice: total,
        totalItems: count,
        restaurantId,
        setRestaurantScope,
        syncCatalogAvailability,
        unavailableItems,
        hasUnavailableItems: unavailableItems.length > 0,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

function normalizeInputItem(input: AddCartItemInput): CartItem | null {
  const unitPrice = Number(input.unitPrice)
  const quantity = Number(input.quantity ?? 1)
  const total = Number(input.total ?? unitPrice * quantity)

  if (!input.id || !input.productId || !input.name) return null
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(total) || total < 0) return null

  return {
    id: input.id,
    productId: input.productId,
    name: input.name,
    unitPrice,
    quantity,
    total,
    selections: input.selections,
    selectedOptions: input.selectedOptions,
    imageUrl: input.imageUrl,
    preparationMode: input.preparationMode,
    categoryName: input.categoryName,
    reviewsEnabled: typeof input.reviewsEnabled === "boolean" ? input.reviewsEnabled : undefined,
    bundleId: input.bundleId,
    isBundleMain: input.isBundleMain,
    linkedGroupTitle: input.linkedGroupTitle,
  }
}

function normalizeStoredItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object") return null
  return normalizeInputItem(value as AddCartItemInput)
}
