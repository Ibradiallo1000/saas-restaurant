"use client"

import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { ReportsLoadingState } from "@/components/reports-ui"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { COLLECTION_NAMES } from "@/lib/constants"
import {
  DEFAULT_TREASURY_ACCOUNTS,
  getTreasuryAccountLabel,
  type TreasuryAccount,
} from "@/services/treasury.service"
import { OwnerReportsView } from "./OwnerReportsView"
import { buildOwnerReportsViewModel, type OwnerTreasuryMovementReport } from "./owner-reports-view-model"

type MovementDirection = "in" | "out" | "transfer"
type MovementDirectionFilter = "all" | MovementDirection

export default function OwnerTresoreriePage() {
  const db = useFirestore()
  const { restaurantId, loading } = useRestaurant()
  const { dateRange, filter, setDateRange, setType, type } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const [directionFilter, setDirectionFilter] = React.useState<MovementDirectionFilter>("all")
  const [accountFilter, setAccountFilter] = React.useState("all")
  const [sourceFilter, setSourceFilter] = React.useState("all")

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

  const sessionById = React.useMemo(() => {
    return new Map((cashSessions || []).map((session: any) => [session.id, session]))
  }, [cashSessions])
  const safeMovements = React.useMemo(() => {
    return expandLegacySessionMovements(movements || [], sessionById)
      .sort((a, b) => getTimeMs(b.createdAt) - getTimeMs(a.createdAt))
  }, [movements, sessionById])
  const accountFallbackTotals = React.useMemo(() => buildAccountTotals(safeMovements), [safeMovements])
  const usesAccountFallback = React.useMemo(() => DEFAULT_TREASURY_ACCOUNTS.some((defaultAccount) => {
    const sourceAccount = (accounts || []).find((account) => account.id === defaultAccount.id)
    return Number(sourceAccount?.balance || 0) === 0 && Number(accountFallbackTotals[defaultAccount.id] || 0) !== 0
  }), [accountFallbackTotals, accounts])
  const safeAccounts = React.useMemo(
    () => normalizeAccounts(accounts || [], accountFallbackTotals),
    [accounts, accountFallbackTotals]
  )
  const summary = React.useMemo(() => buildTreasurySummary(safeMovements), [safeMovements])
  const accountTotal = React.useMemo(
    () => safeAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
    [safeAccounts]
  )
  const displayBalance = accountTotal !== 0 ? accountTotal : summary.net
  const sessionControls = React.useMemo(
    () => buildCashSessionControls(cashSessions || [], range.startDate, range.endDate),
    [cashSessions, range.endDate, range.startDate]
  )
  const filteredMovements = React.useMemo(() => {
    return safeMovements.filter((movement) => {
      const direction = getMovementDirection(movement)
      if (directionFilter !== "all" && direction !== directionFilter) return false
      if (accountFilter !== "all" && getMovementAccountId(movement) !== accountFilter) return false
      if (sourceFilter !== "all" && String(movement.source || "manual") !== sourceFilter) return false
      return true
    })
  }, [accountFilter, directionFilter, safeMovements, sourceFilter])
  const sourceOptions = React.useMemo(() => {
    return Array.from(new Set(safeMovements.map((movement) => String(movement.source || "manual")))).sort()
  }, [safeMovements])
  const viewModel = React.useMemo(() => buildOwnerReportsViewModel({
    periodLabel: getPeriodLabel(type, range.startDate, range.endDate),
    displayBalance,
    incoming: summary.in,
    outgoing: summary.out,
    transfers: summary.transfer,
    balanceUsesMovementFallback: usesAccountFallback || accountTotal === 0,
    containsExpandedLegacyMovements: (movements || []).some(isLegacySessionMovement),
    accounts: safeAccounts.map((account) => ({ id: account.id, name: account.name, kind: formatAccountKind(account.kind), balance: Number(account.balance || 0) })),
    sessionControls,
    movements: filteredMovements.map(toMovementReport),
  }), [accountTotal, displayBalance, filteredMovements, movements, range.endDate, range.startDate, safeAccounts, sessionControls, summary.in, summary.out, summary.transfer, type, usesAccountFallback])

  if (loading || !restaurantId || isLoadingAccounts || isLoadingMovements || isLoadingCashSessions) {
    return <ReportsLoadingState label="Chargement des rapports financiers Owner" />
  }

  return <OwnerReportsView model={viewModel} errors={[accountsError && "comptes de trésorerie", movementsError && "mouvements financiers", sessionsError && "sessions de caisse"].filter(Boolean) as string[]} period={type} customRange={dateRange} onPeriodChange={setType} onCustomRangeChange={setDateRange} directionFilter={directionFilter} accountFilter={accountFilter} sourceFilter={sourceFilter} accountOptions={safeAccounts.map((account) => ({ id: account.id, label: account.name }))} sourceOptions={sourceOptions.map((source) => ({ id: source, label: formatSource(source) }))} onDirectionFilterChange={(value) => setDirectionFilter(value as MovementDirectionFilter)} onAccountFilterChange={setAccountFilter} onSourceFilterChange={setSourceFilter} />
}

