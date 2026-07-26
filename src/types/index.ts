/**
 * Source de vérité unique pour les types métier
 */

import { Timestamp } from "firebase/firestore"
import type {
  KitchenLifecycleStatus,
  OrderItemStatus,
  OrderOperationStatus,
  OrderPaymentLifecycleStatus,
} from "@/lib/order-lifecycle"
import type { ProductReviewsPolicy } from "@/lib/product-review-policy"

export type OrderStatus =
  | "nouvelle"
  | "preparation"
  | "prete"
  | "servie"
  | "payee"

export interface OrderItem {
  id?: string
  status?: OrderItemStatus | string | null
  createdAt?: Timestamp | Date | null
  productId: string // 🔥 lien produit
  name: string

  price: number // prix unitaire
  quantity: number
  reviewsEnabled?: boolean

  // 🔥 IMPORTANT pour options (taille, suppléments)
  selections?: Record<string, number[]>

  // 🔥 optimisation calcul
  total: number
}

export interface Order {
  id: string

  // 🔥 multi-tenant
  companyId: string
  restaurantId: string

  // 🔥 UX client
  customer: {
    name: string
    phone: string
  }

  table?: string

  mode: "sur_place" | "a_emporter"

  status: OrderStatus
  kitchenStatus?: KitchenLifecycleStatus
  orderStatus?: OrderOperationStatus
  paymentStatus?: OrderPaymentLifecycleStatus

  // 🔥 UX cuisine
  priority?: "normale" | "urgente"

  items: OrderItem[]

  total: number

  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface MenuItem {
  id: string
  name: string
  price: number
  imageUrl?: string
  categoryId?: string
  reviewsPolicy?: ProductReviewsPolicy
  reviewsEnabled?: boolean
  available?: boolean

  // 🔥 ajout logique options
  options?: {
    name: string
    required?: boolean
    choices: {
      name: string
      price: number
    }[]
  }[]
}

export interface MenuCategory {
  id: string
  name: string
  iconKey?: string | null
  reviewsEnabled?: boolean
  displayOrder?: number
  order?: number
}

export type EstablishmentContext = "standalone" | "hotel" | "lodge"

export interface RestaurantData {
  id?: string

  name: string
  slug: string

  context: EstablishmentContext

  countryCode: string
  countryName: string
  city: string

  currency: string
  timezone: string

  // 🔥 multi-tenant
  companyId: string
}
