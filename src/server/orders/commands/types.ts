export const ORDER_COMMAND_NAMES = [
  "MarkOrderItemPreparing",
  "MarkOrderItemReady",
  "MarkOrderItemServed",
  "CancelOrderItemQuantity",
  "ConfirmOrderPayment",
] as const

export type OrderCommandName = (typeof ORDER_COMMAND_NAMES)[number]
export type OrderItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled"
export type PreparationMode = "kitchen" | "bar" | "direct"
export type ActorRole = "kitchen" | "cashier" | "server" | "manager" | "owner" | "system"
export type SourceChannel = "kitchen" | "pos" | "manager" | "owner" | "system"

export interface OrderCommandActor {
  id: string
  role: ActorRole
  restaurantId: string
}

export interface OrderCommandBase {
  restaurantId: string
  orderId: string
  actor: OrderCommandActor
  sourceChannel: SourceChannel
  idempotencyKey: string
}

export interface ItemCommandBase extends OrderCommandBase {
  orderItemId: string
  expectedVersion: number
}

export interface MarkOrderItemPreparingInput extends ItemCommandBase {}
export interface MarkOrderItemReadyInput extends ItemCommandBase {}

export interface MarkOrderItemServedInput extends ItemCommandBase {
  quantityToServe: number
}

export interface CancelOrderItemQuantityInput extends ItemCommandBase {
  quantityToCancel: number
  reason: string | null
}

export interface ConfirmOrderPaymentInput extends OrderCommandBase {
  expectedPaymentVersion: number
  expectedAmount: number
  receivedAmount: number
  method: "cash" | "mobile_money"
  provider: string | null
  externalReference: string | null
  cashSessionId: string
}

export type AnyOrderCommandInput =
  | MarkOrderItemPreparingInput
  | MarkOrderItemReadyInput
  | MarkOrderItemServedInput
  | CancelOrderItemQuantityInput
  | ConfirmOrderPaymentInput

export interface OrderSnapshot {
  id: string
  restaurantId: string
  paymentStatus: string
  paymentVersion: number
  totalAmount: number
  total: number
  hasUnaggregatedCancellation: boolean
  orderStatus: string
  kitchenStatus: string
  aggregateVersion: number
  orderAggregate: Record<string, unknown> | null
  embeddedItems: Array<Record<string, unknown>> | null
  canonicalItemCount: number
}

export interface OrderItemSnapshot {
  id: string
  orderId: string
  restaurantId: string
  productId: string
  preparationMode: PreparationMode
  status: OrderItemStatus
  quantity: number
  servedQuantity: number
  cancelledQuantity: number
  version: number
}

export interface OrderCommandState {
  order: OrderSnapshot
  item: OrderItemSnapshot | null
  items: OrderItemSnapshot[]
}

export interface StockDeductionPlan {
  orderItemId: string
  productId: string
  servedQuantityBefore: number
  servedQuantityAfter: number
}

export interface CommandMutationPlan {
  commandName: OrderCommandName
  orderUpdate: Record<string, unknown> | null
  itemUpdate: Record<string, unknown> | null
  paymentLedger: {
    amount: number
    receivedAmount: number
    changeDue: number
    method: "cash" | "mobile_money"
    provider: string | null
    externalReference: string | null
    cashSessionId: string
  } | null
  stock: StockDeductionPlan | null
  before: Record<string, unknown>
  after: Record<string, unknown>
  result: Record<string, unknown>
}

export interface CanonicalCommandResult {
  ok: true
  commandName: OrderCommandName
  orderId: string
  orderItemId: string | null
  status: "APPLIED"
  version: number
  replayed: boolean
  warning?: string
  stock?: {
    operationId?: string
    previousQuantity?: number
    deductedQuantity: number
    newQuantity?: number
  }
  paymentId?: string
}

export interface AtomicOrderCommandPort {
  execute(
    commandName: OrderCommandName,
    input: AnyOrderCommandInput,
    transition: (state: OrderCommandState) => CommandMutationPlan
  ): Promise<CanonicalCommandResult>
}
