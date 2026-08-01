import { getSupportedBusinessTimeZone, isConfirmedFinancePayment } from "../../lib/finance/financial-summary.ts"

export type OwnerMetricQuality = "complete" | "estimated" | "partial" | "unavailable"
export type OwnerMetricSource =
  | "confirmed-payments"
  | "legacy-orders-fallback"
  | "treasury-accounts"
  | "cash-movements"
  | "stock-cost-estimate"

export type OwnerDateRange = { start: Date; end: Date }

export type OwnerPeriodFilter = {
  type: "today" | "week" | "month" | "custom"
  startDate?: Date
  endDate?: Date
}

export type OwnerVariation = {
  absolute: number
  percent: number | null
  trend: "up" | "stable" | "down" | "none"
  quality: OwnerMetricQuality
}

export function getOwnerBusinessDateKey(date: Date, timeZone?: string | null) {
  return getBusinessDateKey(date, getSupportedBusinessTimeZone(timeZone))
}

export function getOwnerPeriodRanges(
  filter: OwnerPeriodFilter,
  timeZone?: string | null,
  now = new Date()
) {
  const zone = getSupportedBusinessTimeZone(timeZone)
  const endKey = filter.type === "custom" && filter.endDate
    ? getLocalDateKey(filter.endDate)
    : getBusinessDateKey(now, zone)
  const requestedStartKey = filter.type === "custom" && filter.startDate
    ? getLocalDateKey(filter.startDate)
    : addDateKeyDays(endKey, filter.type === "week" ? -6 : filter.type === "month" ? -29 : 0)
  const startKey = requestedStartKey > endKey ? endKey : requestedStartKey
  const dayCount = getDateKeyDifference(startKey, endKey) + 1
  const previousEndKey = addDateKeyDays(startKey, -1)
  const previousStartKey = addDateKeyDays(previousEndKey, -(dayCount - 1))

  return {
    timeZone: zone,
    current: {
      start: zonedDateTimeToUtc(startKey, 0, 0, 0, 0, zone),
      end: zonedDateTimeToUtc(endKey, 23, 59, 59, 999, zone),
    },
    previous: {
      start: zonedDateTimeToUtc(previousStartKey, 0, 0, 0, 0, zone),
      end: zonedDateTimeToUtc(previousEndKey, 23, 59, 59, 999, zone),
    },
  }
}

export function resolveOwnerRevenue(input: {
  payments: any[]
  currentOrders: any[]
  previousOrders: any[]
  currentRange: OwnerDateRange
  previousRange: OwnerDateRange
  currentOrdersPartial?: boolean
  previousOrdersPartial?: boolean
  timeZone?: string | null
}) {
  const currentPayments = input.payments.filter((payment) => isConfirmedPaymentInRange(payment, input.currentRange, input.timeZone))
  const previousPayments = input.payments.filter((payment) => isConfirmedPaymentInRange(payment, input.previousRange, input.timeZone))
  const canUsePayments = currentPayments.length > 0 || previousPayments.length > 0

  if (canUsePayments) {
    return {
      current: sumConfirmedPayments(currentPayments),
      previous: sumConfirmedPayments(previousPayments),
      source: "confirmed-payments" as const,
      quality: "complete" as const,
      currentPaymentCount: currentPayments.length,
      previousPaymentCount: previousPayments.length,
    }
  }

  const current = sumAmounts(input.currentOrders.map(getOrderAmount))
  const previous = sumAmounts(input.previousOrders.map(getOrderAmount))
  if (current === 0 && previous === 0) {
    return {
      current: 0,
      previous: 0,
      source: "legacy-orders-fallback" as const,
      quality: "unavailable" as const,
      currentPaymentCount: 0,
      previousPaymentCount: 0,
    }
  }

  return {
    current,
    previous,
    source: "legacy-orders-fallback" as const,
    quality: input.currentOrdersPartial || input.previousOrdersPartial ? "partial" as const : "estimated" as const,
    currentPaymentCount: 0,
    previousPaymentCount: 0,
  }
}

export function calculateOwnerAverageOrder(revenue: number, acquiredOrderCount: number) {
  if (!Number.isFinite(revenue) || acquiredOrderCount <= 0) return 0
  return Math.round(Math.max(0, revenue) / acquiredOrderCount)
}

export function getConfirmedPaymentOrderIds(payments: any[]) {
  const orderIds = new Set<string>()
  for (const payment of payments) {
    if (!isConfirmedFinancePayment(payment)) continue
    if (payment.entryType === "refund") continue
    const candidates = [payment.orderId, payment.order?.id, payment.orderRef, payment.orderReference]
    if (Array.isArray(payment.orderIds)) candidates.push(...payment.orderIds)
    if (Array.isArray(payment.orders)) {
      candidates.push(...payment.orders.map((order: any) => typeof order === "string" ? order : order?.id))
    }
    for (const candidate of candidates) {
      const id = String(candidate || "").trim()
      if (id) orderIds.add(id)
    }
  }
  return orderIds
}

