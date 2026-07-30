import { createHash } from "node:crypto"

export const ORDER_COMMAND_IDEMPOTENCY_COLLECTION = "orderCommandIdempotency"
export const ORDER_COMMAND_IDEMPOTENCY_RETENTION_DAYS = 7

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function commandRequestHash(value: unknown) {
  return sha256(stableStringify(value))
}

export function commandProofId(input: {
  restaurantId: string
  actorId: string
  commandName: string
  orderId: string
  orderItemId?: string | null
  idempotencyKey: string
}) {
  return sha256(
    [
      input.restaurantId,
      input.actorId,
      input.commandName,
      input.orderId,
      input.orderItemId ?? "",
      input.idempotencyKey,
    ].join(":")
  )
}
