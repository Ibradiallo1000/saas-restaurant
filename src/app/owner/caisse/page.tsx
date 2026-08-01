"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, Clock3, History, ReceiptText, ShieldCheck, Wallet } from "lucide-react"

import { CashHandoverReviewPanel } from "@/app/(manager)/manager/caisse/CashHandoverReviewPanel"
import {
  DashboardAlert,
  DashboardAlertList,
  DashboardEmptyState,
  DashboardHeader,
  DashboardSection,
  DashboardStat,
  DashboardWidget,
  DashboardWidgetHeader,
} from "@/components/dashboard-ui"
import { GlobalTimeFilterBar } from "@/components/time-filter/GlobalTimeFilterBar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTimeFilter, getDateRange } from "@/contexts/time-filter-context"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { approveCashOpeningRequest } from "@/modules/cash/approve-cash-opening-request"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

const HISTORY_LIMIT = 20
const RECENT_ACTIVITY_LIMIT = 8

export default function OwnerCaissePage() {
  const db = useFirestore()
  const { restaurantId, restaurant } = useRestaurant()
  const { user, role } = useTenant()
  const { filter } = useTimeFilter()
  const { toast } = useToast()
  const {
    cashMovements,
    cashSessionRequests,
    cashSessions,
    isLoadingSessions,
  } = useRestaurantLiveData()
  const [approvingId, setApprovingId] = React.useState<string | null>(null)
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const canApproveOpening = role === "owner"

  const openSessions = React.useMemo(
    () => cashSessions.filter((session: any) => isOpenSession(session.status)).sort(sortByOpenedAt),
    [cashSessions]
  )
  const openingRequests = React.useMemo(() => {
    const requests = cashSessionRequests.map((request: any) => ({ ...request, source: "request" as const }))
    const pendingSessions = cashSessions
      .filter((session: any) => isOpeningRequest(session.status))
      .map((session: any) => ({ ...session, source: "session" as const }))
    return [...requests, ...pendingSessions]
  }, [cashSessionRequests, cashSessions])
  const pendingClosures = React.useMemo(
    () => cashSessions.filter((session: any) => isPendingValidation(session)),
    [cashSessions]
  )
  const discrepancies = React.useMemo(
    () => cashSessions.filter((session: any) => {
      const difference = getSessionDifference(session)
      return difference !== null && difference !== 0
    }),
    [cashSessions]
  )
  const openSales = React.useMemo(
    () => openSessions.reduce((sum: number, session: any) => sum + getSessionSales(session), 0),
    [openSessions]
  )
  const history = React.useMemo(
    () => cashSessions
      .filter((session: any) => isInRange(session.closedAt || session.openedAt || session.createdAt, range.startDate, range.endDate))
      .sort(sortByMostRecent)
      .slice(0, HISTORY_LIMIT),
    [cashSessions, range.endDate, range.startDate]
  )
  const recentActivity = React.useMemo(
    () => buildRecentActivity(cashSessions, cashMovements).slice(0, RECENT_ACTIVITY_LIMIT),
    [cashMovements, cashSessions]
  )
  const longRunningSessions = openSessions.filter((session: any) => getSessionDurationMinutes(session) >= 16 * 60)
  const unidentifiedSessions = openSessions.filter((session: any) => !getCashierLabel(session, false))
  const attentionCount = openingRequests.length + pendingClosures.length + discrepancies.length + longRunningSessions.length + unidentifiedSessions.length

  const approveOpening = async (request: any) => {
    if (!db || !restaurantId || !user || !canApproveOpening || approvingId) return
    const cashier = getCashierLabel(request) || "cet utilisateur"
    if (!window.confirm(`Approuver l’ouverture de caisse pour ${cashier} ? Une nouvelle session sera ouverte.`)) return

    setApprovingId(request.id)
    try {
      await approveCashOpeningRequest({
        db,
        restaurantId,
        request,
        user,
      })
      toast({ title: "Ouverture approuvée", description: `La session de ${cashier} est maintenant ouverte.` })
    } catch (error) {
      console.error("OWNER_CASH_OPENING_APPROVAL_FAILED", error)
      toast({ title: "Approbation impossible", description: "La demande n’a pas été modifiée. Réessayez.", variant: "destructive" })
    } finally {
      setApprovingId(null)
    }
  }

  if (!restaurantId || isLoadingSessions) return <OwnerCashSkeleton />

  return (
    <main className="space-y-5 pb-24 md:pb-8">
      <DashboardHeader
        title="Caisse"
        subtitle="Suivez les sessions, les clôtures et les écarts."
        meta={restaurant?.name ? <span className="text-xs">{restaurant.name}</span> : undefined}
      />

      <OwnerCashAlerts
        openingRequests={openingRequests}
        pendingClosures={pendingClosures}
        discrepancies={discrepancies}
        longRunningSessions={longRunningSessions}
        unidentifiedSessions={unidentifiedSessions}
        canApprove={canApproveOpening}
        approvingId={approvingId}
        onApprove={approveOpening}
      />

      <DashboardSection title="Résumé des caisses" description={attentionCount > 0 ? `${attentionCount} élément(s) nécessitent votre attention.` : "Aucune décision urgente."}>
        <DashboardWidget>
          <dl className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
            <DashboardStat label="Caisses ouvertes" value={openSessions.length} tone={openSessions.length > 0 ? "positive" : "neutral"} />
            <DashboardStat label="Ouvertures en attente" value={openingRequests.length} tone={openingRequests.length > 0 ? "warning" : "neutral"} />
            <DashboardStat label="Clôtures à valider" value={pendingClosures.length} tone={pendingClosures.length > 0 ? "warning" : "neutral"} />
            <DashboardStat label="Encaissements ouverts" value={`${formatMoney(openSales)} FCFA`} />
            <DashboardStat label="Écarts détectés" value={discrepancies.length} tone={discrepancies.length > 0 ? "negative" : "positive"} />
          </dl>
        </DashboardWidget>
      </DashboardSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <OwnerOpenSessions sessions={openSessions} />
        <DashboardSection title="Clôtures et validations" description="Remises et sessions qui attendent une décision.">
          {restaurantId && user ? (
            <CashHandoverReviewPanel restaurantId={restaurantId} user={user} cashSessions={cashSessions} audience="owner" />
          ) : null}
        </DashboardSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <OwnerDiscrepancies sessions={discrepancies} />
        <OwnerRecentActivity items={recentActivity} />
      </div>

      <OwnerCashHistory sessions={history} />
    </main>
  )
}

