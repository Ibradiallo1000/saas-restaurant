import type { User } from "firebase/auth"

export class CashSessionCommandClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "CashSessionCommandClientError"
  }
}

export async function closeCashSessionV2(input: {
  restaurantId: string
  sessionId: string
  user: User
  countedPhysicalCash: number
  retainedFloat: number
}) {
  const token = await input.user.getIdToken()
  const idempotencyKey = [
    "cash-close-v2",
    input.sessionId,
    Math.round(input.countedPhysicalCash),
    Math.round(input.retainedFloat),
  ].join(":")
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/cash-sessions/${encodeURIComponent(input.sessionId)}/commands`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command: "CLOSE_SESSION",
        countedPhysicalCash: input.countedPhysicalCash,
        retainedFloat: input.retainedFloat,
        idempotencyKey,
      }),
    }
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok !== true) {
    throw new CashSessionCommandClientError(
      payload?.error?.code || "CASH_SESSION_CLOSE_FAILED",
      payload?.error?.message || "La clôture de caisse a échoué.",
      response.status
    )
  }
  return payload.result
}
