import type { Timestamp } from "firebase/firestore"
import type {
  KitchenLifecycleStatus,
  OrderItemStatus,
  OrderPaymentLifecycleStatus,
} from "@/lib/order-lifecycle"
import type { ProductReviewsPolicy } from "@/lib/product-review-policy"
import { ORDER_SOURCE, ORDER_STATUS, ORDER_TYPE, POS_SESSION_STATUS, RESTAURANT_ROLES, SUBSCRIPTION_STATUS } from "@/lib/constants"

export type RestaurantStatus = "pending" | "active" | "suspended"
export type RestaurantSource = "request" | "admin"
export type RequestStatus = "pending" | "approved" | "rejected"
export type RestaurantPlan = "trial" | "basic" | "pro" | "custom" | "business"
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS]
export type AppUserRole = "super_admin" | "owner" | "staff"
export type AuditAction = "CREATE_RESTAURANT" | "APPROVE_REQUEST" | "SET_SUPER_ADMIN"
export type RestaurantUserRole = typeof RESTAURANT_ROLES[keyof typeof RESTAURANT_ROLES]
export type AppRouteRole = "super_admin" | RestaurantUserRole
export type FeatureModule = "kitchen" | "inventory" | "analytics" | "multiBranch"
export type PosSessionStatus = typeof POS_SESSION_STATUS[keyof typeof POS_SESSION_STATUS]
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]
export type OrderSource = typeof ORDER_SOURCE[keyof typeof ORDER_SOURCE]
export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE]

export interface Restaurant {
  id: string
  name: string
  slug: string
  email: string
  phone?: string
  country: string
  countryCode: string
  city?: string
  currency: string
  status: RestaurantStatus
  source: RestaurantSource
  createdAt: Timestamp
}

export interface RestaurantRequest {
  id: string
  restaurantName: string
  email: string
  country: string
  status: RequestStatus
  processed?: boolean
  restaurantId?: string
  processedAt?: Timestamp
  createdAt: Timestamp
}

export interface Subscription {
  id: string
  restaurantId: string
  plan: RestaurantPlan
  status: SubscriptionStatus
  billingStatus?: "paid" | "unpaid" | "manual"
  trialEndsAt?: Timestamp
  currentPeriodStart?: Timestamp
  currentPeriodEnd?: Timestamp
  graceEndsAt?: Timestamp
  isManual: boolean
  createdAt: Timestamp
}

export interface AppUser {
  id: string
  restaurantId?: string
  email: string
  role: AppUserRole
  invited?: boolean
  invitedAt?: Timestamp
  createdAt: Timestamp
}

export interface Country {
  id?: string
  code: string
  name: string
  currency: string
  phoneCode: string
  isActive: boolean
}

export interface AuditLog {
  action: AuditAction
  actorId: string
  targetId: string
  metadata?: Record<string, unknown>
  createdAt: Timestamp
}

export interface ErrorLog {
  message: string
  stack?: string
  context?: Record<string, unknown>
  createdAt: Timestamp
}

export interface PlatformSettings {
  name: string
  logoUrl: string
  faviconUrl: string
  marketplaceHero: PlatformMarketplaceHero
  primaryColor: string
  secondaryColor: string
  supportEmail: string
  supportPhone: string
  supportWhatsapp: string
  maintenanceMode: boolean
  defaultGraceDays: number
  publicFooter: PlatformPublicFooter
  updatedAt?: Timestamp
}

export interface PlatformMarketplaceHero {
  coverImageUrl: string
}

export interface PlatformPublicFooter {
  description: string
  phone: string
  whatsapp: string
  email: string
  officeAddress: string
  socialLinks: {
    facebook: string
    instagram: string
    tiktok: string
    linkedin: string
    youtube: string
    twitter: string
  }
  legalLinks: {
    privacy: string
    terms: string
    legalNotice: string
  }
}

export interface Company {
  id: string
  name: string
  createdAt: Timestamp
}

export interface SubscriptionModules {
  kitchen: boolean
  inventory: boolean
  analytics: boolean
  multiBranch: boolean
}

export interface CompanySubscription {
  plan: "basic" | "pro" | "business"
  status: "trial" | "active" | "grace" | "suspended" | "lifetime"
  currentPeriodEnd: Timestamp
  graceEndsAt?: Timestamp
  modules: SubscriptionModules
}

export interface RestaurantUser {
  id: string
  name: string
  phone: string
  email?: string
  roles: RestaurantUserRole[]
  activeRole: RestaurantUserRole
  pinCode?: string
  isActive: boolean
  createdAt: Timestamp
}

export interface CurrentUserContextValue {
  user: import("firebase/auth").User | null
  firebaseUser: import("firebase/auth").User | null
  isLoading: boolean
  isAuthenticated: boolean
  isSuperAdmin: boolean
  companyId: string | null
  restaurantId: string | null
  staffUser: RestaurantUser | null
  roles: RestaurantUserRole[]
  activeRole: RestaurantUserRole | null
  subscription: CompanySubscription | null
  modules: SubscriptionModules
  setActiveRole: (role: RestaurantUserRole) => Promise<void>
}

export interface Product {
  id: string
  name: string
  price: number
  imageUrl?: string
  categoryId?: string
  reviewsPolicy?: ProductReviewsPolicy
  reviewsEnabled?: boolean
  available?: boolean
}

export interface OrderItemSnapshot {
  id?: string
  productId: string
  status?: OrderItemStatus | string | null
  createdAt?: Timestamp | Date | null
  name: string
  price: number
  nameSnapshot: string
  priceSnapshot: number
  quantity: number
  reviewsEnabled?: boolean
  variants?: {
    name: string
    value: string
  }[]
}

export interface OrderLocation {
  tableNumber?: string
  roomNumber?: string
  address?: string
  note?: string
}

export interface RestaurantOrder {
  id: string
  companyId: string
  restaurantId?: string
  sessionId?: string
  zoneId?: string | null
  type: OrderType
  source: OrderSource
  location?: OrderLocation
  tableNumber?: string
  roomNumber?: string
  customerName?: string
  customerPhone?: string
  tableId?: string | null
  roomId?: string | null
  deliveryAddress?: string | null
  items: OrderItemSnapshot[]
  total: number
  totalAmount?: number
  status: "nouvelle" | "preparation" | "prete" | "servie" | "payee"
  kitchenStatus?: KitchenLifecycleStatus | null
  paymentStatus?: "pending" | "validated" | OrderPaymentLifecycleStatus | null
  paymentMethod?: "cash" | "mobile" | null
  createdAt: Timestamp
  updatedAt?: Timestamp
  pendingAt?: Timestamp
  preparingAt?: Timestamp
  readyAt?: Timestamp
  servedAt?: Timestamp
  paidAt?: Timestamp | null
}

export interface RestaurantTable {
  id: string
  name: string
  zoneId: string
  status: "free" | "occupied"
  currentSessionId: string | null
  createdAt: Timestamp
  updatedAt?: Timestamp
  lastActivityAt?: Timestamp | null
}

export interface RestaurantTableSession {
  id: string
  tableId: string
  zoneId: string
  startedAt: Timestamp
  lastActivityAt?: Timestamp
  closedAt: Timestamp | null
  status: "active" | "closed"
}

export interface PosSession {
  id: string
  cashierId: string
  openedAt: Timestamp
  closedAt?: Timestamp
  totalAmount: number
  status: PosSessionStatus
}

export interface TableSession extends RestaurantTableSession {}
