export const ORDER_STATUSES = [
  "nouvelle",
  "preparation",
  "prete",
  "servie",
  "payee",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type LegacyOrderStatus =
  | OrderStatus
  | "pending"
  | "en_attente"
  | "preparing"
  | "en_preparation"
  | "ready"
  | "served"
  | "terminee"
  | "paid"
  | "cancelled"
  | string

const ORDER_STATUS_INDEX = new Map<OrderStatus, number>(
  ORDER_STATUSES.map((status, index) => [status, index])
)

export function normalizeOrderStatus(status: LegacyOrderStatus | null | undefined): OrderStatus {
  switch (status) {
    case "nouvelle":
    case "pending":
    case "en_attente":
    case "cancelled":
      return "nouvelle"
    case "preparation":
    case "preparing":
    case "en_preparation":
      return "preparation"
    case "prete":
    case "ready":
      return "prete"
    case "servie":
    case "served":
    case "terminee":
      return "servie"
    case "payee":
    case "paid":
      return "payee"
    default:
      return "nouvelle"
  }
}

export function canTransition(fromStatus: LegacyOrderStatus, toStatus: LegacyOrderStatus) {
  const from = normalizeOrderStatus(fromStatus)
  const to = normalizeOrderStatus(toStatus)

  return ORDER_STATUS_INDEX.get(to) === (ORDER_STATUS_INDEX.get(from) ?? -1) + 1
}

export function orderStatusLabel(status: LegacyOrderStatus | null | undefined) {
  switch (normalizeOrderStatus(status)) {
    case "nouvelle":
      return "Nouvelle"
    case "preparation":
      return "Préparation"
    case "prete":
      return "Prête"
    case "servie":
      return "Servie"
    case "payee":
      return "Payée"
  }
}

export function nextOrderStatus(status: LegacyOrderStatus | null | undefined): OrderStatus | null {
  const current = normalizeOrderStatus(status)
  const index = ORDER_STATUS_INDEX.get(current) ?? -1

  return ORDER_STATUSES[index + 1] ?? null
}
