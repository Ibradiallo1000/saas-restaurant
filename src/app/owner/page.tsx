"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, doc, limit, orderBy, query, updateDoc, serverTimestamp, where } from "firebase/firestore"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Banknote,
  Eye,
  Package,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlobalTimeFilterBar } from "@/components/time-filter/GlobalTimeFilterBar"
import {
  DashboardAlert,
  DashboardAlertList,
  DashboardChart,
  DashboardChartCard,
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFilters,
  DashboardHeader,
  DashboardLoadingState,
  DashboardPage,
  DashboardPanel,
  DashboardSection,
  DashboardStat,
  DashboardToolbar,
  DashboardTrend,
  DashboardWidget,
  DashboardWidgetHeader,
  MetricCard,
  MetricDelta,
  MetricGroup,
} from "@/components/dashboard-ui"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { getDateRange, getPreviousDateRange, useTimeFilter, type TimeFilterType } from "@/contexts/time-filter-context"
import { COLLECTION_NAMES } from "@/lib/constants"
import { isConfirmedFinancePayment } from "@/lib/finance/financial-summary"
import { getOrderStatus } from "@/lib/order-lifecycle"
import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { useInventoryReferential } from "@/modules/stock/shared/use-inventory-referential"

import type { Order } from "@/types/index"

type PeriodMode = TimeFilterType

type DateRange = {
  start: Date
  end: Date
}

type OwnerInventoryItem = {
  id: string
  name?: string
  quantity?: number
  referenceCost?: number
  lowStockThreshold?: number
  outOfStockThreshold?: number
  trackingMode?: "CONTROLLED" | "AUTOMATIC_SIMPLE" | "NONE"
  status?: "active" | "archived"
}

type OwnerInventoryAlert = {
  id: string
  type?: "low_stock" | "incoherent_stock" | "missing_cost"
  itemId?: string
  message?: string
  severity?: "low" | "medium" | "high"
  resolved?: boolean
}

type OwnerInventoryLog = {
  id: string
  articleId?: string
  type?: string
  variation?: number
  occurredAt?: string
  itemMargins?: Array<{
    productId?: string
    productName?: string
    sales?: number
    cost?: number
    margin?: number
    missingCost?: boolean
  }>
  createdDate?: string
  createdAt?: any
}

type Variation = {
  absolute: number
  percent: number | null
  trend: "up" | "stable" | "down" | "none"
}

type ProductStat = {
  name: string
  count: number
  revenue: number
}

type BusinessStatus = {
  label: string
  tone: "good" | "watch" | "bad"
}

const KITCHEN_PRODUCTION_STATUSES = ["pending", "preparing", "ready", "served"] as const

export default function OwnerPage() {
  return <OwnerPageContent />
}

function OwnerPageContent() {
  const db = useFirestore()
  const { restaurantId, loading } = useRestaurant()
  const { user, role } = useTenant()
  const {
    cashMovements,
    cashSessions,
    isLoadingSessions,
    payments,
  } = useRestaurantLiveData()

  const timeFilter = useTimeFilter()
  const searchParams = useSearchParams()
  const periodMode = timeFilter.type
  const filter = timeFilter.filter
  const queryRange = React.useMemo(() => getDateRange(filter), [filter])
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS),
      where("createdAt", ">=", queryRange.startDate),
      where("createdAt", "<=", queryRange.endDate),
      orderBy("createdAt", "desc"),
      limit(500)
    )
  }, [db, queryRange.endDate, queryRange.startDate, restaurantId])
  const { data: periodOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery)
  const orders = React.useMemo(() => (periodOrders || []) as Order[], [periodOrders])
  const inventoryHref = React.useMemo(
    () => getHrefWithCurrentQuery("/owner/stock", searchParams),
    [searchParams]
  )

  const {
    articles: stockItems,
    balances: stockBalances,
    costs: stockCosts,
    operations: inventoryLogs,
  } = useInventoryReferential(restaurantId, {
    includeCosts: true,
    includeOperations: true,
  })
  const inventoryItems = React.useMemo(() => {
    const quantities = new Map((stockBalances || []).map((item) => [item.articleId || item.id, Number(item.quantity || 0)]))
    const costs = new Map((stockCosts || []).map((item) => [item.articleId || item.id, Number(item.referenceCost || 0)]))
    return (stockItems || []).map((item) => ({
      ...item,
      quantity: quantities.get(item.id) || 0,
      referenceCost: costs.get(item.id) || 0,
    })) as OwnerInventoryItem[]
  }, [stockBalances, stockCosts, stockItems])

  const period = React.useMemo(
    () => buildPeriodContext(filter),
    [filter]
  )

  const business = React.useMemo(
    () =>
      buildBusinessDashboardData({
        orders,
        payments,
        cashMovements,
        cashSessions,
        inventoryAlerts: [],
        inventoryItems: inventoryItems || [],
        inventoryLogs: inventoryLogs || [],
        period,
      }),
    [cashMovements, cashSessions, inventoryItems, inventoryLogs, orders, payments, period]
  )

  const isLiveLoading = isLoadingOrders || isLoadingSessions
  const isOrdersPartial = orders.length >= 500

  if (loading) {
    return <DashboardLoadingState className="min-h-[60vh]" label="Chargement du tableau de bord" />
  }

  if (!restaurantId) {
    return <DashboardErrorState className="min-h-[60vh]" title="Compte non lié à un restaurant" description="Votre compte utilisateur ne contient pas de restaurantId." />
  }

  return (
    <DashboardPage className="px-0 py-0 pb-14 md:pb-6">
      <DashboardHeader
        title="Tableau de bord"
        subtitle="Pilotez la performance, la trésorerie et les risques du restaurant."
        meta={<>Période sélectionnée : <span className="font-semibold text-[var(--dashboard-subtitle)]">{period.label}</span>{isOrdersPartial ? " · Données commandes potentiellement partielles" : ""}</>}
        actions={<DashboardToolbar className="border-0 bg-transparent p-0 shadow-none"><DashboardFilters><GlobalTimeFilterBar compact /></DashboardFilters></DashboardToolbar>}
      />

      <OwnerDecisionOverview business={business} periodMode={periodMode} searchParams={searchParams} />

      {isOrdersPartial ? <DashboardAlert tone="warning" title="Données potentiellement partielles" description="La période a atteint la limite actuelle de 500 commandes. Les indicateurs restent calculés avec les mêmes données, mais peuvent ne pas couvrir toute la période." /> : null}
      {!business.hasPeriodData && !isLoadingOrders ? <DashboardEmptyState title="Aucune donnée pour cette période" description="Choisissez une autre période pour consulter l’activité disponible." /> : null}

      <OwnerPrimaryMetrics business={business} periodLabel={period.label} searchParams={searchParams} loading={isLoadingOrders} partial={isOrdersPartial} />

      <DashboardSection title="Évolution" description={`Tendance du chiffre d’affaires et des commandes · ${period.label}`}>
        {isLoadingOrders ? <DashboardLoadingState label="Chargement des tendances" /> : <div className="grid gap-[var(--dashboard-grid-gap)] 2xl:grid-cols-2"><OwnerTrendChart title={periodMode === "month" || periodMode === "custom" ? "Chiffre d’affaires sur la période" : "Chiffre d’affaires sur 7 jours"} points={business.trend} valueKey="revenue" partial={isOrdersPartial} /><OwnerTrendChart title={periodMode === "month" || periodMode === "custom" ? "Commandes sur la période" : "Commandes sur 7 jours"} points={business.trend} valueKey="orders" partial={isOrdersPartial} /></div>}
      </DashboardSection>

      <div className="grid gap-[var(--dashboard-section-gap)] 2xl:grid-cols-2">
        <OwnerTreasuryWidget treasury={business.treasury} periodLabel={period.label} searchParams={searchParams} />
        <OwnerInventoryWidget inventory={business.inventory} inventoryHref={inventoryHref} />
      </div>

      <OwnerAnalysisSection analysis={business.analysis} insights={business.insights} />
      <OwnerLiveSection live={business.live} loading={isLiveLoading} searchParams={searchParams} />

      <DashboardSection title="Demandes de caisse" description="Actions secondaires nécessitant une validation Owner.">
        <OwnerCashSessionRequests restaurantId={restaurantId} user={user} role={role} />
      </DashboardSection>
    </DashboardPage>
  )
}

