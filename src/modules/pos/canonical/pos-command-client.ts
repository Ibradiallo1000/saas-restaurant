import type { User } from "firebase/auth"

export type PosCanonicalCommand =
  | "MARK_ORDER_ITEM_SERVED"
  | "CANCEL_ORDER_ITEM_QUANTITY"
  | "CONFIRM_ORDER_PAYMENT"

export class PosCommandClientError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(
    code: string,
    message: string,
    retryable = false
  ) {
    super(message)
    this.name = "PosCommandClientError"
    this.code = code
    this.retryable = retryable
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
  return parts.map((part) => String(part ?? "")).join(":").slice(0, 200)
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
    throw new PosCommandClientError(
      body?.code ?? "ORDER_CREATE_FAILED",
      body?.message ?? "La création de commande a échoué.",
      body?.retryable === true
    )
  }
  return body
}
