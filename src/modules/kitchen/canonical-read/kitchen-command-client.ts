import type { User } from "firebase/auth"

import type { ActiveKitchenItemStatus } from "./model.ts"

export class KitchenCommandClientError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(
    code: string,
    message: string,
    retryable: boolean
  ) {
    super(message)
    this.name = "KitchenCommandClientError"
    this.code = code
    this.retryable = retryable
  }
}

export async function executeKitchenItemTransition(input: {
  user: User
  restaurantId: string
  orderId: string
  orderItemId: string
  expectedVersion: number
  targetStatus: Extract<ActiveKitchenItemStatus, "preparing" | "ready">
  idempotencyKey?: string
}) {
  const idToken = await input.user.getIdToken()
  const command = input.targetStatus === "preparing"
    ? "MARK_ORDER_ITEM_PREPARING"
    : "MARK_ORDER_ITEM_READY"
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}/commands`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command,
        orderItemId: input.orderItemId,
        idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(),
        expectedVersion: input.expectedVersion,
      }),
    }
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new KitchenCommandClientError(
      String(payload?.error?.code ?? "KITCHEN_COMMAND_FAILED"),
      String(payload?.error?.message ?? "Impossible de mettre à jour cette ligne."),
      Boolean(payload?.error?.retryable)
    )
  }
  return payload
}

export async function executeKitchenItemsTransition(input: {
  user: User
  restaurantId: string
  orderId: string
  items: ReadonlyArray<{ orderItemId: string; expectedVersion: number }>
  targetStatus: Extract<ActiveKitchenItemStatus, "preparing" | "ready">
  execute?: typeof executeKitchenItemTransition
}) {
  if (input.items.length === 0) {
    throw new KitchenCommandClientError(
      "ORDER_ITEM_NOT_FOUND",
      "Aucune ligne Cuisine active.",
      false
    )
  }
  const execute = input.execute ?? executeKitchenItemTransition
  return Promise.all(input.items.map((item) =>
    execute({
      user: input.user,
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      orderItemId: item.orderItemId,
      expectedVersion: item.expectedVersion,
      targetStatus: input.targetStatus,
    })
  ))
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ??
    `kitchen-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
