"use client"

import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { Banknote, CreditCard, ListFilter, ReceiptText, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TREASURY_ACCOUNTS,
  TreasuryService,
  getTreasuryAccountLabel,
  type TreasuryAccount,
} from "@/services/treasury.service"

type MovementDirectionFilter = "all" | "in" | "out" | "transfer"

export default function ManagerTreasuryPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { filter } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const [directionFilter, setDirectionFilter] = React.useState<MovementDirectionFilter>("all")
  const [accountFilter, setAccountFilter] = React.useState("all")
  const [sourceFilter, setSourceFilter] = React.useState("all")
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
  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<TreasuryAccount>(accountsQuery)

  const movementsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS),
      where("createdAt", ">=", range.startDate),
      where("createdAt", "<=", range.endDate)
    )
  }, [db, restaurantId, range.endDate, range.startDate])
  const { data: movements, isLoading: isLoadingMovements } = useCollection<any>(movementsQuery)

  const cashSessionsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS)
  }, [db, restaurantId])
  const { data: cashSessions, isLoading: isLoadingCashSessions } = useCollection<any>(cashSessionsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PAYMENTS)
  }, [db, restaurantId])
  const { data: payments, isLoading: isLoadingPayments } = useCollection<any>(paymentsQuery)

  const sessionById = React.useMemo(() => {
    return new Map((cashSessions || []).map((session: any) => [session.id, session]))
  }, [cashSessions])
  const safeMovements = React.useMemo(() => {
    return expandLegacySessionMovements(movements || [], sessionById)
      .sort((a, b) => getTimeMs(b.createdAt) - getTimeMs(a.createdAt))
  }, [movements, sessionById])
  const legacySummary = React.useMemo(
    () => getFinancialSummary({ movements: movements || [], payments: payments || [] }),
    [movements, payments]
  )
  const historicalAccountTotals = React.useMemo(() => buildAccountTotals(safeMovements), [safeMovements])
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
      return true
    })
  }, [accountFilter, directionFilter, safeMovements, sourceFilter])
  const sourceOptions = React.useMemo(() => {
    return Array.from(new Set(safeMovements.map((movement) => String(movement.source || "manual")))).sort()
  }, [safeMovements])

  if (!restaurantId || isLoadingAccounts || isLoadingMovements || isLoadingPayments || isLoadingCashSessions) {
    return <AdminRouteSkeleton />
  }

  return (
    <main className="space-y-4 pb-20 md:pb-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <TreasuryCard
          icon={Wallet}
          label="Solde total"
          value={displayBalance}
          priority
          danger={displayBalance < 0}
        />
        <TreasuryCard icon={ReceiptText} label="Entrées totales" value={displayDeposits} />
        <TreasuryCard icon={Banknote} label="Dépenses totales" value={displayExpenses} danger={displayExpenses > 0} />
      </section>

      <section className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-tight">Répartition par compte</h2>
          {accountTotal <= 0 && legacySummary.balance > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
              Solde historique affiché en fallback
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {safeAccounts.map((account) => (
            <TreasuryAccountCard key={account.id} account={account} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
              <ListFilter className="h-4 w-4 text-primary" />
              Historique des mouvements
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Source : cashMovements enrichi, compatible avec les anciens mouvements.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[560px]">
            <FilterSelect label="Type" value={directionFilter} onChange={(value) => setDirectionFilter(value as MovementDirectionFilter)}>
              <option value="all">Tous</option>
              <option value="in">Entrées</option>
              <option value="out">Sorties</option>
              <option value="transfer">Transferts</option>
            </FilterSelect>
            <FilterSelect label="Compte" value={accountFilter} onChange={setAccountFilter}>
              <option value="all">Tous</option>
              {safeAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter}>
              <option value="all">Toutes</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{formatSource(source)}</option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed bg-muted/20 p-4 text-center text-sm font-semibold text-muted-foreground">
            Aucune donnée pour cette période
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Libellé</th>
                  <th className="px-3 py-2">Compte</th>
                  <th className="px-3 py-2 text-right">Entrée</th>
                  <th className="px-3 py-2 text-right">Sortie</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-background">
                {filteredMovements.map((movement) => {
                  const direction = getMovementDirection(movement)
                  const amount = Number(movement.amount || 0)
                  return (
                    <tr key={movement.id} className="align-middle transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted-foreground">{formatDateTime(movement.occurredAt || movement.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase",
                          direction === "in" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
                          direction === "out" && "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
                          direction === "transfer" && "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                        )}>
                          {formatDirection(direction)}
                        </span>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 font-bold">{getMovementLabel(movement)}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">{getTreasuryAccountLabel(getMovementAccountId(movement))}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-300">
                        {direction === "in" ? `+${formatMoney(amount)} FCFA` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-amber-700 dark:text-amber-300">
                        {direction === "out" ? `-${formatMoney(amount)} FCFA` : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">
                          {formatSource(movement.source)}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-xs font-semibold text-muted-foreground">{movement.createdBy || "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function TreasuryCard({
  icon: Icon,
  label,
  value,
  priority,
  danger,
}: {
  icon: React.ElementType
  label: string
  value: number
  priority?: boolean
  danger?: boolean
}) {
  return (
    <Card className={cn("rounded-xl", priority && "md:order-first", danger && "border-amber-300")}>
      <CardContent className="flex min-h-24 flex-col justify-between p-3">
        <Icon className={cn("h-4 w-4", danger ? "text-amber-600" : "text-primary")} />
        <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 text-lg font-black leading-tight sm:text-xl", danger ? "text-amber-600" : "text-foreground")}>
          {formatMoney(value)} FCFA
        </p>
      </CardContent>
    </Card>
  )
}

function TreasuryAccountCard({ account }: { account: TreasuryAccount }) {
  const isMobile = account.kind === "mobile_money"
  const Icon = isMobile ? CreditCard : Banknote

  return (
    <article className="rounded-xl border bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            isMobile ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{account.name}</p>
            <p className="mt-0.5 text-xs font-bold text-muted-foreground">{formatAccountKind(account.kind)}</p>
          </div>
        </div>
        <p className="whitespace-nowrap text-xl font-black">{formatMoney(account.balance)} FCFA</p>
      </div>
    </article>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="space-y-1 text-[10px] font-black uppercase text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border bg-background px-3 text-xs font-bold normal-case text-foreground"
      >
        {children}
      </select>
    </label>
  )
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
