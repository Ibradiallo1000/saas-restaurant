import type { User } from "firebase/auth"

export type PosCanonicalCommand =
  | "MARK_ORDER_ITEM_SERVED"
  | "SERVE_ORDER_ITEMS"
  | "HAND_OFF_ORDER_ITEMS"
  | "CANCEL_ORDER_ITEM_QUANTITY"
  | "CONFIRM_ORDER_PAYMENT"

export class PosCommandClientError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly fieldErrors: Record<string, string> | null

  constructor(
    code: string,
    message: string,
    retryable = false,
    fieldErrors: Record<string, string> | null = null
  ) {
    super(message)
    this.name = "PosCommandClientError"
    this.code = code
    this.retryable = retryable
    this.fieldErrors = fieldErrors
  }
}

export async function executePosCommand(input: {
  user: User
  restaurantId: string
  orderId: string
  command: PosCanonicalCommand
  payload: Record<string, unknown>
}) {
  const token = await input.user.getIdToken()
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}/commands`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ command: input.command, ...input.payload }),
    }
  )
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) {
    throw new PosCommandClientError(
      body?.error?.code ?? "NETWORK_ERROR",
      body?.error?.message ?? "La commande POS a échoué.",
      body?.error?.retryable === true
    )
  }
  return body.result
}

export function posCommandIdempotencyKey(parts: readonly unknown[]) {
  return parts
    .map((part) => String(part ?? "").trim().replace(/[^A-Za-z0-9_-]+/g, "-"))
    .filter(Boolean)
    .join("-")
    .slice(0, 128)
}

export function getCanonicalPaymentAmount(order: {
  totalAmount?: unknown
  total?: unknown
  items?: unknown
}) {
  for (const value of [order.totalAmount, order.total]) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  if (!Array.isArray(order.items)) return 0
  return order.items.reduce(
    (sum: number, item: any) =>
      sum +
      Number(item.priceSnapshot ?? item.price ?? item.unitPrice ?? 0) *
        Number(item.quantity ?? 1),
    0
  )
}

export function getCanonicalMobileMoneyProvider(
  order: {
    paymentMethodCode?: unknown
    paymentProvider?: unknown
    paymentRequest?: { provider?: unknown } | null
  },
  selectedProvider?: unknown
) {
  for (const value of [
    order.paymentMethodCode,
    order.paymentProvider,
    order.paymentRequest?.provider,
    selectedProvider,
  ]) {
    if (typeof value === "string" && value.trim() && value !== "mobile_money") {
      return value.trim()
    }
  }
  return null
}

export async function createCanonicalPosOrder(input: {
  user: User
  restaurantId: string
  idempotencyKey: string
  body: Record<string, unknown>
}) {
  const token = await input.user.getIdToken()
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify(input.body),
    }
  )
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) {
    const fieldErrors = isFieldErrors(body?.fieldErrors) ? body.fieldErrors : null
    const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0] : null
    throw new PosCommandClientError(
      body?.code ?? "ORDER_CREATE_FAILED",
      firstFieldError
        ? `${body?.message ?? "La création de commande a échoué."} ${firstFieldError}`
        : body?.message ?? "La création de commande a échoué.",
      body?.retryable === true,
      fieldErrors
    )
  }
  return body
}

function isFieldErrors(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((item) => typeof item === "string")
  )
}
