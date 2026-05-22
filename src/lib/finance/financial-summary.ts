export type FinancialScope =
  | { mode: "session"; sessionId: string }
  | { mode: "global"; sessionId: null }

export type FinancialAnomaly = {
  type: string
  amount?: number
  label: string
}

export type FinancialSummary = {
  deposits: number
  expenses: number
  transfers: number
  balance: number
  todayDeposits: number
  todayExpenses: number
  thisMonthDeposits: number
  averageDeposit: number
  confirmedPaymentCount: number
  hasAbnormalNegativeBalance: boolean
  anomalies: FinancialAnomaly[]
}

type FinancialSummaryInput = {
  movements?: any[]
  payments?: any[]
  scope?: FinancialScope
  businessTimeZone?: string | null
  nowMs?: number
}

export const DEFAULT_BUSINESS_TIME_ZONE = "Africa/Bamako"

export function getFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const movementSnapshot = Array.isArray(input.movements) ? [...input.movements] : []
  const paymentSnapshot = Array.isArray(input.payments) ? [...input.payments] : []
  const scope = input.scope || ({ mode: "global", sessionId: null } as const)
  const businessTimeZone = getSupportedBusinessTimeZone(input.businessTimeZone)
  const now = new Date(input.nowMs || Date.now())
  const todayBusinessDate = getBusinessDateKey(now, businessTimeZone)
  const currentBusinessMonth = getBusinessMonthKey(now, businessTimeZone)
  const seenPaymentKeys = new Set<string>()

  const summary: FinancialSummary = {
    deposits: 0,
    expenses: 0,
    transfers: 0,
    balance: 0,
    todayDeposits: 0,
    todayExpenses: 0,
    thisMonthDeposits: 0,
    averageDeposit: 0,
    confirmedPaymentCount: 0,
    hasAbnormalNegativeBalance: false,
    anomalies: [],
  }

  movementSnapshot.forEach((movement) => {
    const amount = getPositiveAmount(movement.amount)
    if (!amount) return

    if (movement.type === "expense") {
      summary.expenses += amount
      if (isSameBusinessDay(movement, todayBusinessDate, businessTimeZone)) {
        summary.todayExpenses += amount
      }
      return
    }

    if (movement.type === "transfer") {
      summary.transfers += amount
      if (isSameBusinessDay(movement, todayBusinessDate, businessTimeZone)) {
        summary.todayExpenses += amount
      }
    }
  })

  paymentSnapshot.forEach((payment) => {
    if (!isConfirmedFinancePayment(payment)) return
    if (scope.mode === "session" && payment.sessionId !== scope.sessionId) return

    const amount = getPositiveAmount(payment.amount)
    if (!amount) return

    const paymentKey = getPaymentAggregationKey(payment)
    if (paymentKey && seenPaymentKeys.has(paymentKey)) return
    if (paymentKey) seenPaymentKeys.add(paymentKey)

    summary.deposits += amount
    summary.confirmedPaymentCount += 1

    if (isPaymentConfirmedOnBusinessDay(payment, todayBusinessDate, businessTimeZone)) {
      summary.todayDeposits += amount
    }

    if (isPaymentConfirmedInBusinessMonth(payment, currentBusinessMonth, businessTimeZone)) {
      summary.thisMonthDeposits += amount
    }
  })

  summary.balance = summary.deposits - summary.expenses - summary.transfers
  summary.averageDeposit =
    summary.confirmedPaymentCount > 0 ? Math.round(summary.deposits / summary.confirmedPaymentCount) : 0

  if (isAbnormalNegativeBalance(summary)) {
    summary.hasAbnormalNegativeBalance = true
    summary.anomalies.push({
      type: "abnormal_negative_balance",
      amount: Math.abs(summary.balance),
      label: `Solde negatif: ${Math.abs(summary.balance).toLocaleString()} FCFA a verifier`,
    })
  }

  return summary
}

export function isConfirmedFinancePayment(payment: any) {
  if (payment.status !== "confirmed") return false

  const invalidStatus = payment.refundStatus || payment.voidStatus || payment.cancellationStatus
  if (["refunded", "voided", "cancelled", "canceled"].includes(String(invalidStatus || "").toLowerCase())) {
    return false
  }

  return !(
    payment.refunded === true ||
    payment.voided === true ||
    payment.cancelled === true ||
    payment.canceled === true ||
    payment.refundedAt ||
    payment.voidedAt ||
    payment.cancelledAt ||
    payment.canceledAt
  )
}

export function getSupportedBusinessTimeZone(timeZone?: string | null) {
  const candidate = timeZone || DEFAULT_BUSINESS_TIME_ZONE
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE
  }
}

function getPaymentAggregationKey(payment: any) {
  return String(payment.idempotencyKey || payment.transactionId || payment.id || "").trim()
}

function isPaymentConfirmedOnBusinessDay(payment: any, todayBusinessDate: string, businessTimeZone: string) {
  const explicitBusinessDate = normalizeBusinessDate(payment.businessDate)
  if (explicitBusinessDate) return explicitBusinessDate === todayBusinessDate

  const confirmedAt = toDate(payment.confirmedAt)
  if (confirmedAt) return getBusinessDateKey(confirmedAt, businessTimeZone) === todayBusinessDate

  const createdAt = toDate(payment.createdAt)
  if (!createdAt) return false
  return getBusinessDateKey(createdAt, businessTimeZone) === todayBusinessDate
}

function isPaymentConfirmedInBusinessMonth(payment: any, currentBusinessMonth: string, businessTimeZone: string) {
  const explicitBusinessDate = normalizeBusinessDate(payment.businessDate)
  if (explicitBusinessDate) return explicitBusinessDate.slice(0, 7) === currentBusinessMonth

  const confirmedAt = toDate(payment.confirmedAt)
  if (confirmedAt) return getBusinessMonthKey(confirmedAt, businessTimeZone) === currentBusinessMonth

  const createdAt = toDate(payment.createdAt)
  if (!createdAt) return false
  return getBusinessMonthKey(createdAt, businessTimeZone) === currentBusinessMonth
}

function isSameBusinessDay(
  record: any,
  todayBusinessDate: string,
  businessTimeZone: string,
  primaryTimestampField = "createdAt"
) {
  const explicitBusinessDate = normalizeBusinessDate(record.businessDate)
  if (explicitBusinessDate) return explicitBusinessDate === todayBusinessDate

  const timestamp = record[primaryTimestampField] || record.createdAt
  const date = toDate(timestamp)
  if (!date) return false

  return getBusinessDateKey(date, businessTimeZone) === todayBusinessDate
}

function isAbnormalNegativeBalance(summary: Pick<FinancialSummary, "deposits" | "expenses" | "transfers" | "balance">) {
  if (summary.balance >= 0) return false
  const outflows = summary.expenses + summary.transfers
  if (outflows <= 0) return true
  if (summary.deposits <= 0) return outflows > 0
  return Math.abs(summary.balance) > summary.deposits * 0.5
}

function normalizeBusinessDate(value: any) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 10)
}

function getPositiveAmount(value: any) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function toDate(value: any) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const firestoreDate = value?.toDate?.()
  if (firestoreDate instanceof Date && !Number.isNaN(firestoreDate.getTime())) return firestoreDate
  return null
}

function getBusinessDateKey(date: Date, businessTimeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

function getBusinessMonthKey(date: Date, businessTimeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  return `${year}-${month}`
}
