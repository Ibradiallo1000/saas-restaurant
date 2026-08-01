import type { User } from "firebase/auth"

export class CashHandoverCommandClientError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message)
    this.name = "CashHandoverCommandClientError"
  }
}

export async function submitCashHandover(input: {
  restaurantId: string
  sessionId: string
  user: User
  declaredAmount: number
  note: string
}) {
  return execute(input.restaurantId, input.user, {
    command: "SUBMIT_HANDOVER",
    sessionId: input.sessionId,
    declaredAmount: input.declaredAmount,
    note: input.note,
    idempotencyKey: `handover-submit:${input.sessionId}:${Math.round(input.declaredAmount)}:${input.note.trim()}`,
  })
}

export async function reviewCashHandover(input: {
  restaurantId: string
  handoverId: string
  user: User
  decision: "under_review" | "validated" | "correction_required" | "rejected"
  receivedAmount?: number
  note: string
}) {
  return execute(input.restaurantId, input.user, {
    command: "REVIEW_HANDOVER",
    handoverId: input.handoverId,
    decision: input.decision,
    receivedAmount: input.receivedAmount,
    note: input.note,
    idempotencyKey: `handover-review:${input.handoverId}:${input.decision}:${input.receivedAmount ?? ""}:${input.note.trim()}`,
  })
}

export async function ensureCashHandoverForReview(input: {
  restaurantId: string
  sessionId: string
  user: User
}) {
  return execute(input.restaurantId, input.user, {
    command: "ENSURE_HANDOVER_FOR_REVIEW",
    sessionId: input.sessionId,
    idempotencyKey: `handover-manager-recovery:${input.sessionId}`,
  })
}

async function execute(restaurantId: string, user: User, command: Record<string, unknown>) {
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(restaurantId)}/cash-handovers/commands`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await user.getIdToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
    }
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok !== true) {
    throw new CashHandoverCommandClientError(
      payload?.error?.code || "CASH_HANDOVER_COMMAND_FAILED",
      payload?.error?.message || "La commande de remise a échoué.",
      response.status
    )
  }
  return payload.result
}
