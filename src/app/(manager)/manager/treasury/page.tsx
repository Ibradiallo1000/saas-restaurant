"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { collection, query, where } from "firebase/firestore"
import { ReportsLoadingState } from "@/components/reports-ui"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import {
  DEFAULT_TREASURY_ACCOUNTS,
  TreasuryService,
  getTreasuryAccountLabel,
  type TreasuryAccount,
} from "@/services/treasury.service"
import { ManagerReportsView } from "./ManagerReportsView"
import { buildManagerReportsViewModel, type ManagerTreasuryMovementReport } from "./manager-reports-view-model"
import { EMPTY_POS_FINANCIAL_FILTERS, matchesPosFinancialFilters } from "@/lib/finance/pos-report-filters"
import { PosFinancialFilters } from "@/components/reports/PosFinancialFilters"

type MovementDirectionFilter = "all" | "in" | "out" | "transfer"

export function ManagerTreasuryPageContent() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { filter, type } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const [directionFilter, setDirectionFilter] = React.useState<MovementDirectionFilter>("all")
  const [accountFilter, setAccountFilter] = React.useState("all")
  const [sourceFilter, setSourceFilter] = React.useState("all")
  const [posFilters, setPosFilters] = React.useState(EMPTY_POS_FINANCIAL_FILTERS)
  const service = React.useMemo(() => (db ? new TreasuryService(db) : null), [db])

  React.useEffect(() => {
    if (!service || !restaurantId) return
    service.ensureDefaultTreasuryAccounts(restaurantId).catch((error) => {
      console.warn("[treasury] default accounts unavailable", error)
    })
  }, [restaurantId, service])

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS)
  }, [db, restaurantId])
  const { data: accounts, error: accountsError, isLoading: isLoadingAccounts } = useCollection<TreasuryAccount>(accountsQuery)

  const movementsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS),
      where("createdAt", ">=", range.startDate),
      where("createdAt", "<=", range.endDate)
    )
  }, [db, restaurantId, range.endDate, range.startDate])
  const { data: movements, error: movementsError, isLoading: isLoadingMovements } = useCollection<any>(movementsQuery)

  const cashSessionsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS)
  }, [db, restaurantId])
  const { data: cashSessions, error: sessionsError, isLoading: isLoadingCashSessions } = useCollection<any>(cashSessionsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PAYMENTS)
  }, [db, restaurantId])
  const { data: payments, error: paymentsError, isLoading: isLoadingPayments } = useCollection<any>(paymentsQuery)

  const sessionById = React.useMemo(() => {
    return new Map((cashSessions || []).map((session: any) => [session.id, session]))
  }, [cashSessions])
  const paymentsBySession = React.useMemo(() => {
    const result = new Map<string, any[]>()
    for (const payment of payments || []) { const id = String(payment.sessionId || ""); if (id) result.set(id, [...(result.get(id) || []), payment]) }
    return result
  }, [payments])
  const safeMovements = React.useMemo(() => {
    return expandLegacySessionMovements(movements || [], sessionById)
      .sort((a, b) => getTimeMs(b.createdAt) - getTimeMs(a.createdAt))
  }, [movements, sessionById])
  const legacySummary = React.useMemo(
    () => getFinancialSummary({ movements: movements || [], payments: payments || [] }),
    [movements, payments]
  )
  const historicalAccountTotals = React.useMemo(() => buildAccountTotals(safeMovements), [safeMovements])
  const usesAccountFallback = React.useMemo(() => DEFAULT_TREASURY_ACCOUNTS.some((defaultAccount) => {
    const sourceAccount = (accounts || []).find((account) => account.id === defaultAccount.id)
    return Number(sourceAccount?.balance || 0) <= 0 && Number(historicalAccountTotals[defaultAccount.id] || 0) !== 0
  }), [accounts, historicalAccountTotals])
  const safeAccounts = React.useMemo(
    () => normalizeAccounts(accounts || [], historicalAccountTotals),
    [accounts, historicalAccountTotals]
  )
  const accountTotal = React.useMemo(
    () => safeAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
    [safeAccounts]
  )
  const movementSummary = React.useMemo(() => buildMovementSummary(safeMovements), [safeMovements])
  const displayBalance = accountTotal > 0 ? accountTotal : legacySummary.balance
  const displayDeposits = movementSummary.in > 0 ? movementSummary.in : legacySummary.deposits
  const displayExpenses = movementSummary.out > 0 ? movementSummary.out : legacySummary.expenses
  const filteredMovements = React.useMemo(() => {
    return safeMovements.filter((movement) => {
      const direction = getMovementDirection(movement)
      if (directionFilter !== "all" && direction !== directionFilter) return false
      if (accountFilter !== "all" && getMovementAccountId(movement) !== accountFilter) return false
      if (sourceFilter !== "all" && String(movement.source || "manual") !== sourceFilter) return false
      const sessionId = String(movement.sessionId || movement.sourceSessionId || "")
      if (!matchesPosFinancialFilters({ filters: posFilters, movement, session: sessionById.get(sessionId), payments: paymentsBySession.get(sessionId) })) return false
      return true
    })
  }, [accountFilter, directionFilter, paymentsBySession, posFilters, safeMovements, sessionById, sourceFilter])
  const hasPosFilter = Object.values(posFilters).some((value) => value !== "all")
  const filteredMovementSummary = React.useMemo(() => buildMovementSummary(filteredMovements), [filteredMovements])
  const reportDeposits = hasPosFilter ? filteredMovementSummary.in : displayDeposits
  const reportExpenses = hasPosFilter ? filteredMovementSummary.out : displayExpenses
  const sourceOptions = React.useMemo(() => {
    return Array.from(new Set(safeMovements.map((movement) => String(movement.source || "manual")))).sort()
  }, [safeMovements])
  const viewModel = React.useMemo(() => buildManagerReportsViewModel({
    periodLabel: getPeriodLabel(type, range.startDate, range.endDate), balance: displayBalance, deposits: reportDeposits, expenses: reportExpenses,
    balanceUsesFallback: usesAccountFallback || accountTotal <= 0, movementsUseFallback: movementSummary.in <= 0 || movementSummary.out <= 0,
    containsLegacyExpansion: safeMovements.some((movement) => Boolean(movement.legacyExpandedFrom)),
    accounts: safeAccounts.map((account) => ({ id: account.id, name: account.name, kind: formatAccountKind(account.kind), balance: Number(account.balance || 0) })),
    movements: filteredMovements.map(toMovementReport),
  }), [accountTotal, displayBalance, filteredMovements, movementSummary.in, movementSummary.out, range.endDate, range.startDate, reportDeposits, reportExpenses, safeAccounts, safeMovements, type, usesAccountFallback])

  if (!restaurantId || isLoadingAccounts || isLoadingMovements || isLoadingPayments || isLoadingCashSessions) {
    return <ReportsLoadingState label="Chargement des rapports financiers Manager" />
  }

  return <><div className="mb-4 rounded-lg border bg-card p-3"><PosFinancialFilters value={posFilters} onChange={setPosFilters} {...buildPosFilterOptions(cashSessions || [], payments || [])} /></div><ManagerReportsView model={viewModel} errors={[accountsError && "comptes", movementsError && "mouvements", sessionsError && "sessions", paymentsError && "paiements"].filter(Boolean) as string[]} directionFilter={directionFilter} accountFilter={accountFilter} sourceFilter={sourceFilter} accountOptions={safeAccounts.map((account) => ({ id: account.id, label: account.name }))} sourceOptions={sourceOptions.map((source) => ({ id: source, label: formatSource(source) }))} onDirectionFilterChange={(value) => setDirectionFilter(value as MovementDirectionFilter)} onAccountFilterChange={setAccountFilter} onSourceFilterChange={setSourceFilter} /></>
}

