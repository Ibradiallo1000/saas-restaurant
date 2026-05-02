import type { Timestamp } from "firebase/firestore"
import type { OrderStatus as CanonicalOrderStatus } from "@/lib/order-status"
import type { PaymentMethod, PaymentStatus } from "@/lib/order-payment"

export type Product = {
  id: string
  name: string
  basePrice: number
  imageUrl?: string
  categoryId: string
  isActive: boolean
}

export type Category = {
  id: string
  name: string
  order?: number
  isActive?: boolean
}

export type OrderStatus = CanonicalOrderStatus

export type OrderSource = "client" | "pos"

export type OrderItem = {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  total: number
}

export type RestaurantOrder = {
  id: string
  restaurantId: string
  source: OrderSource
  status: OrderStatus
  sessionId?: string
  customer?: {
    name: string
    phone: string
  }
  table?: string
  items: OrderItem[]
  total: number
  paymentMethod?: PaymentMethod | null
  paymentStatus?: PaymentStatus | null
  paidAt?: Timestamp | null
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export type CartSelection = Record<string, number[]>

export type CartItem = {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  total: number
  selections?: CartSelection
  imageUrl?: string
}

// types.ts - AJOUTE À LA FIN
export type KitchenStatus = OrderStatus
