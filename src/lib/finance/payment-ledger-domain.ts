export const PAYMENT_SOURCES = ["pos", "qr_table", "delivery", "legacy"] as const
export type FinancialPaymentSource = (typeof PAYMENT_SOURCES)[number]
export type FinancialPaymentMethod = "cash" | "mobile_money"
export type FinancialPaymentStatus = "pending" | "confirmed" | "failed" | "voided"
export type FinancialEntryType = "payment" | "refund"

export interface FinancialLedgerEntry {
  id?: string
  orderId: string
  sessionId: string
  cashierId: string
  source: FinancialPaymentSource
  type: FinancialPaymentMethod
  provider?: string | null
  paymentAccountId?: string | null
  amount: number
  status: FinancialPaymentStatus | string
  entryType?: FinancialEntryType
  parentPaymentId?: string | null
  idempotencyKey?: string | null
}

export interface FinancialSessionAggregate {
  totalCash: number
  totalMobile: number
  totalMobileMoney: number
  totalConfirmed: number
  totalPayments: number
  totalOrders: number
  totalRefunded: number
  totalRefunds: number
  totalsByProvider: Record<string, number>
  totalsBySource: Record<FinancialPaymentSource, number>
  statusCounts: Record<string, number>
}

export const FINANCIAL_CACHE_FIELDS = [
  "totalCash",
  "totalMobile",
  "totalMobileMoney",
  "totalConfirmed",
  "totalPayments",
  "totalOrders",
  "totalRefunded",
  "totalRefunds",
  "totalsByProvider",
  "totalsBySource",
] as const

export function aggregateFinancialEntries(
  entries: readonly FinancialLedgerEntry[]
): FinancialSessionAggregate {
  const result: FinancialSessionAggregate = {
    totalCash: 0,
    totalMobile: 0,
    totalMobileMoney: 0,
    totalConfirmed: 0,
    totalPayments: 0,
    totalOrders: 0,
    totalRefunded: 0,
    totalRefunds: 0,
    totalsByProvider: {},
    totalsBySource: {
      pos: 0,
      qr_table: 0,
      delivery: 0,
      legacy: 0,
    },
    statusCounts: {},
  }
  const seenEntries = new Set<string>()
  const orderBalances = new Map<string, number>()

  for (const entry of entries) {
    result.statusCounts[entry.status] = (result.statusCounts[entry.status] || 0) + 1
    if (entry.status !== "confirmed") continue

    const amount = normalizeLedgerAmount(entry.amount)
    const identity = String(entry.idempotencyKey || entry.id || "").trim()
    if (!identity) throw new Error("Paiement confirmé sans identité idempotente.")
    if (seenEntries.has(identity)) continue
    seenEntries.add(identity)

    const entryType = entry.entryType === "refund" ? "refund" : "payment"
    const direction = entryType === "refund" ? -1 : 1
    const signedAmount = amount * direction
    const source = PAYMENT_SOURCES.includes(entry.source) ? entry.source : "legacy"
    const provider = String(entry.provider || "unknown")

    result.totalConfirmed += signedAmount
    result.totalsBySource[source] += signedAmount
    orderBalances.set(entry.orderId, (orderBalances.get(entry.orderId) || 0) + signedAmount)

    if (entryType === "refund") {
      result.totalRefunded += amount
      result.totalRefunds += 1
    } else {
      result.totalPayments += 1
    }

    if (entry.type === "cash") {
      result.totalCash += signedAmount
    } else if (entry.type === "mobile_money") {
      result.totalMobile += signedAmount
      result.totalMobileMoney += signedAmount
      result.totalsByProvider[provider] =
        (result.totalsByProvider[provider] || 0) + signedAmount
    } else {
      throw new Error(`Type de paiement confirmé invalide: ${String(entry.type)}`)
    }
  }

  result.totalOrders = Array.from(orderBalances.values()).filter((amount) => amount > 0).length
  return normalizeAggregate(result)
}

export function financialCachePatch(aggregate: FinancialSessionAggregate) {
  return {
    totalCash: aggregate.totalCash,
    totalMobile: aggregate.totalMobile,
    totalMobileMoney: aggregate.totalMobileMoney,
    totalConfirmed: aggregate.totalConfirmed,
    totalPayments: aggregate.totalPayments,
    totalOrders: aggregate.totalOrders,
    totalRefunded: aggregate.totalRefunded,
    totalRefunds: aggregate.totalRefunds,
    totalsByProvider: aggregate.totalsByProvider,
    totalsBySource: aggregate.totalsBySource,
  }
}

export function diffFinancialCache(
  cache: Record<string, unknown>,
  aggregate: FinancialSessionAggregate
) {
  const expected = financialCachePatch(aggregate)
  const differences: Record<string, { cached: unknown; expected: unknown }> = {}
  for (const field of FINANCIAL_CACHE_FIELDS) {
    const cached = normalizeComparable(cache[field])
    const wanted = normalizeComparable(expected[field])
    if (JSON.stringify(cached) !== JSON.stringify(wanted)) {
      differences[field] = { cached: cache[field], expected: expected[field] }
    }
  }
  return differences
}

function normalizeLedgerAmount(value: unknown) {
  const amount = Math.round(Number(value))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant de paiement confirmé invalide.")
  }
  return amount
}

function normalizeAggregate(aggregate: FinancialSessionAggregate) {
  for (const field of [
    "totalCash",
    "totalMobile",
    "totalMobileMoney",
    "totalConfirmed",
    "totalRefunded",
  ] as const) {
    if (Math.abs(aggregate[field]) < Number.EPSILON) aggregate[field] = 0
  }
  for (const values of [
    aggregate.totalsByProvider,
    aggregate.totalsBySource as Record<string, number>,
  ]) {
    for (const key of Object.keys(values)) {
      if (Math.abs(values[key]) < Number.EPSILON) values[key] = 0
    }
  }
  return aggregate
}

function normalizeComparable(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (!value || typeof value !== "object" || Array.isArray(value)) return value ?? 0
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, normalizeComparable(nested)])
  )
}