function buildPosFilterOptions(sessions: any[], payments: any[]) {
  const unique = (rows: Array<{ id: string; label: string }>) => [...new Map(rows.filter((row) => row.id).map((row) => [row.id, row])).values()]
  return { stations: unique(sessions.map((s) => ({ id: String(s.posStationId || "DEFAULT"), label: String(s.posStationName || "Caisse principale") }))), cashiers: unique(sessions.map((s) => ({ id: String(s.cashierId || s.userId || ""), label: String(s.cashierName || s.staffName || s.cashierId || "Caissier") }))), sessions: sessions.map((s) => ({ id: s.id, label: `${s.posStationName || "Caisse principale"} · ${s.id.slice(0, 8)}` })), channels: [...new Set(payments.map((p) => String(p.source || p.channel || "")).filter(Boolean))], paymentMethods: [...new Set(payments.map((p) => String(p.type || p.paymentMethod || "")).filter(Boolean))] }
}

export default function LegacyManagerTreasuryPage() {
  const router = useRouter()
  React.useEffect(() => { router.replace("/manager/tresorerie") }, [router])
  return <ReportsLoadingState label="Redirection vers la trésorerie" />
}

function normalizeAccounts(accounts: TreasuryAccount[], fallbackTotals: Record<string, number> = {}) {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  return DEFAULT_TREASURY_ACCOUNTS.map((defaultAccount) => {
    const account = byId.get(defaultAccount.id)
    const accountBalance = Number(account?.balance || 0)
    return {
      ...defaultAccount,
      ...account,
      balance: accountBalance > 0 ? accountBalance : Number(fallbackTotals[defaultAccount.id] || 0),
    }
  })
}

function expandLegacySessionMovements(movements: any[], sessionById: Map<string, any>) {
  return movements.flatMap((movement) => {
    if (!isLegacySessionMovement(movement)) return [movement]

    const session = sessionById.get(String(movement.sessionId || movement.sourceSessionId || ""))
    const split = getSessionPaymentSplit(session)
    if (!split || (split.cash <= 0 && split.mobile <= 0)) return [movement]

    const expanded: any[] = []
    if (split.cash > 0) {
      expanded.push({
        ...movement,
        id: `${movement.id}-cash-legacy`,
        amount: split.cash,
        accountId: "cash",
        paymentMethod: "cash",
        paymentProvider: "cash",
        label: "Validation session caisse - cash",
        legacyExpandedFrom: movement.id,
      })
    }
    if (split.mobile > 0) {
      expanded.push({
        ...movement,
        id: `${movement.id}-mobile-legacy`,
        amount: split.mobile,
        accountId: "mobile_money",
        paymentMethod: "mobile_money",
        paymentProvider: "mobile_money",
        label: "Validation session caisse - mobile money",
        legacyExpandedFrom: movement.id,
      })
    }
    return expanded.length > 0 ? expanded : [movement]
  })
}