export function isOwnerAcquiredOrder(order: any, confirmedPaymentOrderIds: Set<string>) {
  const orderId = String(order?.id || "").trim()
  if (orderId && confirmedPaymentOrderIds.has(orderId)) return true

  const paymentStatus = String(order?.paymentStatus || "").toLowerCase()
  if (["paid", "validated", "verified", "paye"].includes(paymentStatus)) return true
  if (["pending", "pending_mobile", "pending_cash", "unpaid", "failed", "non_paye", "pending_verification", "partial"].includes(paymentStatus)) return false

  return Boolean(
    toDate(order?.paymentValidatedAt)
    || toDate(order?.paidAt)
    || toDate(order?.paymentPaidAt)
    || toDate(order?.payment?.validatedAt)
    || toDate(order?.payment?.paidAt)
    || toDate(order?.timestamps?.paidAt)
  )
}

export function buildOwnerVariation(
  current: number,
  previous: number,
  quality: OwnerMetricQuality = "complete"
): OwnerVariation {
  const absolute = Math.round(current - previous)
  if (quality === "partial" || quality === "unavailable" || !Number.isFinite(previous) || previous <= 0) {
    return { absolute, percent: null, trend: "none", quality }
  }
  const percent = (absolute / previous) * 100
  const trend = Math.abs(percent) < 3 ? "stable" : percent > 0 ? "up" : "down"
  return { absolute, percent, trend, quality }
}

export function resolveOwnerTreasuryBalance(accounts: any[], movements: any[]) {
  const accountTotal = sumAmounts(accounts.map((account) => account.balance), true)
  if (accounts.length > 0 && accountTotal !== 0) {
    return { balance: accountTotal, source: "treasury-accounts" as const, quality: "complete" as const }
  }

  const balance = movements.reduce((total, movement) => {
    const amount = positiveAmount(movement.amount)
    const direction = getTreasuryMovementDirection(movement)
    if (direction === "in") return total + amount
    if (direction === "out") return total - amount
    return total
  }, 0)
  return {
    balance,
    source: "cash-movements" as const,
    quality: movements.length > 0 ? "estimated" as const : "unavailable" as const,
  }
}

export function getConfirmedPaymentDate(payment: any): Date | null {
  return toDate(payment.confirmedAt)
    || toDate(payment.paymentValidatedAt)
    || toDate(payment.paidAt)
    || toDate(payment.createdAt)
}

export function isConfirmedPaymentInRange(payment: any, range: OwnerDateRange, timeZone?: string | null) {
  if (!isConfirmedFinancePayment(payment)) return false
  const explicitBusinessDate = typeof payment.businessDate === "string" ? payment.businessDate.slice(0, 10) : ""
  if (explicitBusinessDate) {
    const zone = getSupportedBusinessTimeZone(timeZone)
    const startKey = getBusinessDateKey(new Date(range.start.getTime() + 3_600_000), zone)
    const endKey = getBusinessDateKey(new Date(range.end.getTime() - 3_600_000), zone)
    return explicitBusinessDate >= startKey && explicitBusinessDate <= endKey
  }
  const date = getConfirmedPaymentDate(payment)
  return Boolean(date && date >= range.start && date <= range.end)
}

export function getTreasuryMovementDirection(movement: any): "in" | "out" | "transfer" {
  if (["in", "out", "transfer"].includes(movement.direction)) return movement.direction
  if (movement.type === "deposit") return "in"
  if (movement.type === "expense" || movement.type === "withdrawal") return "out"
  if (movement.type === "transfer") return "transfer"
  return "out"
}

function getOrderAmount(order: any) {
  return order.total ?? order.totalAmount
}

function sumAmounts(values: unknown[], allowNegative = false) {
  return values.reduce<number>((sum, value) => {
    const amount = Number(value || 0)
    if (!Number.isFinite(amount) || (!allowNegative && amount <= 0)) return sum
    return sum + amount
  }, 0)
}

function sumConfirmedPayments(payments: any[]) {
  const seen = new Set<string>()
  return payments.reduce((sum, payment) => {
    const key = String(payment.idempotencyKey || payment.transactionId || payment.id || "").trim()
    if (key && seen.has(key)) return sum
    if (key) seen.add(key)
    const amount = positiveAmount(payment.amount)
    return sum + (payment.entryType === "refund" ? -amount : amount)
  }, 0)
}

function positiveAmount(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function toDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const firestoreDate = value?.toDate?.()
  return firestoreDate instanceof Date && !Number.isNaN(firestoreDate.getTime()) ? firestoreDate : null
}

function getBusinessDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function addDateKeyDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return date.toISOString().slice(0, 10)
}

function getDateKeyDifference(startKey: string, endKey: string) {
  const start = new Date(`${startKey}T00:00:00Z`).getTime()
  const end = new Date(`${endKey}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

function zonedDateTimeToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const nominal = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  let result = nominal
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(result))
    const displayedHour = Number(part(parts, "hour")) % 24
    const displayedAsUtc = Date.UTC(
      Number(part(parts, "year")),
      Number(part(parts, "month")) - 1,
      Number(part(parts, "day")),
      displayedHour,
      Number(part(parts, "minute")),
      Number(part(parts, "second")),
      millisecond
    )
    const next = result + (nominal - displayedAsUtc)
    if (next === result) break
    result = next
  }
  return new Date(result)
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value || ""
}
