/**
 * Source de vérité unique pour les types métier
 */

import { Timestamp } from "firebase/firestore"

export type OrderStatus =
  | "nouvelle"
  | "preparation"
  | "prete"
  | "servie"
  | "payee"

export interface OrderItem {
  productId: string // 🔥 lien produit
  name: string

  price: number // prix unitaire
  quantity: number

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
