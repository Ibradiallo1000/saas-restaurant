export const CREATE_ORDER_CHANNELS = [
  "pos",
  "qr_table",
  "public_takeaway",
  "public_delivery",
] as const

export const CREATE_ORDER_SERVICE_MODES = ["dine_in", "takeaway", "delivery"] as const
export const PREPARATION_MODES = ["kitchen", "bar", "direct"] as const

export type CreateOrderChannel = (typeof CREATE_ORDER_CHANNELS)[number]
export type CreateOrderServiceMode = (typeof CREATE_ORDER_SERVICE_MODES)[number]
export type PreparationMode = (typeof PREPARATION_MODES)[number]
export type OperationalAvailabilityState = "AVAILABLE" | "SOLD_OUT" | "PAUSED"

export interface CreateOrderOptionInput {
  optionName: string
  choiceName: string
}

export interface CreateOrderLineInput {
  clientLineId: string
  productId: string
  quantity: number
  options: CreateOrderOptionInput[]
  instructions: string | null
}

export interface CreateOrderRequest {
  schemaVersion: 1
  channel: CreateOrderChannel
  serviceMode: CreateOrderServiceMode
  clientRequestId: string
  items: CreateOrderLineInput[]
  tableContext: {
    tableId: string
    tableSessionId: string
    capability: string | null
  } | null
  customer: {
    name: string | null
    phone: string | null
  } | null
  delivery: {
    address: string
    zoneId: string | null
    instructions: string | null
  } | null
  cashSessionId: string | null
  notes: string | null
}

export interface OrderPrincipal {
  kind: "staff" | "public"
  uid: string
  roles: string[]
}

export interface ProductOptionAuthority {
  name: string
  required: boolean
  choices: Array<{ name: string; price: number; active: boolean }>
}

export interface ProductAuthority {
  id: string
  name: string
  price: number
  active: boolean
  operationalAvailabilityState?: OperationalAvailabilityState
  categoryId: string | null
  preparationMode: PreparationMode | null
  options: ProductOptionAuthority[]
  reviewsEnabled: boolean
  portionControl?: { enabled: boolean; available: number | null }
}

export interface CategoryAuthority {
  id: string
  name: string
  active: boolean
  preparationMode: PreparationMode | null
}

export interface RestaurantAuthority {
  id: string
  name: string
  active: boolean
  currency: string
  taxRate: number
  pricesIncludeTax: boolean
  deliveryFee: number
  publicOrderingOpen: boolean
}

export interface TableSessionAuthority {
  id: string
  tableId: string
  tableName: string | null
  zoneId: string | null
  active: boolean
}

export interface OrderCreationAuthorities {
  restaurant: RestaurantAuthority
  products: Map<string, ProductAuthority>
  categories: Map<string, CategoryAuthority>
  tableSession: TableSessionAuthority | null
}

export interface CanonicalOrderItem {
  id: string
  orderItemId: string
  orderId: string
  restaurantId: string
  productId: string
  clientLineId: string
  name: string
  nameSnapshot: string
  unitPrice: number
  priceSnapshot: number
  quantity: number
  cancelledQuantity: number
  servedQuantity: number
  subtotal: number
  total: number
  selectedOptions: Array<{
    optionName: string
    choiceName: string
    price: number
  }>
  instructions: string | null
  preparationMode: PreparationMode
  status: "pending" | "ready"
  reviewsEnabled: boolean
  portionReserved: boolean
  schemaVersion: 1
  createdAt: Date
  updatedAt: Date
}

export interface CanonicalOrderParent {
  restaurantId: string
  source: CreateOrderChannel
  channel: CreateOrderChannel
  type: "table" | "takeaway" | "delivery"
  orderType: CreateOrderServiceMode
  serviceMode: CreateOrderServiceMode
  tableId: string | null
  table: string | null
  zoneId: string | null
  sessionId: string | null
  tableSessionId: string | null
  cashSessionId: string | null
  customerName: string
  customerPhone: string | null
  customer: { name: string | null; phone: string | null }
  deliveryAddress: string | null
  deliveryZoneId: string | null
  deliveryNote: string | null
  notes: string | null
  kitchenStatus: "pending" | "ready"
  orderStatus: "pending" | "ready"
  statusHistory: Array<{ status: "pending" | "ready"; at: Date; source: "order" }>
  sessionActive: boolean
  paymentMethod: null
  paymentType: null
  paymentIntentStatus: "none"
  paymentStatus: "unpaid"
  paymentCode: null
  paidAt: null
  subtotal: number
  taxAmount: number
  discountAmount: 0
  deliveryFee: number
  tipAmount: 0
  totalAmount: number
  total: number
  items: CanonicalOrderItem[]
  canonicalItemCount: number
  aggregateVersion: 1
  createdBy: string
  schemaVersion: 1
  displayId: string
  createdAt: Date
  updatedAt: Date
}

export interface CanonicalOrderPlan {
  orderId: string
  displayId: string
  parent: CanonicalOrderParent
  items: CanonicalOrderItem[]
}

export interface CreateCanonicalOrderResult {
  ok: true
  orderId: string
  displayId: string
  schemaVersion: 1
  channel: CreateOrderChannel
  serviceMode: CreateOrderServiceMode
  orderStatus: "pending" | "ready"
  paymentStatus: "unpaid"
  total: number
  currency: string
  orderItemIds: string[]
  idempotencyKey: string
  replayed: boolean
  createdAt: string
}

export interface AtomicCreateInput {
  restaurantId: string
  request: CreateOrderRequest
  principal: OrderPrincipal
  idempotencyKey: string
  requestHash: string
}

export interface AtomicOrderCreationPort {
  create(
    input: AtomicCreateInput,
    build: (context: {
      authorities: OrderCreationAuthorities
      orderId: string
      orderItemIds: string[]
      now: Date
    }) => CanonicalOrderPlan
  ): Promise<CreateCanonicalOrderResult>
}
