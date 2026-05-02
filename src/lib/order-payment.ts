export type PaymentMethod = "cash" | "mobile"
export type PaymentStatus = "pending" | "validated"
export type LegacyPaymentMethod = PaymentMethod | "mobile_money" | string | null | undefined
export type LegacyPaymentStatus = PaymentStatus | "paid" | "unpaid" | "partial" | string | null | undefined

export function normalizePaymentMethod(method: LegacyPaymentMethod): PaymentMethod | null {
  if (method === "cash") return "cash"
  if (method === "mobile" || method === "mobile_money") return "mobile"
  return null
}

export function normalizePaymentStatus(status: LegacyPaymentStatus): PaymentStatus | null {
  if (status === "validated" || status === "paid") return "validated"
  if (status === "pending" || status === "unpaid" || status === "partial") return "pending"
  return null
}

export function paymentStatusForMethod(method: PaymentMethod): PaymentStatus {
  return method === "cash" ? "validated" : "pending"
}
