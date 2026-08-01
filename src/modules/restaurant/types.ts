import type { Timestamp } from "firebase/firestore"
import type { OrderStatus as CanonicalOrderStatus } from "@/lib/order-status"
import type { PaymentMethod, PaymentStatus } from "@/lib/order-payment"
import type { ProductReviewsPolicy } from "@/lib/product-review-policy"
import type {
  KitchenLifecycleStatus,
  OrderOperationStatus,
  OrderItemStatus,
  OrderPaymentLifecycleStatus,
} from "@/lib/order-lifecycle"
import type { RestaurantOpeningHours } from "@/lib/restaurant-hours"

export type Product = {
  id: string
  name: string
  basePrice: number
  imageUrl?: string
  categoryId: string
  marketplaceCategoryId?: string | null
  reviewsPolicy?: ProductReviewsPolicy
  reviewsEnabled?: boolean
  isActive: boolean
  preparationMode?: "kitchen" | "direct" | "bar"
}

export type Category = {
  id: string
  name: string
  marketplaceCategoryId?: string | null
  reviewsEnabled?: boolean
  displayOrder?: number
  order?: number
  isActive?: boolean
}

export type RestaurantBusinessHours = RestaurantOpeningHours

export type OrderStatus = CanonicalOrderStatus

export type OrderSource = "client" | "qr" | "qr_table" | "manual" | "pos" | "delivery"

export type OrderItem = {
  id?: string
  productId: string
  name: string
  status?: OrderItemStatus | string | null
  createdAt?: Timestamp | Date | null
  unitPrice: number
  quantity: number
  total: number
  selectedOptions?: SelectedCartOption[]
  preparationMode?: "kitchen" | "direct" | "bar"
  reviewsEnabled?: boolean
}

export type RestaurantOrder = {
  id: string
  restaurantId: string

  source: OrderSource
  status: OrderStatus
  kitchenStatus?: KitchenLifecycleStatus | string | null
  orderStatus?: OrderOperationStatus | string | null

  // 🔥 TYPE COMMANDE
  orderType: "dine_in" | "takeaway" | "pickup" | "delivery"

  sessionId?: string
  tableId?: string | null
  zoneId?: string | null

  customer?: {
    name?: string | null
    phone?: string | null
  }

  table?: string | null

  // 🔥 LIVRAISON
  deliveryAddress?: {
    street: string
    city?: string
    zone?: string
    label?: string
  } | null

  deliveryNote?: string | null
  deliveryFee?: number

  // 🔥 LIVRAISON
  items: OrderItem[]

  subtotal?: number
  total: number

  // 🔥 PAIEMENT
  paymentMethod?: PaymentMethod | "cash" | "mobile_money" | string | null
  paymentIntentStatus?: "none" | "pending" | "submitted" | "verified" | null
  paymentStatus?: PaymentStatus | OrderPaymentLifecycleStatus | "validated" | "pending" | "pending_cash" | "pending_mobile" | "unpaid" | "failed" | "verified" | "paye" | null
  paymentType?: "cash" | "mobile" | "mobile_money" | "offline" | null

  paidAt?: Timestamp | null
  sessionActive?: boolean
  closedAt?: Timestamp | null

  createdAt: Timestamp
  updatedAt?: Timestamp
}

export type CartSelection = Record<string, number[]>

export type SelectedCartOption = {
  optionName: string
  choiceName: string
  price: number
}

export type CartItem = {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  total: number
  selections?: CartSelection
  selectedOptions?: SelectedCartOption[]
  imageUrl?: string
  preparationMode?: "kitchen" | "direct" | "bar"
  categoryName?: string
  reviewsEnabled?: boolean
  bundleId?: string
  isBundleMain?: boolean
  linkedGroupTitle?: string
  instructions?: string
  note?: string
  notes?: string
  specialInstructions?: string
}

// types.ts - AJOUTE À LA FIN
export type KitchenStatus = OrderStatus

export type TableSessionPaymentRequest = {
  status: "none" | "requested" | "processing" | "pending_confirmation" | "validated" | "rejected"
  method?: "cash" | "mobile"
  provider?: string
  requestedAt?: any
  handledAt?: any
  handledBy?: string
}
