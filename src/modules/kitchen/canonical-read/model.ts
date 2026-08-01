export const ACTIVE_KITCHEN_ITEM_STATUSES = ["pending", "preparing", "ready"] as const
export type ActiveKitchenItemStatus = (typeof ACTIVE_KITCHEN_ITEM_STATUSES)[number]

export interface KitchenParentContext {
  restaurantId: string
  orderId: string
  orderType: string
  serviceMode: string
  paymentStatus: string
  tableId: string | null
  tableNumber: string | null
  orderNumber: string
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | Record<string, unknown> | null
  orderNote: string | null
  createdAt: number
  canonicalItemCount: number
  canonicalProjectionCount: number | null
  preparationModes: ReadonlySet<string>
}

export interface KitchenOrderItemView {
  restaurantId: string
  orderId: string
  orderItemId: string
  productId: string
  productName: string
  productImageUrl: string | null
  quantity: number
  activeQuantity: number
  cancelledQuantity: number
  servedQuantity: number
  status: ActiveKitchenItemStatus
  version: number
  preparationMode: "kitchen"
  variants: readonly unknown[]
  supplements: readonly unknown[]
  customerNote: string | null
  orderType: string
  serviceMode: string
  paymentStatus: string
  tableId: string | null
  tableNumber: string | null
  orderNumber: string
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | Record<string, unknown> | null
  orderNote: string | null
  createdAt: number
  updatedAt: number
  elapsedTime: number
  legacyState: "canonical" | "legacy_read_only" | "canonical_inconsistent"
  actionsAllowed: boolean
}

export interface KitchenOrderGroup {
  orderId: string
  restaurantId: string
  orderType: string
  serviceMode: string
  paymentStatus: string
  tableId: string | null
  tableNumber: string | null
  orderNumber: string
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | Record<string, unknown> | null
  orderNote: string | null
  createdAt: number
  isMixed: boolean
  legacyState: KitchenOrderItemView["legacyState"]
  items: KitchenOrderItemView[]
}

export interface RawCanonicalKitchenItem {
  id: string
  data: Record<string, unknown>
}

export interface CanonicalKitchenReadState {
  items: KitchenOrderItemView[]
  groups: KitchenOrderGroup[]
  columns: Record<ActiveKitchenItemStatus, KitchenOrderGroup[]>
  counters: Record<ActiveKitchenItemStatus, number>
  isLoading: boolean
  isSaturated: boolean
  invalidDocumentCount: number
  error: Error | null
}