type OwnerBusinessDashboard = ReturnType<typeof buildBusinessDashboardData>
type QueryParams = { toString(): string } | null

function OwnerDecisionOverview({ business, periodMode, searchParams }: { business: OwnerBusinessDashboard; periodMode: PeriodMode; searchParams: QueryParams }) {
  const criticalAlerts = business.alerts.slice(0, 3)
  const statusTone = business.status.tone === "good" ? "positive" : business.status.tone === "bad" ? "negative" : "warning"
  return <DashboardPanel className="grid gap-4 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
    <div className="space-y-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--dashboard-label)]">Tendance commerciale</p><p className={cn("mt-1 text-2xl font-bold", statusTone === "positive" && "text-[var(--data-positive)]", statusTone === "negative" && "text-[var(--data-negative)]", statusTone === "warning" && "text-[var(--data-warning)]")}>{business.status.label}</p><p className="mt-1 text-sm text-[var(--dashboard-muted)]">Lecture de la performance et des alertes disponibles, sans score artificiel.</p></div>
      <dl className="grid grid-cols-2 gap-3"><DashboardStat label="Tendance CA" value={getTrendLabel(business.variation.revenue.trend)} tone={statusTone} /><DashboardStat label="Alertes prioritaires" value={business.alerts.length} tone={business.alerts.length > 0 ? "negative" : "positive"} /></dl>
      {business.summary.length > 0 ? <div><h2 className="text-sm font-semibold text-[var(--dashboard-title)]">Résumé {getPeriodSummaryLabel(periodMode)}</h2><ul className="mt-2 space-y-1.5 text-sm text-[var(--dashboard-subtitle)]">{business.summary.map((line) => <li key={line}>{line}</li>)}</ul></div> : null}
    </div>
    <div><h2 className="mb-2 text-sm font-semibold text-[var(--dashboard-title)]">Attention requise</h2>{criticalAlerts.length === 0 ? <DashboardAlert title="Aucune intervention immédiate" description="Aucune alerte prioritaire n’est détectée avec les données disponibles." tone="neutral" icon={<Activity />} /> : <DashboardAlertList>{criticalAlerts.map((alert) => <DashboardAlert key={`${alert.title}-${alert.href}`} title={alert.title} description={alert.description} tone={alert.severity === "high" ? "negative" : "warning"} announce={alert.severity === "high"} icon={<AlertTriangle />} action={<Button asChild size="sm" variant="outline"><Link href={getHrefWithCurrentQuery(alert.href, searchParams)}>Consulter</Link></Button>} />)}</DashboardAlertList>}</div>
  </DashboardPanel>
}

function OwnerPrimaryMetrics({ business, loading, partial, periodLabel, searchParams }: { business: OwnerBusinessDashboard; loading: boolean; partial: boolean; periodLabel: string; searchParams: QueryParams }) {
  if (loading) return <DashboardSection title="Indicateurs principaux"><DashboardLoadingState label="Chargement des indicateurs" /></DashboardSection>
  const items = [
    { href: "/owner", label: "Chiffre d’affaires", value: formatMoney(business.current.revenue), unit: "FCFA", variation: business.variation.revenue, description: "CA encaissé ou confirmé sur la période.", icon: <TrendingUp /> },
    { href: "/owner", label: "Commandes", value: business.current.orders.toLocaleString("fr-FR"), unit: undefined, variation: business.variation.orders, description: "Commandes acquises sur la période.", icon: <ReceiptText /> },
    { href: "/owner", label: "Panier moyen", value: formatMoney(business.current.averageOrder), unit: "FCFA", variation: business.variation.averageOrder, description: "Montant moyen par commande acquise.", icon: <BarChart3 /> },
    { href: "/owner/tresorerie", label: "Trésorerie validée", value: formatMoney(business.treasury.balance), unit: "FCFA", variation: null, description: "Dépôts clôturés moins sorties.", icon: <Wallet /> },
  ]
  return <DashboardSection title="Indicateurs principaux" description={`${periodLabel}${partial ? " · données commandes potentiellement partielles" : ""}`}><MetricGroup>{items.map((item) => <Link key={item.label} href={getHrefWithCurrentQuery(item.href, searchParams)} className="rounded-[var(--radius-dashboard-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"><MetricCard className="h-full" interactive label={item.label} value={item.value} unit={item.unit} description={item.description} icon={item.icon} delta={item.variation ? <OwnerMetricDelta variation={item.variation} /> : <span className="text-xs text-[var(--dashboard-muted)]">Solde validé actuel</span>} /></Link>)}</MetricGroup></DashboardSection>
}