function OwnerCashAlerts({ openingRequests, pendingClosures, discrepancies, longRunningSessions, unidentifiedSessions, canApprove, approvingId, onApprove }: any) {
  const hasAlerts = openingRequests.length || pendingClosures.length || discrepancies.length || longRunningSessions.length || unidentifiedSessions.length
  return <DashboardSection title="Décisions et alertes" aria-label="Décisions et alertes de caisse">{!hasAlerts ? <p className="flex min-h-11 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Aucune alerte de caisse actuellement.</p> : <DashboardAlertList className="lg:grid-cols-2">{openingRequests.map((request: any) => <DashboardAlert className="flex-wrap" key={`opening-${request.source}-${request.id}`} tone="warning" title="Demande d’ouverture" description={`${getCashierLabel(request) || "Utilisateur non identifié"} · ${formatDateTime(request.requestedAt || request.createdAt)}`} icon={<Clock3 />} action={canApprove ? <Button className="min-h-11" size="sm" disabled={Boolean(approvingId)} onClick={() => onApprove(request)}>{approvingId === request.id ? "Approbation…" : "Approuver"}</Button> : undefined} />)}{pendingClosures.length > 0 ? <DashboardAlert tone="warning" title={`${pendingClosures.length} clôture(s) à valider`} description="Examinez les montants déclarés et les remises ci-dessous." icon={<ShieldCheck />} /> : null}{discrepancies.length > 0 ? <DashboardAlert tone="negative" title={`${discrepancies.length} écart(s) détecté(s)`} description="Un montant déclaré diffère du montant théorique." icon={<AlertTriangle />} /> : null}{longRunningSessions.length > 0 ? <DashboardAlert tone="warning" title={`${longRunningSessions.length} session(s) ouverte(s) depuis plus de 16 h`} description="Vérifiez que ces sessions sont toujours utilisées." icon={<Clock3 />} /> : null}{unidentifiedSessions.length > 0 ? <DashboardAlert tone="negative" title="Utilisateur de caisse non identifié" description={`${unidentifiedSessions.length} session(s) doivent être examinées.`} icon={<AlertTriangle />} /> : null}</DashboardAlertList>}</DashboardSection>
}

function OwnerOpenSessions({ sessions }: { sessions: any[] }) {
  return <DashboardSection title="Sessions actuellement ouvertes" description="Situation en temps réel, indépendante du filtre historique.">{sessions.length === 0 ? <DashboardEmptyState className="min-h-24" title="Aucune caisse n’est ouverte actuellement." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{sessions.map((session) => <SessionCard key={session.id} session={session} />)}</div>}</DashboardSection>
}

function SessionCard({ session }: { session: any }) {
  const cashier = getCashierLabel(session)
  return <DashboardWidget><DashboardWidgetHeader title={session.name || session.cashRegisterName || "Caisse ouverte"} action={<StatusBadge status={session.status} />} /><div className="space-y-3 p-4"><p className="font-semibold">{cashier || "Utilisateur non identifié"}</p><dl className="grid grid-cols-2 gap-3"><DashboardStat label="Ouverture" value={formatDateTime(session.openedAt)} /><DashboardStat label="Durée" value={formatDuration(getSessionDurationMinutes(session))} /><DashboardStat label="Encaissements" value={formatSessionSales(session)} /><DashboardStat label="Paiements / commandes" value={safeCount(session.totalOrders ?? session.paymentCount)} /></dl><details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Voir le détail</summary><dl className="grid grid-cols-2 gap-3 pt-2"><DashboardStat label="Fond de caisse" value={formatOptionalAmount(session.openingBalance)} /><DashboardStat label="Espèces" value={formatOptionalAmount(session.totalCash)} /><DashboardStat label="Mobile Money" value={formatOptionalAmount(session.totalMobileMoney ?? session.totalMobile)} /><DashboardStat label="Statut" value={formatStatus(session.status)} /></dl></details></div></DashboardWidget>
}

function OwnerDiscrepancies({ sessions }: { sessions: any[] }) {
  return <DashboardSection title="Écarts et anomalies">{sessions.length === 0 ? <DashboardEmptyState className="min-h-24" title="Aucun écart de caisse détecté." /> : <div className="space-y-3">{sessions.slice(0, 5).map((session) => { const difference = getSessionDifference(session) ?? 0; return <DashboardAlert key={session.id} tone="negative" title={difference > 0 ? `Excédent de +${formatMoney(difference)} FCFA` : `Manque de −${formatMoney(Math.abs(difference))} FCFA`} description={`${getCashierLabel(session) || "Utilisateur non identifié"} · clôture ${formatDateTime(session.closedAt)}`} icon={<AlertTriangle />} /> })}</div>}</DashboardSection>
}

function OwnerRecentActivity({ items }: { items: ActivityItem[] }) {
  return <DashboardSection title="Activité récente">{items.length === 0 ? <DashboardEmptyState className="min-h-24" title="Aucune opération de caisse récente." /> : <DashboardWidget><ul className="divide-y">{items.map((item) => <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3" key={item.key}><div className="min-w-0"><p className="text-sm font-semibold">{item.label}</p><p className="truncate text-xs text-muted-foreground">{item.actor} · {formatDateTime(item.date)}</p></div>{item.amount !== null ? <span className="shrink-0 text-sm font-semibold tabular-nums">{item.amount > 0 ? "+" : item.amount < 0 ? "−" : ""}{formatMoney(Math.abs(item.amount))} FCFA</span> : <StatusBadge status={item.status} />}</li>)}</ul></DashboardWidget>}</DashboardSection>
}

function OwnerCashHistory({ sessions }: { sessions: any[] }) {
  return <DashboardSection title="Historique détaillé" description={`Période sélectionnée · ${HISTORY_LIMIT} sessions maximum`} action={<div className="max-w-full overflow-x-auto"><GlobalTimeFilterBar compact /></div>}>{sessions.length === 0 ? <DashboardEmptyState className="min-h-24" title="Aucune opération de caisse sur cette période." /> : <><div className="space-y-3 lg:hidden">{sessions.map((session) => <SessionHistoryCard key={session.id} session={session} />)}</div><div className="hidden overflow-hidden rounded-xl border lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Historique des sessions de caisse</caption><thead className="bg-muted/50"><tr><th className="px-4 py-3">Caisse</th><th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Ouverture</th><th className="px-4 py-3">Clôture</th><th className="px-4 py-3 text-right">Encaissements</th><th className="px-4 py-3 text-right">Écart</th><th className="px-4 py-3">Statut</th></tr></thead><tbody>{sessions.map((session) => <tr className="border-t" key={session.id}><td className="px-4 py-3 font-medium">{session.name || session.cashRegisterName || "Caisse"}</td><td className="px-4 py-3">{getCashierLabel(session) || "Non identifié"}</td><td className="px-4 py-3">{formatDateTime(session.openedAt)}</td><td className="px-4 py-3">{formatDateTime(session.closedAt)}</td><td className="px-4 py-3 text-right tabular-nums">{formatSessionSales(session)}</td><td className="px-4 py-3 text-right tabular-nums">{formatDifference(getSessionDifference(session))}</td><td className="px-4 py-3"><StatusBadge status={session.status} /></td></tr>)}</tbody></table></div></>}</DashboardSection>
}

function SessionHistoryCard({ session }: { session: any }) {
  const difference = getSessionDifference(session)
  return <DashboardWidget><DashboardWidgetHeader title={session.name || session.cashRegisterName || "Session de caisse"} action={<StatusBadge status={session.status} />} /><dl className="grid grid-cols-2 gap-3 p-4"><DashboardStat label="Utilisateur" value={getCashierLabel(session) || "Non identifié"} /><DashboardStat label="Clôture" value={formatDateTime(session.closedAt)} /><DashboardStat label="Encaissements" value={formatSessionSales(session)} /><DashboardStat label="Écart" value={formatDifference(difference)} tone={difference === null || difference === 0 ? "neutral" : "negative"} /></dl></DashboardWidget>
}

function StatusBadge({ status }: { status: unknown }) {
  const label = formatStatus(status)
  return <span className="inline-flex min-h-7 items-center rounded-full border px-2 text-[10px] font-semibold uppercase"><span className="sr-only">Statut : </span>{label}</span>
}

function OwnerCashSkeleton() {
  return <main className="space-y-5" aria-busy="true" aria-label="Chargement de la caisse"><div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-64" /></div><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-32 rounded-xl" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div></main>
}

type ActivityItem = { key: string; label: string; actor: string; date: unknown; amount: number | null; status: unknown }

function buildRecentActivity(sessions: any[], movements: any[]): ActivityItem[] {
  const sessionItems = sessions.flatMap((session) => {
    const actor = getCashierLabel(session) || "Utilisateur non identifié"
    const items: ActivityItem[] = []
    if (session.openedAt) items.push({ key: `${session.id}-open`, label: "Session ouverte", actor, date: session.openedAt, amount: safeAmount(session.openingBalance), status: session.status })
    if (session.closedAt) items.push({ key: `${session.id}-close`, label: "Session clôturée", actor, date: session.closedAt, amount: getSessionSales(session), status: session.status })
    if (session.validatedAt || session.managerValidatedAt) items.push({ key: `${session.id}-validated`, label: "Clôture validée", actor, date: session.validatedAt || session.managerValidatedAt, amount: null, status: "validated" })
    return items
  })
  const movementItems = movements.map((movement: any) => ({ key: `movement-${movement.id}`, label: formatMovementType(movement.type), actor: movement.staffName || movement.createdByName || "Équipe", date: movement.createdAt, amount: movement.type === "expense" || movement.type === "withdrawal" ? -safeAmount(movement.amount) : safeAmount(movement.amount), status: movement.status || "recorded" }))
  return [...sessionItems, ...movementItems].sort((a, b) => toMillis(b.date) - toMillis(a.date))
}

function getSessionDifference(session: any): number | null {
  const snapshot = session.closeSnapshot || {}
  const explicit = Number(snapshot.totalDifference ?? snapshot.diff?.total ?? session.discrepancyAmount)
  if (Number.isFinite(explicit)) return explicit
  const calculated = finiteAmount(snapshot.totalCalculated ?? snapshot.systemTotal ?? snapshot.systemTotals?.total ?? session.totalCalculated ?? session.totalConfirmed)
    ?? (hasSessionSalesData(session) ? getSessionSales(session) : null)
  const declared = finiteAmount(snapshot.declaredTotal ?? snapshot.declaredTotals?.total ?? session.declaredTotal ?? session.closingBalance)
  if (calculated === null || declared === null) return null
  return declared - calculated
}

function getSessionSales(session: any) { return safeAmount(session.totalCash) + safeAmount(session.totalMobileMoney ?? session.totalMobile) }
function hasSessionSalesData(session: any) { return finiteAmount(session.totalCash) !== null || finiteAmount(session.totalMobileMoney ?? session.totalMobile) !== null }
function finiteAmount(value: unknown) { if (value === null || value === undefined || value === "") return null; const amount = Number(value); return Number.isFinite(amount) ? Math.round(amount) : null }
function safeAmount(value: unknown) { return finiteAmount(value) ?? 0 }
function safeCount(value: unknown) { const count = Number(value); return Number.isFinite(count) && count >= 0 ? Math.round(count).toLocaleString("fr-FR") : "Indisponible" }
function formatMoney(value: number) { return safeAmount(value).toLocaleString("fr-FR") }
function formatDifference(value: number | null) { return value === null ? "Écart indisponible" : value > 0 ? `+${formatMoney(value)} FCFA (excédent)` : value < 0 ? `−${formatMoney(Math.abs(value))} FCFA (manque)` : "0 FCFA (conforme)" }
function formatSessionSales(session: any) { return hasSessionSalesData(session) ? `${formatMoney(getSessionSales(session))} FCFA` : "Montant indisponible" }
function formatOptionalAmount(value: unknown) { const amount = finiteAmount(value); return amount === null ? "Indisponible" : `${formatMoney(amount)} FCFA` }
function getCashierLabel(session: any, fallback = true) { const value = session.staffName || session.cashierName || session.userName || session.cashierEmail || null; return value || (fallback ? null : "") }
function isOpenSession(status: unknown) { return status === "open" || status === "opened" || status === "active" }
function isOpeningRequest(status: unknown) { return status === "pending" || status === "requested" || status === "request" }
function isPendingValidation(session: any) { return (session.status === "closed" || session.status === "pending_validation") && !session.validatedByManager }
function toDate(value: any) { const date = value?.toDate?.() ?? (value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : null); return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null }
function toMillis(value: unknown) { return toDate(value)?.getTime() ?? 0 }
function isInRange(value: unknown, start: Date, end: Date) { const time = toMillis(value); return time > 0 && time >= start.getTime() && time <= end.getTime() }
function sortByOpenedAt(a: any, b: any) { return toMillis(b.openedAt) - toMillis(a.openedAt) }
function sortByMostRecent(a: any, b: any) { return Math.max(toMillis(b.closedAt), toMillis(b.openedAt)) - Math.max(toMillis(a.closedAt), toMillis(a.openedAt)) }
function getSessionDurationMinutes(session: any) { const start = toMillis(session.openedAt); return start ? Math.max(0, Math.floor((Date.now() - start) / 60000)) : 0 }
function formatDuration(minutes: number) { if (!minutes) return "Indisponible"; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours} h ${rest.toString().padStart(2, "0")}` : `${rest} min` }
function formatDateTime(value: unknown) { const date = toDate(value); return date ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Indisponible" }
function formatStatus(status: unknown) { if (isOpenSession(status)) return "Ouverte"; if (status === "closed") return "Clôturée"; if (status === "pending_validation") return "À valider"; if (status === "validated") return "Validée"; if (status === "rejected") return "Refusée"; if (status === "correction_required") return "Correction demandée"; if (isOpeningRequest(status)) return "Ouverture demandée"; return "Statut indisponible" }
function formatMovementType(type: unknown) { if (type === "deposit") return "Dépôt enregistré"; if (type === "expense") return "Sortie de caisse"; if (type === "withdrawal") return "Retrait autorisé"; if (type === "transfer") return "Transfert enregistré"; return "Opération de caisse" }
