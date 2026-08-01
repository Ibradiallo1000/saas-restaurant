import type { User } from "firebase/auth"

import { PosCommandClientError } from "./pos-command-client.ts"

export async function confirmTableSessionPayment(input: {
  user: User
  restaurantId: string
  tableSessionId: string
  cashSessionId: string
  method: "cash" | "mobile_money"
  provider: string | null
  idempotencyKey: string
}) {
  const token = await input.user.getIdToken()
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/table-sessions/${encodeURIComponent(input.tableSessionId)}/confirm-payment`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        cashSessionId: input.cashSessionId,
        method: input.method,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
      }),
    }
  )
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) {
    throw new PosCommandClientError(
      body?.error?.code ?? "TABLE_SESSION_PAYMENT_FAILED",
      body?.error?.message ?? "La validation du paiement de la session a échoué.",
      body?.error?.retryable === true
    )
  }
  return body
}
