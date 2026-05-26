export const KITCHEN_STATUS = {
  EN_ATTENTE: "en_attente",
  EN_PREPARATION: "en_preparation",
  PRETE: "pretes",
  SERVIE: "servies",
} as const

export const ORDER_PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PENDING_CASH: "pending_cash",
  PENDING_MOBILE: "pending_mobile",
  PAID: "paid",
  FAILED: "failed",
  PENDING: "pending",
  VERIFIED: "verified",
  NON_PAYE: "non_paye",
  PAYE: "paye",
} as const

export const ORDER_OPERATION_STATUS = {
  PENDING: "pending",
  IN_PREPARATION: "preparing",
  READY: "ready",
  SERVED: "served",
  PICKED_UP: "picked_up",
  COMPLETED: "completed",
} as const

export const ORDER_ITEM_STATUS = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
} as const

export type KitchenLifecycleStatus =
  (typeof KITCHEN_STATUS)[keyof typeof KITCHEN_STATUS]

export type OrderPaymentLifecycleStatus =
  (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS]

export type OrderOperationStatus =
  (typeof ORDER_OPERATION_STATUS)[keyof typeof ORDER_OPERATION_STATUS]

export type OrderItemStatus =
  (typeof ORDER_ITEM_STATUS)[keyof typeof ORDER_ITEM_STATUS]

export type OrderLike = {
  kitchenStatus?: string | null
  status?: string | null
  orderStatus?: string | null
  paymentStatus?: string | null
  orderType?: string | null
  sessionActive?: boolean | null
  statusHistory?: Array<{
    status?: string | null
    at?: unknown
    source?: string | null
  }> | null
  items?: Array<{
    status?: string | null
    itemStatus?: string | null
    servedAt?: unknown
  }> | null
}

export function normalizeOrderType(type: string | null | undefined) {
  if (type === "dine-in" || type === "table") return "dine_in"
  if (type === "takeaway") return "pickup"
  if (type === "delivery") return "delivery"
  if (type === "pickup") return "pickup"
  return "dine_in"
}

export function getKitchenStatus(order: OrderLike): KitchenLifecycleStatus {
  return normalizeKitchenStatus(order.kitchenStatus ?? order.status ?? order.orderStatus)
}

export function getPaymentStatus(order: OrderLike): OrderPaymentLifecycleStatus {
  const normalized = normalizePaymentStatus(order.paymentStatus)
  if (normalized === ORDER_PAYMENT_STATUS.PAID) {
    return ORDER_PAYMENT_STATUS.PAID
  }

  return normalized
}

export function isOrderPaid(order: OrderLike) {
  return getPaymentStatus(order) === ORDER_PAYMENT_STATUS.PAID
}

export function normalizePaymentStatus(status: string | null | undefined): OrderPaymentLifecycleStatus {
  switch (status) {
    case ORDER_PAYMENT_STATUS.PAID:
    case ORDER_PAYMENT_STATUS.VERIFIED:
    case ORDER_PAYMENT_STATUS.PAYE:
    case "validated":
      return ORDER_PAYMENT_STATUS.PAID
    case ORDER_PAYMENT_STATUS.PENDING_CASH:
      return ORDER_PAYMENT_STATUS.PENDING_CASH
    case ORDER_PAYMENT_STATUS.PENDING_MOBILE:
    case ORDER_PAYMENT_STATUS.PENDING:
    case "pending_verification":
      return ORDER_PAYMENT_STATUS.PENDING_MOBILE
    case ORDER_PAYMENT_STATUS.FAILED:
      return ORDER_PAYMENT_STATUS.FAILED
    case ORDER_PAYMENT_STATUS.UNPAID:
    case ORDER_PAYMENT_STATUS.NON_PAYE:
    default:
      return ORDER_PAYMENT_STATUS.UNPAID
  }
}

export function isOrderServed(order: OrderLike) {
  return getKitchenStatus(order) === KITCHEN_STATUS.SERVIE
}

export function getKitchenServedEventCount(order: OrderLike) {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : []
  const servedEvents = history.filter((event) => normalizeKitchenServedEventStatus(event?.status)).length

  if (servedEvents > 0) return servedEvents

  return isOrderServed(order) ? 1 : 0
}