function normalizeAccounts(accounts: TreasuryAccount[], fallbackTotals: Record<string, number>) {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  return DEFAULT_TREASURY_ACCOUNTS.map((defaultAccount) => {
    const account = byId.get(defaultAccount.id)
    const accountBalance = Number(account?.balance || 0)
    return {
      ...defaultAccount,
      ...account,
      balance: accountBalance !== 0 ? accountBalance : Number(fallbackTotals[defaultAccount.id] || 0),
    }
  })
}

function buildTreasurySummary(movements: any[]) {
  return movements.reduce((summary, movement) => {
    const direction = getMovementDirection(movement)
    const amount = Number(movement.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return summary
    if (direction === "in") {
      summary.in += amount
      summary.net += amount
    }
    if (direction === "out") {
      summary.out += amount
      summary.net -= amount
    }
    if (direction === "transfer") {
      summary.transfer += amount
    }
    return summary
  }, { in: 0, out: 0, transfer: 0, net: 0 })
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

function buildCashSessionControls(sessions: any[], startDate: Date, endDate: Date) {
  return sessions.reduce((summary, session) => {
    const status = String(session.status || "")
    const relevantDate = session.validatedAt || session.closedAt || session.updatedAt || session.createdAt
    if (!isValueInDateRange(relevantDate, startDate, endDate)) return summary

    if (status === "validated" || session.validatedByManager === true) summary.validated += 1
    if ((status === "closed" || status === "pending_validation") && !session.validatedByManager) summary.pending += 1
    if (session.validationFlag === "discrepancy" || session.discrepancyStatus === "investigate" || Number(session.discrepancyAmount || 0) !== 0) {
      summary.discrepancies += 1
    }
    return summary
  }, { validated: 0, pending: 0, discrepancies: 0 })
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

function getMovementDirection(movement: any): MovementDirection {
  if (movement.direction === "in" || movement.direction === "out" || movement.direction === "transfer") return movement.direction
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

function toMovementReport(movement: any): OwnerTreasuryMovementReport {
  const direction = getMovementDirection(movement)
  const amount = Number(movement.amount || 0)
  return {
    id: movement.id,
    date: formatDateTime(movement.occurredAt || movement.createdAt),
    direction,
    directionLabel: formatDirection(direction),
    label: getMovementLabel(movement),
    account: getTreasuryAccountLabel(getMovementAccountId(movement)),
    incoming: direction === "in" ? `+${formatMoney(amount)} FCFA` : "-",
    outgoing: direction === "out" ? `-${formatMoney(amount)} FCFA` : "-",
    source: formatSource(movement.source),
    validatedBy: movement.createdBy || movement.validatedBy || "-",
  }
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

function isValueInDateRange(value: any, startDate: Date, endDate: Date) {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null)
  if (!date) return false
  return date >= startDate && date <= endDate
}