function OwnerMetricDelta({ variation }: { variation: Variation }) {
  if (variation.trend === "none" || variation.percent === null) return <MetricDelta value="Comparaison indisponible" context="période précédente" />
  return <MetricDelta direction={variation.trend === "up" ? "up" : variation.trend === "down" ? "down" : "flat"} tone={variation.trend === "up" ? "positive" : variation.trend === "down" ? "negative" : "neutral"} value={`${variation.absolute > 0 ? "+" : ""}${formatMoney(variation.absolute)} (${variation.percent.toFixed(1)} %)`} context="par rapport à la période précédente" />
}

function OwnerTrendChart({ title, points, valueKey, partial }: { title: string; points: Array<{ date: string; label: string; revenue: number; orders: number }>; valueKey: "revenue" | "orders"; partial: boolean }) {
  const validPoints = points.filter((point) => point[valueKey] > 0)
  const maxValue = Math.max(1, ...points.map((point) => point[valueKey]))
  const summary = validPoints.length < 2 ? "Données insuffisantes pour dégager une évolution." : `${validPoints.length} jours présentent une valeur non nulle. Valeur maximale : ${valueKey === "revenue" ? `${formatMoney(maxValue)} FCFA` : maxValue}.`
  const table = <table className="w-full text-left text-sm"><caption className="sr-only">Données de {title}</caption><thead><tr><th scope="col" className="py-2">Jour</th><th scope="col" className="py-2 text-right">Valeur</th></tr></thead><tbody>{points.map((point) => <tr key={point.date} className="border-t border-[var(--dashboard-divider)]"><th scope="row" className="py-2 font-medium">{point.label}</th><td className="py-2 text-right tabular-nums">{valueKey === "revenue" ? `${formatMoney(point.revenue)} FCFA` : point.orders}</td></tr>)}</tbody></table>
  return <DashboardChartCard title={title} description={partial ? "Valeurs potentiellement partielles : limite de 500 commandes atteinte." : "Comparaison quotidienne avec les données disponibles."}><DashboardChart label={title} description={summary} table={table}>{validPoints.length < 2 ? <DashboardEmptyState className="min-h-48" title="Évolution indisponible" description="Le graphique apparaîtra après plusieurs jours d’activité." /> : <div className="space-y-3">{points.map((point) => <DashboardTrend key={point.date} label={point.label} current={point[valueKey]} max={maxValue} value={valueKey === "revenue" ? `${formatMoney(point.revenue)} F` : point.orders} tone={valueKey === "revenue" ? "info" : "neutral"} />)}</div>}</DashboardChart></DashboardChartCard>
}

