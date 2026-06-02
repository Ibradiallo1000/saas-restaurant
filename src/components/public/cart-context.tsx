"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"

// 🔥 TYPE PROPRE
export interface CartItem {
  id: string // unique (product + options)
  productId: string
  name: string
  price: number
  quantity: number
  selections: Record<string, number[]>
  imageUrl?: string
  preparationMode?: "kitchen" | "direct" | "bar"
  categoryName?: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (payload: {
    product: any
    quantity: number
    selections: Record<string, number[]>
    totalPrice: number
  }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // 🔥 LOAD
  useEffect(() => {
    const saved = localStorage.getItem("gastronome_cart")
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch {}
    }
    setIsInitialized(true)
  }, [])

  // 🔥 SAVE
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("gastronome_cart", JSON.stringify(items))
    }
  }, [items, isInitialized])

  // 🔥 ADD ITEM PRO
  const addItem = ({
    product,
    quantity,
    selections,
    totalPrice,
  }: {
    product: any
    quantity: number
    selections: Record<string, number[]>
    totalPrice: number
  }) => {
    setItems((prev) => {
      // 🔥 ID UNIQUE = produit + options
      const uniqueId = `${product.id}_${JSON.stringify(selections)}`

      const existing = prev.find((i) => i.id === uniqueId)

      if (existing) {
        return prev.map((i) =>
          i.id === uniqueId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      }

      return [
        ...prev,
        {
          id: uniqueId,
          productId: product.id,
          name: product.name,
          price: totalPrice, // 🔥 prix déjà calculé (options incluses)
          quantity,
          selections,
          imageUrl: product.imageUrl,
          preparationMode: product.preparationMode,
          categoryName: product.categoryName,
        },
      ]
    })
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    )
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const clearCart = () => setItems([])

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0)

  const totalPrice = items.reduce(
    (acc, i) => acc + i.price * i.quantity,
    0
  )

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
