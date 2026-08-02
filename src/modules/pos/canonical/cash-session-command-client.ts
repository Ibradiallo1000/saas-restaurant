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

export async function openCashSession(input: {
  restaurantId: string
  user: User
  posStationId?: string | null
  legacySessionId?: string | null
  cashierId?: string | null
  deviceInstanceId?: string | null
}) {
  const token = await input.user.getIdToken()
  const response = await fetch(`/api/restaurants/${encodeURIComponent(input.restaurantId)}/cash-sessions/commands`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      command: "OPEN_SESSION",
      posStationId: input.posStationId ?? null,
      legacySessionId: input.legacySessionId ?? null,
      cashierId: input.cashierId ?? null,
      deviceInstanceId: input.deviceInstanceId ?? null,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok !== true) {
    const code = payload?.error?.code || "CASH_SESSION_OPEN_FAILED"
    const message = payload?.error?.message || (response.status >= 500 ? "Erreur serveur lors de l'ouverture de caisse." : "L'ouverture de caisse a échoué.")
    throw new CashSessionCommandClientError(code, message, response.status)
  }
  return payload.result
}
