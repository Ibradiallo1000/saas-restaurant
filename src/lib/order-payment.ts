// lib/order-payment.ts

export type PaymentMethod =
  | "cash"
  | "orange_money"
  | "mtn_money"
  | "wave"

export type PaymentStatus =
  | "unpaid"
  | "pending_cash"
  | "pending_mobile"
  | "paid"
  | "failed"

export type LegacyPaymentMethod =
  | PaymentMethod
  | "mobile"
  | "mobile_money"
  | string
  | null
  | undefined

export type LegacyPaymentStatus =
  | PaymentStatus
  | "pending"
  | "pending_verification"
  | "validated"
  | "partial"
  | "paye"
  | "non_paye"
  | "verified"
  | string
  | null
  | undefined

export function normalizePaymentMethod(
  method: LegacyPaymentMethod
): PaymentMethod | null {
  if (!method) return null

  if (method === "cash") return "cash"

  if (
    method === "mobile" ||
    method === "mobile_money" ||
    method === "orange_money"
  ) return "orange_money"

  if (method === "mtn_money") return "mtn_money"
  if (method === "wave") return "wave"

  return null
}

export function normalizePaymentStatus(
  status: LegacyPaymentStatus
): PaymentStatus | null {
  if (!status) return null

  if (status === "paid" || status === "validated" || status === "paye" || status === "verified") return "paid"
  if (status === "pending_cash") return "pending_cash"
  if (status === "pending_mobile" || status === "pending" || status === "pending_verification" || status === "partial") return "pending_mobile"
  if (status === "failed") return "failed"
  if (status === "unpaid" || status === "non_paye") return "unpaid"

  return null
}

export function paymentStatusForMethod(
  method: PaymentMethod
): PaymentStatus {
  if (method === "cash") return "pending_cash"

  return "pending_mobile"
}
