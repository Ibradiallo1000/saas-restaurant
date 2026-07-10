"use client"

import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { AlertTriangle, Banknote, CheckCircle2, ListFilter, ReceiptText, Wallet } from "lucide-react"

import { OwnerTimeFilterBar } from "@/app/owner/_components/OwnerTimeFilterBar"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Card, CardContent } from "@/components/ui/card"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { COLLECTION_NAMES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TREASURY_ACCOUNTS,
  getTreasuryAccountLabel,
  type TreasuryAccount,
} from "@/services/treasury.service"

type MovementDirection = "in" | "out" | "transfer"
type MovementDirectionFilter = "all" | MovementDirection

export default function OwnerTresoreriePage() {
  const db = useFirestore()
  const { restaurantId, loading } = useRestaurant()
  const { filter } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const [directionFilter, setDirectionFilter] = React.useState<MovementDirectionFilter>("all")
  const [accountFilter, setAccountFilter] = React.useState("all")
  const [sourceFilter, setSourceFilter] = React.useState("all")

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

  const sessionById = React.useMemo(() => {
    return new Map((cashSessions || []).map((session: any) => [session.id, session]))
  }, [cashSessions])
  const safeMovements = React.useMemo(() => {
    return expandLegacySessionMovements(movements || [], sessionById)
      .sort((a, b) => getTimeMs(b.createdAt) - getTimeMs(a.createdAt))
  }, [movements, sessionById])
  const accountFallbackTotals = React.useMemo(() => buildAccountTotals(safeMovements), [safeMovements])
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

  if (loading || !restaurantId || isLoadingAccounts || isLoadingMovements || isLoadingCashSessions) {
    return <AdminRouteSkeleton />
  }

  return (
    <main className="space-y-4 pb-20 md:space-y-6 md:pb-6">
      <header className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Trésorerie owner</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Supervision des soldes, validations caisse et mouvements financiers du restaurant.
            </p>
          </div>
          <BusinessHealthBadge pending={sessionControls.pending} negativeBalance={displayBalance < 0} />
        </div>
      </header>

      <OwnerTimeFilterBar />

      <section className="grid gap-3 md:grid-cols-4">
        <TreasuryCard icon={Wallet} label="Solde total" value={displayBalance} priority danger={displayBalance < 0} />
        <TreasuryCard icon={ReceiptText} label="Entrées période" value={summary.in} />
        <TreasuryCard icon={Banknote} label="Sorties période" value={summary.out} danger={summary.out > 0} />
        <TreasuryCard icon={ListFilter} label="Transferts internes" value={summary.transfer} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_.9fr]">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-tight">Répartition par source</h2>
            <p className="text-sm text-muted-foreground">
              Lecture consolidée des comptes de trésorerie. Les anciennes validations sont réparties depuis la session caisse quand possible.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {safeAccounts.map((account) => (
              <article key={account.id} className="rounded-xl border bg-background p-4">
                <p className="text-xs font-black uppercase text-muted-foreground">{account.name}</p>
                <p className="mt-2 text-2xl font-black">{formatMoney(account.balance)} FCFA</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">{formatAccountKind(account.kind)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-tight">Contrôle caisse</h2>
            <p className="text-sm text-muted-foreground">Suivi owner des validations et anomalies.</p>
          </div>
          <div className="grid gap-3">
            <ControlRow label="Sessions validées" value={sessionControls.validated} tone="good" />
            <ControlRow label="En attente validation" value={sessionControls.pending} tone={sessionControls.pending > 0 ? "warning" : "neutral"} />
            <ControlRow label="Écarts détectés" value={sessionControls.discrepancies} tone={sessionControls.discrepancies > 0 ? "warning" : "neutral"} />
          </div>
        </section>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Historique financier</h2>
            <p className="text-sm text-muted-foreground">
              Date, source, compte impacté, montant et responsable de chaque mouvement.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
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
          <div className="rounded-xl border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
            Aucune donnée pour cette période
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 pr-3">Type</th>
                  <th className="py-3 pr-3">Libellé</th>
                  <th className="py-3 pr-3">Compte</th>
                  <th className="py-3 pr-3 text-right">Entrée</th>
                  <th className="py-3 pr-3 text-right">Sortie</th>
                  <th className="py-3 pr-3">Source</th>
                  <th className="py-3 pr-3">Validé par</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMovements.map((movement) => {
                  const direction = getMovementDirection(movement)
                  const amount = Number(movement.amount || 0)
                  return (
                    <tr key={movement.id} className="align-top">
                      <td className="py-3 pr-3 font-semibold">{formatDateTime(movement.occurredAt || movement.createdAt)}</td>
                      <td className="py-3 pr-3">
                        <span className={cn(
                          "rounded-full px-2 py-1 text-xs font-black uppercase",
                          direction === "in" && "bg-emerald-100 text-emerald-700",
                          direction === "out" && "bg-amber-100 text-amber-700",
                          direction === "transfer" && "bg-blue-100 text-blue-700"
                        )}>
                          {formatDirection(direction)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-bold">{getMovementLabel(movement)}</td>
                      <td className="py-3 pr-3">{getTreasuryAccountLabel(getMovementAccountId(movement))}</td>
                      <td className="py-3 pr-3 text-right font-black text-emerald-700">
                        {direction === "in" ? `+${formatMoney(amount)} FCFA` : "-"}
                      </td>
                      <td className="py-3 pr-3 text-right font-black text-amber-700">
                        {direction === "out" ? `-${formatMoney(amount)} FCFA` : "-"}
                      </td>
                      <td className="py-3 pr-3">{formatSource(movement.source)}</td>
                      <td className="py-3 pr-3">{movement.createdBy || movement.validatedBy || "-"}</td>
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
    <Card className={cn(priority && "md:col-span-1", danger && "border-amber-300")}>
      <CardContent className="p-4">
        <Icon className={cn("mb-3 h-5 w-5", danger ? "text-amber-600" : "text-primary")} />
        <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
        <p className={cn("mt-1 font-black", priority ? "text-3xl" : "text-2xl", danger ? "text-amber-600" : "text-foreground")}>
          {formatMoney(value)} FCFA
        </p>
      </CardContent>
    </Card>
  )
}

function BusinessHealthBadge({ pending, negativeBalance }: { pending: number; negativeBalance: boolean }) {
  if (negativeBalance) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
        <AlertTriangle className="h-4 w-4" />
        Problème trésorerie
      </span>
    )
  }
  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        Validation à suivre
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
      <CheckCircle2 className="h-4 w-4" />
      Situation claire
    </span>
  )
}

function ControlRow({ label, value, tone }: { label: string; value: number; tone: "good" | "warning" | "neutral" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-background p-3">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <span className={cn(
        "text-lg font-black",
        tone === "good" && "text-emerald-700",
        tone === "warning" && "text-amber-700"
      )}>
        {value}
      </span>
    </div>
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
    <label className="space-y-1 text-xs font-black uppercase text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm font-bold normal-case text-foreground"
      >
        {children}
      </select>
    </label>
  )
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