export function getKitchenServedAnalyticsCount(orders: OrderLike[]) {
  return orders.reduce((total, order) => total + getKitchenServedEventCount(order), 0)
}

export function toKitchenServedEventStatus(status: string | null | undefined) {
  const normalized = normalizeOperationStatus(status)
  if (
    normalized === ORDER_OPERATION_STATUS.SERVED ||
    normalized === ORDER_OPERATION_STATUS.PICKED_UP ||
    normalized === ORDER_OPERATION_STATUS.COMPLETED
  ) {
    return ORDER_OPERATION_STATUS.SERVED
  }

  return normalized
}

function normalizeKitchenServedEventStatus(status: string | null | undefined) {
  return (
    status === ORDER_OPERATION_STATUS.SERVED ||
    status === ORDER_OPERATION_STATUS.PICKED_UP ||
    status === ORDER_OPERATION_STATUS.COMPLETED ||
    status === "servie" ||
    status === "servies" ||
    status === "terminated"
  )
}

export function normalizeKitchenStatus(
  status: string | null | undefined
): KitchenLifecycleStatus {
  switch (status) {
    case KITCHEN_STATUS.EN_ATTENTE:
    case "pending":
    case "en_attente":
      return KITCHEN_STATUS.EN_ATTENTE
    case KITCHEN_STATUS.EN_PREPARATION:
    case "preparing":
    case "preparation":
      return KITCHEN_STATUS.EN_PREPARATION
    case KITCHEN_STATUS.PRETE:
    case "prete":
    case "ready":
      return KITCHEN_STATUS.PRETE
    case KITCHEN_STATUS.SERVIE:
    case "servie":
    case "served":
    case "picked_up":
    case "terminee":
    case "completed":
      return KITCHEN_STATUS.SERVIE
    default:
      return KITCHEN_STATUS.EN_ATTENTE
  }
}

export function getOrderStatus(order: OrderLike): OrderOperationStatus {
  return orderStatusFromKitchenStatus(order.kitchenStatus ?? order.status ?? order.orderStatus)
}

export function getOrderItemStatuses(order: OrderLike): OrderItemStatus[] {
  return (order.items || [])
    .map((item) => normalizeOrderItemStatus(item.status ?? item.itemStatus ?? order.kitchenStatus ?? order.status ?? order.orderStatus))
    .filter((status): status is OrderItemStatus => Boolean(status))
}

export function normalizeOrderItemStatus(status: string | null | undefined): OrderItemStatus {
  if (status === ORDER_OPERATION_STATUS.IN_PREPARATION || status === "in_preparation" || status === "preparation" || status === "en_preparation") {
    return ORDER_ITEM_STATUS.PREPARING
  }

  if (status === ORDER_OPERATION_STATUS.READY || status === "prete" || status === "pretes") {
    return ORDER_ITEM_STATUS.READY
  }

  if (
    status === ORDER_OPERATION_STATUS.SERVED ||
    status === ORDER_OPERATION_STATUS.PICKED_UP ||
    status === ORDER_OPERATION_STATUS.COMPLETED ||
    status === "servie" ||
    status === "servies"
  ) {
    return ORDER_ITEM_STATUS.SERVED
  }

  return ORDER_ITEM_STATUS.PENDING
}

export function operationStatusFromItemStatus(status: OrderItemStatus): OrderOperationStatus {
  if (status === ORDER_ITEM_STATUS.PREPARING) return ORDER_OPERATION_STATUS.IN_PREPARATION
  if (status === ORDER_ITEM_STATUS.READY) return ORDER_OPERATION_STATUS.READY
  if (status === ORDER_ITEM_STATUS.SERVED) return ORDER_OPERATION_STATUS.SERVED
  return ORDER_OPERATION_STATUS.PENDING
}

export function itemStatusFromOperationStatus(status: string | null | undefined): OrderItemStatus {
  const normalized = normalizeOperationStatus(status)

  if (normalized === ORDER_OPERATION_STATUS.IN_PREPARATION) return ORDER_ITEM_STATUS.PREPARING
  if (normalized === ORDER_OPERATION_STATUS.READY) return ORDER_ITEM_STATUS.READY
  if (
    normalized === ORDER_OPERATION_STATUS.SERVED ||
    normalized === ORDER_OPERATION_STATUS.PICKED_UP ||
    normalized === ORDER_OPERATION_STATUS.COMPLETED
  ) {
    return ORDER_ITEM_STATUS.SERVED
  }

  return ORDER_ITEM_STATUS.PENDING
}

