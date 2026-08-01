export type PosFinancialReportFilters = {
  stationId: string
  cashierId: string
  sessionId: string
  channel: string
  paymentMethod: string
}

export const EMPTY_POS_FINANCIAL_FILTERS: PosFinancialReportFilters = {
  stationId: "all", cashierId: "all", sessionId: "all", channel: "all", paymentMethod: "all",
}

export function resolveFinancialPosStation(record: Record<string, unknown> | null | undefined) {
  return {
    id: String(record?.posStationId || "DEFAULT"),
    name: String(record?.posStationName || "Caisse principale"),
    code: String(record?.posStationCode || "DEFAULT"),
  }
}

export function matchesPosFinancialFilters(input: {
  filters: PosFinancialReportFilters
  movement: Record<string, unknown>
  session?: Record<string, unknown> | null
  payments?: Array<Record<string, unknown>>
}) {
  const { filters, movement } = input
  const session = input.session || {}
  const station = resolveFinancialPosStation({ ...session, ...movement })
  const sessionId = String(movement.sessionId || movement.sourceSessionId || session.id || "")
  const cashierId = String(movement.cashierId || session.cashierId || session.userId || session.staffId || "")
  if (filters.stationId !== "all" && station.id !== filters.stationId) return false
  if (filters.cashierId !== "all" && cashierId !== filters.cashierId) return false
  if (filters.sessionId !== "all" && sessionId !== filters.sessionId) return false
  const payments = input.payments || []
  if (filters.channel !== "all" && !payments.some((payment) => String(payment.source || payment.channel || "") === filters.channel)) return false
  if (filters.paymentMethod !== "all" && !payments.some((payment) => String(payment.type || payment.paymentMethod || "") === filters.paymentMethod)) return false
  return true
}
