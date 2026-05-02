"use client"

import * as React from "react"

import type { CartItem, CartSelection, SelectedCartOption } from "@/modules/restaurant/types"

const CART_STORAGE_KEY = "restaurant_public_cart_v1"

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
}

const CartContext = React.createContext<CartContextType | null>(null)

export const useCart = () => {
  const ctx = React.useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return

      setItems(parsed.map(normalizeStoredItem).filter(Boolean) as CartItem[])
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY)
    } finally {
      setIsReady(true)
    }
  }, [])

  React.useEffect(() => {
    if (!isReady) return
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [isReady, items])

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
    setItems((prev) => prev.filter((i) => i.id !== id))
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
  }
}

function normalizeStoredItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object") return null
  return normalizeInputItem(value as AddCartItemInput)
}
