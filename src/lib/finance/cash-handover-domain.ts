export const CASH_HANDOVER_STATUSES = [
  "submitted",
  "under_review",
  "validated",
  "correction_required",
  "rejected",
] as const

export type CashHandoverStatus = (typeof CASH_HANDOVER_STATUSES)[number]

export class CashHandoverValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function normalizeHandoverAmount(value: unknown, field: string) {
  const amount = Math.round(Number(value))
  if (!Number.isFinite(amount) || amount < 0) {
    throw new CashHandoverValidationError(
      "INVALID_HANDOVER_AMOUNT",
      `${field} doit être un montant positif ou nul.`
    )
  }
  return amount
}

export function cleanHandoverNote(value: unknown, required = false) {
  const note = String(value ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 500)
  if (required && !note) {
    throw new CashHandoverValidationError(
      "HANDOVER_NOTE_REQUIRED",
      "Une note est obligatoire pour cette décision."
    )
  }
  return note || null
}