export function normalizeOperationStatus(
  status: string | null | undefined
): OrderOperationStatus {
  switch (status) {
    case ORDER_OPERATION_STATUS.PENDING:
      return ORDER_OPERATION_STATUS.PENDING
    case ORDER_OPERATION_STATUS.IN_PREPARATION:
      return ORDER_OPERATION_STATUS.IN_PREPARATION
    case ORDER_OPERATION_STATUS.READY:
      return ORDER_OPERATION_STATUS.READY
    case ORDER_OPERATION_STATUS.SERVED:
      return ORDER_OPERATION_STATUS.SERVED
    case ORDER_OPERATION_STATUS.PICKED_UP:
      return ORDER_OPERATION_STATUS.PICKED_UP
    case ORDER_OPERATION_STATUS.COMPLETED:
      return ORDER_OPERATION_STATUS.COMPLETED
    default:
      return ORDER_OPERATION_STATUS.PENDING
  }
}

export function orderStatusFromKitchenStatus(status: string | null | undefined): OrderOperationStatus {
  const kitchenStatus = normalizeKitchenStatus(status)

  if (kitchenStatus === KITCHEN_STATUS.EN_ATTENTE) return ORDER_OPERATION_STATUS.PENDING
  if (kitchenStatus === KITCHEN_STATUS.EN_PREPARATION) return ORDER_OPERATION_STATUS.IN_PREPARATION
  if (kitchenStatus === KITCHEN_STATUS.PRETE) return ORDER_OPERATION_STATUS.READY
  return ORDER_OPERATION_STATUS.SERVED
}

export function kitchenStatusFromOrderStatus(status: string | null | undefined): KitchenLifecycleStatus {
  const orderStatus = normalizeOperationStatus(status)

  if (orderStatus === ORDER_OPERATION_STATUS.PENDING) return KITCHEN_STATUS.EN_ATTENTE
  if (orderStatus === ORDER_OPERATION_STATUS.IN_PREPARATION) return KITCHEN_STATUS.EN_PREPARATION
  if (orderStatus === ORDER_OPERATION_STATUS.READY) return KITCHEN_STATUS.PRETE
  return KITCHEN_STATUS.SERVIE
}

export function nextOrderStatus(
  status: string | null | undefined,
  orderType: string | null | undefined
): OrderOperationStatus | null {
  const current = normalizeOperationStatus(status)
  const normalizedType = normalizeOrderType(orderType)

  if (current === ORDER_OPERATION_STATUS.PENDING) return ORDER_OPERATION_STATUS.IN_PREPARATION
  if (current === ORDER_OPERATION_STATUS.IN_PREPARATION) return ORDER_OPERATION_STATUS.READY
  if (current === ORDER_OPERATION_STATUS.READY) {
    if (normalizedType === "pickup") return ORDER_OPERATION_STATUS.PICKED_UP
    if (normalizedType === "delivery") return ORDER_OPERATION_STATUS.PICKED_UP
    return ORDER_OPERATION_STATUS.SERVED
  }

  return null
}

export function legacyStatusFromKitchenStatus(status: KitchenLifecycleStatus) {
  return orderStatusFromKitchenStatus(status)
}

export function nextKitchenStatus(
  status: string | null | undefined
): KitchenLifecycleStatus | null {
  const current = normalizeKitchenStatus(status)

  if (current === KITCHEN_STATUS.EN_ATTENTE) return KITCHEN_STATUS.EN_PREPARATION
  if (current === KITCHEN_STATUS.EN_PREPARATION) return KITCHEN_STATUS.PRETE
  if (current === KITCHEN_STATUS.PRETE) return KITCHEN_STATUS.SERVIE

  return null
}

export function kitchenStatusLabel(status: string | null | undefined) {
  const current = normalizeKitchenStatus(status)

  if (current === KITCHEN_STATUS.EN_ATTENTE) return "En attente"
  if (current === KITCHEN_STATUS.EN_PREPARATION) return "En preparation"
  if (current === KITCHEN_STATUS.PRETE) return "Prete"
  return "Servie"
}

export function getLegacyNormalizedOrderStatus(order: OrderLike) {
  return getOrderStatus(order)
}