function isLegacySessionMovement(movement: any) {
  const id = String(movement.id || "")
  return (
    movement.source === "session" &&
    movement.type === "deposit" &&
    !movement.accountId &&
    Boolean(movement.sessionId || movement.sourceSessionId) &&
    id.startsWith("session-") &&
    !id.endsWith("-cash") &&
    !id.endsWith("-mobile")
  )
}

function getSessionPaymentSplit(session: any) {
  if (!session) return null
  const snapshot = session.closeSnapshot || {}
  const cash = Number(snapshot.systemCash ?? snapshot.systemTotals?.cash ?? session.calculatedCash ?? session.totalCash ?? 0)
  const mobile = Number(snapshot.systemMobileMoney ?? snapshot.systemTotals?.mobileMoney ?? session.calculatedMobile ?? session.totalMobileMoney ?? session.totalMobile ?? 0)
  if (!Number.isFinite(cash) || !Number.isFinite(mobile)) return null
  return { cash: Math.max(0, cash), mobile: Math.max(0, mobile) }
}

function buildAccountTotals(movements: any[]) {
  return movements.reduce<Record<string, number>>((totals, movement) => {
    const direction = getMovementDirection(movement)
    const accountId = getMovementAccountId(movement)
    const amount = Number(movement.amount || 0)
    if (!accountId || !Number.isFinite(amount) || amount <= 0) return totals
    if (direction === "in") totals[accountId] = (totals[accountId] || 0) + amount
    if (direction === "out") totals[accountId] = (totals[accountId] || 0) - amount
    return totals
  }, {})
}

function buildMovementSummary(movements: any[]) {
  return movements.reduce((summary, movement) => {
    const direction = getMovementDirection(movement)
    const amount = Number(movement.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return summary
    if (direction === "in") summary.in += amount
    if (direction === "out") summary.out += amount
    if (direction === "transfer") summary.transfer += amount
    return summary
  }, { in: 0, out: 0, transfer: 0 })
}

function getMovementDirection(movement: any): MovementDirectionFilter {
  if (movement.direction === "in" || movement.direction === "out" || movement.direction === "transfer") {
    return movement.direction
  }
  if (movement.type === "deposit") return "in"
  if (movement.type === "expense" || movement.type === "withdrawal") return "out"
  if (movement.type === "transfer") return "transfer"
  return "out"
}

function getMovementAccountId(movement: any) {
  if (movement.accountId) return String(movement.accountId)
  if (movement.paymentMethod === "mobile_money") return "mobile_money"
  if (movement.paymentMethod === "bank") return "bank"
  if (movement.type === "expense" || movement.type === "deposit") return "cash"
  return null
}

function getMovementLabel(movement: any) {
  return movement.label || movement.reason || movement.note || formatSource(movement.source) || "Mouvement de trésorerie"
}

function formatDirection(direction: string) {
  if (direction === "in") return "Entrée"
  if (direction === "out") return "Sortie"
  if (direction === "transfer") return "Transfert"
  return direction
}

function formatSource(source: unknown) {
  if (source === "session") return "Session caisse"
  if (source === "expense") return "Dépense"
  if (source === "payment") return "Paiement"
  if (source === "manual") return "Manuel"
  if (source === "transfer") return "Transfert"
  return String(source || "-")
}

function formatAccountKind(kind: string) {
  if (kind === "cash") return "Caisse physique"
  if (kind === "mobile_money") return "Compte mobile money"
  if (kind === "bank") return "Compte bancaire"
  return kind
}

function toMovementReport(movement: any): ManagerTreasuryMovementReport {
  const direction = getMovementDirection(movement)
  const amount = Number(movement.amount || 0)
  return { id: movement.id, date: formatDateTime(movement.occurredAt || movement.createdAt), type: formatDirection(direction), label: getMovementLabel(movement), account: getTreasuryAccountLabel(getMovementAccountId(movement)), incoming: direction === "in" ? `+${formatMoney(amount)} FCFA` : "-", outgoing: direction === "out" ? `-${formatMoney(amount)} FCFA` : "-", source: formatSource(movement.source), user: movement.createdBy || "-" }
}

function getPeriodLabel(type: string, startDate: Date, endDate: Date) {
  if (type === "today") return "Aujourd’hui"
  if (type === "week") return "7 derniers jours"
  if (type === "month") return "30 derniers jours"
  return `${startDate.toLocaleDateString("fr-FR")} – ${endDate.toLocaleDateString("fr-FR")}`
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}

function formatDateTime(value: any) {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null)
  if (!date) return "-"
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTimeMs(value: any) {
  return value?.toDate?.()?.getTime?.() || 0
}