function OwnerTreasuryWidget({ treasury, periodLabel, searchParams }: { treasury: OwnerBusinessDashboard["treasury"]; periodLabel: string; searchParams: QueryParams }) {
  return <DashboardWidget><DashboardWidgetHeader title="Trésorerie" description={`Solde, mouvements et sessions · ${periodLabel}`} action={<Button asChild size="sm" variant="outline"><Link href={getHrefWithCurrentQuery("/owner/tresorerie", searchParams)}>Voir la trésorerie</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="Solde validé" value={`${formatMoney(treasury.balance)} FCFA`} tone={treasury.balance < 0 ? "negative" : "neutral"} /><DashboardStat label="Dépenses" value={`${formatMoney(treasury.expenses)} FCFA`} /><DashboardStat label="Transferts" value={`${formatMoney(treasury.transfers)} FCFA`} /><DashboardStat label="Sessions ouvertes" value={treasury.openSessions} tone={treasury.openSessions > 0 ? "warning" : "neutral"} /><p className="sm:col-span-2 text-xs text-[var(--dashboard-muted)]">Ventes des sessions ouvertes : <span className="font-semibold tabular-nums text-[var(--dashboard-subtitle)]">{formatMoney(treasury.openSessionSales)} FCFA</span> non clôturés.</p>{treasury.anomalies.length > 0 ? <DashboardAlert className="sm:col-span-2" tone="warning" title="Mouvement à vérifier" description={treasury.anomalies[0]?.label} action={<Button asChild size="sm" variant="outline"><Link href={getHrefWithCurrentQuery("/manager/caisse", searchParams)}>Consulter</Link></Button>} /> : null}</div></DashboardWidget>
}

function OwnerInventoryWidget({ inventory, inventoryHref }: { inventory: OwnerBusinessDashboard["inventory"]; inventoryHref: string }) {
  const dataIsEstimated = inventory.alerts.some((alert) => alert.type === "missing_cost")
  return <DashboardWidget><DashboardWidgetHeader title="Stock et impact business" description="Valeurs estimées à partir des stocks et coûts renseignés." action={<Button asChild size="sm" variant="outline"><Link href={inventoryHref}>Voir l’inventaire</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="Valeur estimée du stock" value={`${formatMoney(inventory.stockValue)} FCFA`} /><DashboardStat label="Coût consommé" value={`${formatMoney(inventory.consumedCost)} FCFA`} /><DashboardStat label="Pertes estimées" value={`${formatMoney(inventory.estimatedLosses)} FCFA`} tone={inventory.estimatedLosses > 0 ? "warning" : "neutral"} /><DashboardStat label="Produits critiques" value={inventory.criticalProducts} tone={inventory.criticalProducts > 0 ? "negative" : "positive"} />{dataIsEstimated ? <DashboardAlert className="sm:col-span-2" tone="warning" title="Coûts incomplets" description="Certaines estimations dépendent de coûts qui ne sont pas encore renseignés." /> : null}</div></DashboardWidget>
}

function OwnerAnalysisSection({ analysis, insights }: { analysis: OwnerBusinessDashboard["analysis"]; insights: string[] }) {
  const hasAnalysis = analysis.topProducts.length > 0 || analysis.bestDays.length > 0 || insights.length > 0
  if (!hasAnalysis) return null
  return <DashboardSection title="Analyse business" description="Les produits, jours et signaux qui expliquent la période."><div className="grid gap-[var(--dashboard-grid-gap)] xl:grid-cols-3">{analysis.topProducts.length > 0 ? <OwnerRankedWidget title="Produits les plus vendus" items={analysis.topProducts.map((item) => ({ key: item.name, label: item.name, value: `${item.count} vendu(s)` }))} /> : null}{analysis.bestDays.length > 0 ? <OwnerRankedWidget title="Jours les plus performants" items={analysis.bestDays.map((item) => ({ key: item.day, label: item.day, value: `${formatMoney(item.revenue)} FCFA` }))} /> : null}{insights.length > 0 ? <DashboardWidget><DashboardWidgetHeader title="Insights disponibles" /><ul className="space-y-2 p-4 text-sm text-[var(--dashboard-subtitle)]">{insights.map((insight) => <li key={insight} className="border-b border-[var(--dashboard-divider)] pb-2 last:border-0 last:pb-0">{insight}</li>)}</ul></DashboardWidget> : null}</div></DashboardSection>
}

function OwnerRankedWidget({ title, items }: { title: string; items: Array<{ key: string; label: string; value: string }> }) {
  return <DashboardWidget><DashboardWidgetHeader title={title} /><ol className="space-y-1 p-4">{items.map((item, index) => <li key={item.key} className="flex items-center justify-between gap-3 border-b border-[var(--dashboard-divider)] py-2 first:pt-0 last:border-0 last:pb-0"><span className="min-w-0 text-sm font-medium text-[var(--dashboard-title)]">{index + 1}. {item.label}</span><span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--dashboard-muted)]">{item.value}</span></li>)}</ol></DashboardWidget>
}

function OwnerLiveSection({ live, loading, searchParams }: { live: OwnerBusinessDashboard["live"]; loading: boolean; searchParams: QueryParams }) {
  return <DashboardSection title="Maintenant" description="Activité opérationnelle immédiate dans les données actuellement chargées." action={<span className="inline-flex min-h-10 items-center rounded-[var(--radius-dashboard-button)] border border-[var(--dashboard-border)] px-3 text-xs font-semibold text-[var(--dashboard-muted)]">{loading ? "Synchronisation…" : "En direct"}</span>}>{loading ? <DashboardLoadingState compact label="Synchronisation de l’activité en direct" /> : <div className="grid gap-[var(--dashboard-grid-gap)] sm:grid-cols-2 xl:grid-cols-4"><Link href={getHrefWithCurrentQuery("/manager/commandes", searchParams)} className="rounded-[var(--radius-dashboard-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><MetricCard interactive className="h-full" label="Commandes actives" value={live.activeOrders} description={getLiveActivityMessage(live.activeOrders)} icon={<Eye />} /></Link><Link href={getHrefWithCurrentQuery("/kitchen", searchParams)} className="rounded-[var(--radius-dashboard-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><MetricCard interactive className="h-full" label="Cuisine active" value={live.kitchenActive} description="Commandes à préparer ou servir." icon={<Activity />} /></Link><Link href={getHrefWithCurrentQuery("/manager/commandes?status=late", searchParams)} className="rounded-[var(--radius-dashboard-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><MetricCard interactive className="h-full" label="Retards" value={live.anomalies.length} description="Commandes en retard." icon={<AlertTriangle />} /></Link><MetricCard label="Valeur active" value={formatMoney(live.liveRevenue)} unit="FCFA" description="Valeur des commandes actives." icon={<Banknote />} /></div>}</DashboardSection>
}

function getHrefWithCurrentQuery(href: string, searchParams: { toString(): string } | null) {
  const queryString = searchParams?.toString()
  if (!queryString) return href
  return href.includes("?") ? `${href}&${queryString}` : `${href}?${queryString}`
}

function OwnerCashSessionRequests({
  restaurantId,
  user,
  role,
}: {
  restaurantId: string
  user: any
  role: string | null | undefined
}) {
  const db = useFirestore()
  const { cashSessionRequests, cashSessions } = useRestaurantLiveData()
  const pendingRequests = cashSessionRequests

  const approve = async (request: any) => {
    if (!db || !user) return
    const existingSession = cashSessions.find((session: any) => session.cashierId === request.cashierId)
    const sessionId = !existingSession
      ? (
          await addDoc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS), {
            restaurantId,
            cashierId: request.cashierId,
            userId: request.userId || request.cashierId,
            staffId: request.staffId || request.cashierId,
            staffName: request.staffName || request.cashierName || request.cashierId,
            staffPhone: request.staffPhone || null,
            status: "open",
            openedAt: serverTimestamp(),
            closedAt: null,
            openingBalance: 0,
            closingBalance: null,
            totalCash: 0,
            totalMobile: 0,
            totalOrders: 0,
            validatedByManager: false,
            approvedBy: user.uid,
            approvedRole: role === "owner" ? "owner" : "manager",
            requestId: request.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        ).id
      : existingSession.id

    await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests", request.id), {
      status: "approved",
      approvedAt: serverTimestamp(),
      approvedBy: user.uid,
      approvedRole: role === "owner" ? "owner" : "manager",
      sessionId,
      updatedAt: serverTimestamp(),
    })
  }

  const reject = async (request: any) => {
    if (!db || !user) return
    await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests", request.id), {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedBy: user.uid,
      updatedAt: serverTimestamp(),
    })
  }

  if (pendingRequests.length === 0) {
    return <DashboardEmptyState className="min-h-32" title="Aucune demande en attente" description="Les nouvelles demandes d’ouverture de caisse apparaîtront ici." />
  }

  return (
    <DashboardWidget>
      <DashboardWidgetHeader title="Demandes en attente" description={`${pendingRequests.length} demande(s) à traiter`} />
      <div className="space-y-2 p-4">
        {pendingRequests.map((request: any) => (
          <div key={request.id} className="flex flex-col gap-3 rounded-[var(--radius-dashboard-button)] border border-[var(--dashboard-border)] bg-[var(--dashboard-section)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--dashboard-title)]">{request.cashierName || request.cashierId}</p>
              <p className="text-xs text-[var(--dashboard-muted)]">Ouverture de caisse</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="min-h-10" size="sm" onClick={() => approve(request)}>Valider</Button>
              <Button className="min-h-10" size="sm" variant="outline" onClick={() => reject(request)}>Refuser</Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardWidget>
  )
}

function buildBusinessDashboardData({
  orders,
  payments,
  cashMovements,
  cashSessions,
  inventoryAlerts,
  inventoryItems,
  inventoryLogs,
  period,
}: {
  orders: Order[]
  payments: any[]
  cashMovements: any[]
  cashSessions: any[]
  inventoryAlerts: OwnerInventoryAlert[]
  inventoryItems: OwnerInventoryItem[]
  inventoryLogs: OwnerInventoryLog[]
  period: ReturnType<typeof buildPeriodContext>
}) {
  const currentPayments = payments.filter((payment) => isConfirmedPaymentInRange(payment, period.current))
  const previousPayments = payments.filter((payment) => isConfirmedPaymentInRange(payment, period.previous))
  const confirmedPaymentOrderIds = getConfirmedPaymentOrderIds(payments)
  const acquiredOrders = orders.filter((order) => isOwnerAcquiredOrder(order, confirmedPaymentOrderIds))
  const currentOrders = acquiredOrders.filter((order) => isDateInRange(toDate(order.createdAt), period.current))
  const previousOrders = acquiredOrders.filter((order) => isDateInRange(toDate(order.createdAt), period.previous))
  const currentMovements = cashMovements.filter((movement) => isDateInRange(toDate(movement.createdAt), period.current))

  const currentRevenue = sumBy(currentPayments, (payment) => getAmount(payment.amount))
  const previousRevenue = sumBy(previousPayments, (payment) => getAmount(payment.amount))
  const currentOrderRevenueFallback = sumBy(currentOrders, (order) => getAmount((order as any).total ?? (order as any).totalAmount))
  const previousOrderRevenueFallback = sumBy(previousOrders, (order) => getAmount((order as any).total ?? (order as any).totalAmount))
  const revenue = currentRevenue || currentOrderRevenueFallback
  const previousRevenueValue = previousRevenue || previousOrderRevenueFallback
  const averageOrder = currentOrders.length > 0 ? Math.round(revenue / currentOrders.length) : 0
  const previousAverageOrder = previousOrders.length > 0 ? Math.round(previousRevenueValue / previousOrders.length) : 0

  const inventory = buildOwnerInventoryOverview(inventoryAlerts, inventoryItems, inventoryLogs, period.current)
  const live = computeLiveOverview(acquiredOrders)
  const treasury = buildTreasuryOverview(payments, cashMovements, cashSessions, currentMovements)
  const trend = buildTrendPoints(acquiredOrders, payments, period.current)
  const analysis = buildAnalysisOverview(currentOrders)
  const variation = {
    orders: buildVariation(currentOrders.length, previousOrders.length),
    revenue: buildVariation(revenue, previousRevenueValue),
    averageOrder: buildVariation(averageOrder, previousAverageOrder),
  }
  const alerts = buildActionAlerts({ variation, inventory, live, treasury, analysis })
  const insights = buildInsights({ variation, analysis, inventory, trend })
  const status = buildBusinessStatus({ variation, alerts, live, currentOrders: currentOrders.length })
  const summary = buildDecisionSummary({ variation, inventory, live, currentOrders: currentOrders.length })
  const hasPeriodData = currentOrders.length > 0 || currentPayments.length > 0 || currentMovements.length > 0 || inventoryLogs.length > 0

  return {
    current: {
      orders: currentOrders.length,
      revenue,
      averageOrder,
    },
    variation,
    trend,
    inventory,
    treasury,
    analysis,
    alerts,
    insights,
    status,
    summary,
    hasPeriodData,
    live,
  }
}

function buildTreasuryOverview(payments: any[], cashMovements: any[], cashSessions: any[], currentMovements: any[]) {
  const balance = buildValidatedTreasuryBalance(cashMovements)
  const expenses = sumBy(currentMovements.filter((movement) => movement.type === "expense"), (movement) => getAmount(movement.amount))
  const transfers = sumBy(currentMovements.filter((movement) => movement.type === "transfer"), (movement) => getAmount(movement.amount))
  const openSessionIds = new Set(
    (cashSessions || [])
      .filter((session) => isOpenCashSession(session.status))
      .map((session) => String(session.id || "").trim())
      .filter(Boolean)
  )
  const openSessionSales = sumBy(
    payments.filter((payment) => isConfirmedPayment(payment) && openSessionIds.has(String(payment.sessionId || "").trim())),
    (payment) => getAmount(payment.amount)
  )

  return {
    balance,
    expenses,
    transfers,
    openSessions: openSessionIds.size,
    openSessionSales,
    anomalies: buildTreasuryAnomalies(balance),
  }
}

function buildOwnerInventoryOverview(
  alerts: OwnerInventoryAlert[],
  items: OwnerInventoryItem[],
  logs: OwnerInventoryLog[],
  range: DateRange
) {
  const filteredAlerts = alerts
    .filter((alert) => alert.resolved !== true && ["high", "medium"].includes(String(alert.severity)))
    .sort((a, b) => getOwnerAlertRank(b.severity) - getOwnerAlertRank(a.severity))

  const relevantLogs = logs.filter((log) => isInventoryLogInRange(log, range))
  let consumedCost = 0
  for (const log of relevantLogs) {
    for (const item of log.itemMargins || []) {
      if (item.missingCost || Number(item.cost || 0) <= 0) continue
      consumedCost += Number(item.cost || 0)
    }
  }

  const stockValue = items.reduce((total, item) => {
    const stock = Math.max(0, Number(item.quantity || 0))
    const cost = Math.max(0, Number(item.referenceCost || 0))
    return total + stock * cost
  }, 0)

  const costByArticle = new Map(items.map((item) => [item.id, Math.max(0, Number(item.referenceCost || 0))]))
  const estimatedLosses = relevantLogs.reduce((total, operation) => {
    if (operation.type !== "PERTE") return total
    return total + Math.abs(Number(operation.variation || 0)) * (costByArticle.get(String(operation.articleId)) || 0)
  }, 0)

  const criticalItemIds = new Set<string>()
  for (const alert of filteredAlerts) {
    if (alert.itemId && (alert.type === "low_stock" || alert.type === "incoherent_stock")) {
      criticalItemIds.add(alert.itemId)
    }
  }
  for (const item of items) {
    if (item.status !== "active" || item.trackingMode === "NONE") continue
    const quantity = Number(item.quantity || 0)
    if (quantity <= Number(item.lowStockThreshold || 0)) {
      criticalItemIds.add(item.id)
    }
  }

  return {
    alerts: filteredAlerts,
    consumedCost: Math.round(consumedCost),
    estimatedLosses: Math.round(estimatedLosses),
    stockValue: Math.round(stockValue),
    criticalProducts: criticalItemIds.size,
  }
}

function computeLiveOverview(orders: Order[]) {
  const activeStatuses = new Set(["pending", "preparing", "ready", "served"])
  const inPreparation = orders.filter((order) => getOrderStatus(order) === "preparing").length
  const stats = {
    pending: orders.filter((order) => getOrderStatus(order) === "pending").length,
    preparing: inPreparation,
    in_preparation: inPreparation,
    in_progress: inPreparation,
    ready: orders.filter((order) => getOrderStatus(order) === "ready").length,
    served: orders.filter((order) => isKitchenServedStatus(getOrderStatus(order))).length,
  }
  let liveRevenue = 0
  let activeOrders = 0

  orders.forEach((order) => {
    const status = getOrderStatus(order)
    if (activeStatuses.has(status)) {
      activeOrders += 1
      liveRevenue += Number((order as any).total || 0)
    }
  })

  const kitchenActive = stats.pending + stats.in_preparation + stats.ready
  const anomalies = orders.filter((order) => {
    const status = getOrderStatus(order)
    return ["pending", "preparing"].includes(status) && getOrderAgeMinutes(order) > 15
  })

  return { activeOrders, anomalies, kitchenActive, liveRevenue, statusCounts: stats }
}

function buildTrendPoints(orders: Order[], payments: any[], range: DateRange) {
  const days = enumerateDays(range)
  const points = days.map((day) => {
    const dayRange = { start: startOfDay(day), end: endOfDay(day) }
    const dayOrders = orders.filter((order) => isDateInRange(toDate(order.createdAt), dayRange))
    const dayPayments = payments.filter((payment) => isConfirmedPaymentInRange(payment, dayRange))
    const revenue = sumBy(dayPayments, (payment) => getAmount(payment.amount)) ||
      sumBy(dayOrders, (order) => getAmount((order as any).total ?? (order as any).totalAmount))
    return {
      date: getInputDateValue(day),
      label: day.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      orders: dayOrders.length,
      revenue,
    }
  })
  return points.length > 30 ? points.slice(-30) : points
}

function buildAnalysisOverview(orders: Order[]) {
  const productMap = new Map<string, ProductStat>()
  const dayMap = new Map<string, { day: string; revenue: number }>()

  for (const order of orders) {
    const orderDate = toDate(order.createdAt)
    if (orderDate) {
      const day = orderDate.toLocaleDateString("fr-FR", { weekday: "long" })
      const current = dayMap.get(day) || { day: capitalize(day), revenue: 0 }
      current.revenue += getAmount((order as any).total ?? (order as any).totalAmount)
      dayMap.set(day, current)
    }

    for (const item of order.items || []) {
      const name = item.name || "Produit"
      const current = productMap.get(name) || { name, count: 0, revenue: 0 }
      const quantity = Number(item.quantity || 0)
      current.count += quantity
      current.revenue += getAmount((item as any).total ?? item.price * quantity)
      productMap.set(name, current)
    }
  }

  return {
    topProducts: Array.from(productMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
    bestDays: Array.from(dayMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 3),
  }
}

function buildActionAlerts({
  variation,
  inventory,
  live,
  treasury,
}: {
  variation: { revenue: Variation; orders: Variation; averageOrder: Variation }
  inventory: ReturnType<typeof buildOwnerInventoryOverview>
  live: ReturnType<typeof computeLiveOverview>
  treasury: ReturnType<typeof buildTreasuryOverview>
  analysis: ReturnType<typeof buildAnalysisOverview>
}) {
  const alerts: Array<{ title: string; description: string; href: string; severity: "high" | "medium" }> = []
  if (variation.revenue.trend === "down" && variation.revenue.percent !== null && variation.revenue.percent <= -10) {
    alerts.push({
      title: "Baisse de performance",
      description: `Le chiffre d’affaires recule de ${Math.abs(variation.revenue.percent).toFixed(1)}% vs période précédente.`,
      href: "/owner",
      severity: "high",
    })
  }
  if (inventory.criticalProducts > 0) {
    alerts.push({
      title: "Stock critique",
      description: `${inventory.criticalProducts} produit(s) peuvent impacter les ventes.`,
      href: "/manager/inventory",
      severity: "high",
    })
  }
  if (inventory.estimatedLosses > 0) {
    alerts.push({
      title: "Pertes inventaire",
      description: `${formatMoney(inventory.estimatedLosses)} FCFA d’écart estimé.`,
      href: "/manager/inventory",
      severity: "medium",
    })
  }
  if (live.anomalies.length > 0) {
    alerts.push({
      title: "Retards cuisine",
      description: `${live.anomalies.length} commande(s) en retard.`,
      href: "/manager/commandes?status=late",
      severity: "high",
    })
  }
  if (treasury.anomalies.length > 0) {
    alerts.push({
      title: "Trésorerie à vérifier",
      description: treasury.anomalies[0]?.label || "Anomalie de caisse détectée.",
      href: "/manager/caisse",
      severity: "medium",
    })
  }
  return alerts.slice(0, 5)
}

function buildInsights({
  variation,
  analysis,
  inventory,
  trend,
}: {
  variation: { revenue: Variation; orders: Variation; averageOrder: Variation }
  analysis: ReturnType<typeof buildAnalysisOverview>
  inventory: ReturnType<typeof buildOwnerInventoryOverview>
  trend: Array<{ revenue: number; orders: number }>
}) {
  const insights: string[] = []
  if (variation.revenue.percent !== null && variation.revenue.trend !== "stable") {
    const direction = variation.revenue.trend === "up" ? "augmenté" : "baissé"
    insights.push(`Vos ventes ont ${direction} de ${Math.abs(variation.revenue.percent).toFixed(1)}% sur la période.`)
  }
  if (analysis.bestDays.length > 0) {
    insights.push(`${analysis.bestDays[0].day} est votre jour le plus performant sur cette période.`)
  }
  if (variation.averageOrder.percent !== null && variation.averageOrder.trend === "down") {
    insights.push(`Le panier moyen baisse de ${Math.abs(variation.averageOrder.percent).toFixed(1)}%. Vérifiez les offres ou les produits vendus.`)
  }
  if (analysis.topProducts.length > 0) {
    insights.push(`${analysis.topProducts[0].name} est le produit le plus vendu.`)
  }
  if (inventory.criticalProducts > 0) {
    insights.push(`${inventory.criticalProducts} produit(s) critiques peuvent limiter les ventes.`)
  }
  const activeTrendPoints = trend.filter((point) => point.revenue > 0)
  if (activeTrendPoints.length >= 3) {
    const last = activeTrendPoints[activeTrendPoints.length - 1]
    const before = activeTrendPoints[activeTrendPoints.length - 2]
    if (last.revenue < before.revenue) {
      insights.push("Le chiffre d’affaires du dernier jour actif est en baisse.")
    }
  }
  return insights.slice(0, 4)
}

function buildBusinessStatus({
  variation,
  alerts,
  live,
  currentOrders,
}: {
  variation: { revenue: Variation; orders: Variation; averageOrder: Variation }
  alerts: Array<{ severity: "high" | "medium" }>
  live: ReturnType<typeof computeLiveOverview>
  currentOrders: number
}): BusinessStatus {
  const hasHighAlert = alerts.some((alert) => alert.severity === "high")
  const revenueDown = variation.revenue.trend === "down" && variation.revenue.percent !== null && variation.revenue.percent <= -5
  const revenueUp = variation.revenue.trend === "up" && variation.revenue.percent !== null && variation.revenue.percent >= 5

  if (hasHighAlert || revenueDown) {
    return { label: "Problème", tone: "bad" }
  }
  if (alerts.length > 0 || currentOrders === 0 || live.activeOrders === 0 || variation.revenue.trend === "stable") {
    return { label: "À surveiller", tone: "watch" }
  }
  if (revenueUp) {
    return { label: "Bonne performance", tone: "good" }
  }
  return { label: "À surveiller", tone: "watch" }
}

function buildDecisionSummary({
  variation,
  inventory,
  live,
  currentOrders,
}: {
  variation: { revenue: Variation; orders: Variation; averageOrder: Variation }
  inventory: ReturnType<typeof buildOwnerInventoryOverview>
  live: ReturnType<typeof computeLiveOverview>
  currentOrders: number
}) {
  const lines: string[] = []

  if (variation.revenue.percent !== null) {
    if (variation.revenue.percent > 5) {
      lines.push(`✓ Ventes en hausse (+${variation.revenue.percent.toFixed(1)}%)`)
    } else if (variation.revenue.percent < -5) {
      lines.push(`⚠ Ventes en baisse (${variation.revenue.percent.toFixed(1)}%)`)
    } else {
      lines.push("✓ Ventes stables")
    }
  }

  if (variation.orders.percent !== null) {
    if (variation.orders.percent < -5) lines.push("⚠ Activité en baisse")
    else if (variation.orders.percent > 5) lines.push("✓ Activité en progression")
    else lines.push("✓ Activité stable")
  }

  if (variation.averageOrder.percent !== null) {
    if (variation.averageOrder.percent < -5) lines.push("⚠ Panier moyen en baisse")
    else if (variation.averageOrder.percent > 5) lines.push("✓ Panier moyen en amélioration")
  }

  if (inventory.criticalProducts > 0) {
    lines.push(`⚠ Attention sur ${inventory.criticalProducts} produit(s) critiques`)
  } else if (currentOrders > 0 || live.activeOrders > 0) {
    lines.push("✓ Aucun blocage stock critique détecté")
  }

  return lines.slice(0, 4)
}

function buildVariation(current: number, previous: number): Variation {
  const absolute = Math.round(current - previous)
  if (!Number.isFinite(previous) || previous <= 0) {
    return { absolute, percent: null, trend: "none" }
  }
  const percent = (absolute / previous) * 100
  const trend = Math.abs(percent) < 3 ? "stable" : percent > 0 ? "up" : "down"
  return { absolute, percent, trend }
}

function getVariationInterpretation(variation: Variation) {
  if (variation.percent === null) {
    return { label: "Analyse disponible après comparaison", className: "text-muted-foreground" }
  }
  if (variation.percent > 5) {
    return { label: "Bonne progression", className: "text-emerald-700" }
  }
  if (variation.percent < -5) {
    return { label: "Activité en baisse", className: "text-red-700" }
  }
  return { label: "Niveau stable", className: "text-amber-700" }
}

function getLiveActivityMessage(activeOrders: number) {
  if (activeOrders === 0) return "0 commande → activité faible"
  if (activeOrders <= 5) return `${activeOrders} commande(s) en cours → activité normale`
  return `${activeOrders} commandes en cours → forte activité`
}

function getPeriodSummaryLabel(mode: PeriodMode) {
  if (mode === "today") return "du jour"
  if (mode === "week") return "de la semaine"
  if (mode === "month") return "du mois"
  return "de la période"
}

function buildPeriodContext(filter: ReturnType<typeof useTimeFilter>["filter"]) {
  const currentRange = getDateRange(filter)
  const previousRange = getPreviousDateRange(filter)
  const current = { start: currentRange.startDate, end: currentRange.endDate }
  const previous = { start: previousRange.startDate, end: previousRange.endDate }

  return {
    mode: filter.type,
    current,
    previous,
    label: `${formatShortDate(current.start)} → ${formatShortDate(current.end)}`,
  }
}

function enumerateDays(range: DateRange) {
  const days: Date[] = []
  const cursor = startOfDay(range.start)
  const maxDays = 60
  while (cursor <= range.end && days.length < maxDays) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function isInventoryLogInRange(log: OwnerInventoryLog, range: DateRange) {
  if (log.occurredAt) {
    return isDateInRange(toDate(log.occurredAt), range)
  }
  if (log.createdDate) {
    const date = parseInputDate(log.createdDate)
    return isDateInRange(date, range)
  }
  return isDateInRange(toDate(log.createdAt), range)
}

function isDateInRange(date: Date | null, range: DateRange) {
  if (!date) return false
  return date >= range.start && date <= range.end
}

function toDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value.toDate === "function") return value.toDate()
  if (typeof value.toMillis === "function") return new Date(value.toMillis())
  return null
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function parseInputDate(value: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getInputDateValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}

function getAmount(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0)
}

function buildValidatedTreasuryBalance(movements: any[]) {
  return movements.reduce((balance, movement) => {
    const amount = getAmount(movement.amount)
    if (!amount) return balance

    const direction = getTreasuryMovementDirection(movement)
    if (direction === "in") return balance + amount
    if (direction === "out") return balance - amount
    return balance
  }, 0)
}

function getTreasuryMovementDirection(movement: any): "in" | "out" | "transfer" {
  if (movement.direction === "in" || movement.direction === "out" || movement.direction === "transfer") {
    return movement.direction
  }
  if (movement.type === "deposit") return "in"
  if (movement.type === "expense" || movement.type === "withdrawal") return "out"
  if (movement.type === "transfer") return "transfer"
  return "out"
}

function buildTreasuryAnomalies(balance: number) {
  if (balance >= 0) return []
  return [{
    type: "negative_validated_treasury",
    amount: Math.abs(balance),
    label: `Solde trésorerie négatif: ${formatMoney(Math.abs(balance))} FCFA à vérifier`,
  }]
}

function getConfirmedPaymentOrderIds(payments: any[]) {
  const orderIds = new Set<string>()
  for (const payment of payments) {
    if (!isConfirmedPayment(payment)) continue
    for (const orderId of getPaymentOrderIds(payment)) {
      orderIds.add(orderId)
    }
  }
  return orderIds
}

function getPaymentOrderIds(payment: any) {
  const candidates = [
    payment.orderId,
    payment.order?.id,
    payment.orderRef,
    payment.orderReference,
  ]
  if (Array.isArray(payment.orderIds)) candidates.push(...payment.orderIds)
  if (Array.isArray(payment.orders)) {
    candidates.push(...payment.orders.map((order: any) => typeof order === "string" ? order : order?.id))
  }
  return candidates.map((value) => String(value || "").trim()).filter(Boolean)
}

function isOwnerAcquiredOrder(order: Order, confirmedPaymentOrderIds: Set<string>) {
  const orderId = String((order as any).id || "").trim()
  if (orderId && confirmedPaymentOrderIds.has(orderId)) return true

  const paymentStatus = String((order as any).paymentStatus || "").toLowerCase()
  if (["paid", "validated", "verified", "paye"].includes(paymentStatus)) return true
  if (["pending", "pending_mobile", "pending_cash", "unpaid", "failed", "non_paye", "pending_verification", "partial"].includes(paymentStatus)) {
    return false
  }

  return Boolean(
    toDate((order as any).paymentValidatedAt) ||
    toDate((order as any).paidAt) ||
    toDate((order as any).paymentPaidAt) ||
    toDate((order as any).payment?.validatedAt) ||
    toDate((order as any).payment?.paidAt) ||
    toDate((order as any).timestamps?.paidAt)
  )
}

function isConfirmedPaymentInRange(payment: any, range: DateRange) {
  if (!isConfirmedPayment(payment)) return false
  return isDateInRange(getConfirmedPaymentDate(payment), range)
}

function getConfirmedPaymentDate(payment: any) {
  const businessDate = typeof payment.businessDate === "string" ? parseInputDate(payment.businessDate.slice(0, 10)) : null
  return (
    businessDate ||
    toDate(payment.confirmedAt) ||
    toDate(payment.paymentValidatedAt) ||
    toDate(payment.paidAt) ||
    toDate(payment.createdAt)
  )
}

function isConfirmedPayment(payment: any) {
  return isConfirmedFinancePayment(payment)
}

function getOwnerAlertRank(severity: OwnerInventoryAlert["severity"]) {
  if (severity === "high") return 3
  if (severity === "medium") return 2
  return 1
}

function isOpenCashSession(status: unknown) {
  return status === "open" || status === "active"
}

function isKitchenServedStatus(status: string | null | undefined) {
  return status === "served" || status === "picked_up" || status === "completed"
}

function getOrderAgeMinutes(order: Order) {
  const createdAt = toDate(order.createdAt)?.getTime() ?? Date.now()
  return Math.max(0, Math.floor((Date.now() - createdAt) / 60000))
}

function getTrendLabel(trend: Variation["trend"]) {
  if (trend === "up") return "En croissance"
  if (trend === "down") return "En baisse"
  if (trend === "stable") return "Stable"
  return "À comparer"
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
