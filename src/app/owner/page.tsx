"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, doc, query, updateDoc, serverTimestamp, where } from "firebase/firestore"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Banknote,
  Calendar,
  ChefHat,
  DollarSign,
  Eye,
  Info,
  Loader2,
  Package,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GlobalTimeFilterBar } from "@/components/time-filter/GlobalTimeFilterBar"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { getDateRange, getPreviousDateRange, useTimeFilter, type TimeFilterType } from "@/contexts/time-filter-context"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import { getOrderStatus } from "@/lib/order-lifecycle"
import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

import type { Order } from "@/types/index"

type PeriodMode = TimeFilterType

type DateRange = {
  start: Date
  end: Date
}

type OwnerInventoryItem = {
  id: string
  name?: string
  stockEstimated?: number
  avgDailyConsumption?: number
  costPerUnit?: number
  lastManualStock?: number
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

const sectionTitleClass = "text-base font-black tracking-tight md:text-xl"

const sectionStyles = {
  performance: {
    wrapper: "border-blue-200 bg-blue-50/70 dark:border-blue-400/30 dark:bg-blue-500/10",
    icon: "text-blue-700 dark:text-blue-200",
  },
  evolution: {
    wrapper: "border-sky-200 bg-sky-50/70 dark:border-sky-400/30 dark:bg-sky-500/10",
    icon: "text-sky-700 dark:text-sky-200",
  },
  alerts: {
    wrapper: "border-orange-300 bg-orange-100/80 dark:border-orange-400/40 dark:bg-orange-500/15",
    icon: "text-orange-700 dark:text-orange-200",
  },
  impact: {
    wrapper: "border-orange-200 bg-orange-50/70 dark:border-orange-400/30 dark:bg-orange-500/10",
    icon: "text-orange-700 dark:text-orange-200",
  },
  treasury: {
    wrapper: "border-green-200 bg-green-50/70 dark:border-green-400/30 dark:bg-green-500/10",
    icon: "text-green-700 dark:text-green-200",
  },
  analysis: {
    wrapper: "border-gray-200 bg-gray-50/80 dark:border-gray-400/30 dark:bg-gray-500/10",
    icon: "text-gray-700 dark:text-gray-200",
  },
  realtime: {
    wrapper: "border-purple-200 bg-purple-50/70 dark:border-purple-400/30 dark:bg-purple-500/10",
    icon: "text-purple-700 dark:text-purple-200",
  },
}

export default function OwnerPage() {
  return <OwnerPageContent />
}

function OwnerPageContent() {
  const db = useFirestore()
  const { restaurantId, loading } = useRestaurant()
  const { user, role } = useTenant()
  const {
    activeOrders,
    cashMovements,
    cashSessionRequests,
    cashSessions,
    isLoadingOrders,
    isLoadingSessions,
    payments,
  } = useRestaurantLiveData()
  const orders = React.useMemo(() => activeOrders as Order[], [activeOrders])

  const timeFilter = useTimeFilter()
  const searchParams = useSearchParams()
  const periodMode = timeFilter.type
  const filter = timeFilter.filter
  const queryRange = React.useMemo(() => getDateRange(filter), [filter])
  const inventoryHref = React.useMemo(
    () => getHrefWithCurrentQuery("/manager/inventory", searchParams),
    [searchParams]
  )

  const inventoryAlertsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryAlerts")
  }, [db, restaurantId])
  const inventoryItemsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId])
  const inventoryLogsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryLogs"),
      where("createdAt", ">=", queryRange.startDate),
      where("createdAt", "<=", queryRange.endDate)
    )
  }, [db, restaurantId, queryRange.endDate, queryRange.startDate])
  const { data: inventoryAlerts } = useCollection<OwnerInventoryAlert>(inventoryAlertsQuery)
  const { data: inventoryItems } = useCollection<OwnerInventoryItem>(inventoryItemsQuery)
  const { data: inventoryLogs } = useCollection<OwnerInventoryLog>(inventoryLogsQuery)

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
        inventoryAlerts: inventoryAlerts || [],
        inventoryItems: inventoryItems || [],
        inventoryLogs: inventoryLogs || [],
        period,
      }),
    [cashMovements, cashSessions, inventoryAlerts, inventoryItems, inventoryLogs, orders, payments, period]
  )

  const isLiveLoading = isLoadingOrders || isLoadingSessions

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!restaurantId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Compte non lié à un restaurant</h1>
          <p className="mt-2 text-muted-foreground">
            Votre compte utilisateur ne contient pas de restaurantId.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="space-y-4 pb-20 md:space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Analytics</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Centre de pilotage business : performance, stock, trésorerie et actions.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <BusinessStatusBadge status={business.status} />
          <GlobalTimeFilterBar compact />
          <p className="text-xs font-semibold text-muted-foreground">{period.label}</p>
        </div>
      </header>

      {business.summary.length > 0 ? (
        <DecisionSummary periodLabel={getPeriodSummaryLabel(periodMode)} lines={business.summary} />
      ) : null}

      {!business.hasPeriodData ? (
        <div className="rounded-2xl border border-dashed bg-card p-4 text-sm font-bold text-muted-foreground">
          Aucune donnée pour cette période
        </div>
      ) : null}

      <DashboardSection
        tone="performance"
        icon={TrendingUp}
        title="Performance"
        description="La santé commerciale de la période sélectionnée."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            href="/owner"
            title="Total commandes"
            value={business.current.orders.toLocaleString("fr-FR")}
            description="Nombre de commandes sur la période."
            variation={business.variation.orders}
          />
          <KpiCard
            href="/owner"
            title="Chiffre d’affaires"
            value={`${formatMoney(business.current.revenue)} FCFA`}
            description="CA encaissé ou confirmé sur la période."
            variation={business.variation.revenue}
          />
          <KpiCard
            href="/owner"
            title="Panier moyen"
            value={`${formatMoney(business.current.averageOrder)} FCFA`}
            description="Montant moyen par commande."
            variation={business.variation.averageOrder}
          />
          <KpiCard
            href="/manager/commandes"
            title="Statut global"
            value={getTrendLabel(business.variation.revenue.trend)}
            description="Lecture rapide de la progression du CA."
            variation={business.variation.revenue}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        tone="evolution"
        icon={BarChart3}
        title="Évolution"
        description="Tendance rapide du chiffre d’affaires et des commandes."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <TrendChart title={periodMode === "month" || periodMode === "custom" ? "CA sur la période" : "CA sur 7 jours"} points={business.trend} valueKey="revenue" />
          <TrendChart title={periodMode === "month" || periodMode === "custom" ? "Commandes sur la période" : "Commandes sur 7 jours"} points={business.trend} valueKey="orders" />
        </div>
      </DashboardSection>

      <DashboardSection
        tone="alerts"
        icon={AlertTriangle}
        title="⚠ Attention requise"
        description="Ce qui mérite une décision immédiate."
      >
        <AlertActionList alerts={business.alerts} />
      </DashboardSection>

      <DashboardSection
        tone="impact"
        icon={Package}
        title="Impact business"
        description="Impact financier du stock sur la période."
        action={<Button asChild variant="outline" size="sm"><Link href={inventoryHref}>Voir détails inventaire</Link></Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SimpleMetricCard title="Coût consommé" value={`${formatMoney(business.inventory.consumedCost)} FCFA`} description="Coût estimé des ingrédients utilisés." />
          <SimpleMetricCard title="Pertes estimées" value={`${formatMoney(business.inventory.estimatedLosses)} FCFA`} description="Écart inventaire valorisé." danger={business.inventory.estimatedLosses > 0} />
          <SimpleMetricCard title="Valeur totale du stock" value={`${formatMoney(business.inventory.stockValue)} FCFA`} description="Capital immobilisé en stock." />
          <SimpleMetricCard title="Produits critiques" value={String(business.inventory.criticalProducts)} description="Produits avec impact prioritaire." danger={business.inventory.criticalProducts > 0} />
        </div>
      </DashboardSection>

      <DashboardSection
        tone="treasury"
        icon={Wallet}
        title="Trésorerie"
        description="Argent disponible, sorties et mouvements."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SimpleMetricCard href="/manager/caisse" title="Solde réel" value={`${formatMoney(business.treasury.balance)} FCFA`} description="Encaissements moins sorties." />
          <SimpleMetricCard href="/manager/depenses" title="Dépenses" value={`${formatMoney(business.treasury.expenses)} FCFA`} description="Sorties sur la période." danger={business.treasury.expenses > 0} />
          <SimpleMetricCard href="/manager/caisse" title="Transferts" value={`${formatMoney(business.treasury.transfers)} FCFA`} description="Mouvements hors dépenses." />
          <SimpleMetricCard title="Sessions ouvertes" value={String(business.treasury.openSessions)} description="Caisses actuellement actives." />
        </div>
      </DashboardSection>

      <DashboardSection
        tone="analysis"
        icon={Activity}
        title="Analyse business"
        description="Produits et jours qui tirent la performance."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <RankedList title="Top produits vendus" empty="Aucun produit vendu sur cette période." items={business.analysis.topProducts.map((item) => ({
            key: item.name,
            label: item.name,
            value: `${item.count} vendu(s)`,
          }))} />
          <RankedList title="Jours les plus performants" empty="Pas assez de jours avec ventes." items={business.analysis.bestDays.map((item) => ({
            key: item.day,
            label: item.day,
            value: `${formatMoney(item.revenue)} FCFA`,
          }))} />
          <InsightsPanel insights={business.insights} />
        </div>
      </DashboardSection>

      <DashboardSection
        tone="realtime"
        icon={Eye}
        title="Temps réel"
        description="Ce qui se passe maintenant dans le restaurant."
        action={<span className="rounded-full border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">{isLiveLoading ? "Synchronisation..." : "Live"}</span>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SimpleMetricCard href="/manager/commandes" title="Commandes en cours" value={String(business.live.activeOrders)} description={getLiveActivityMessage(business.live.activeOrders)} danger={business.live.activeOrders === 0} />
          <SimpleMetricCard href="/kitchen" title="Cuisine active" value={String(business.live.kitchenActive)} description="Commandes à préparer ou servir." />
          <SimpleMetricCard href="/manager/commandes?status=late" title="Anomalies" value={String(business.live.anomalies.length)} description="Commandes en retard." danger={business.live.anomalies.length > 0} />
          <SimpleMetricCard title="Ventes live" value={`${formatMoney(business.live.liveRevenue)} FCFA`} description="Valeur des commandes actives." />
        </div>
        <OwnerCashSessionRequests restaurantId={restaurantId} user={user} role={role} />
      </DashboardSection>
    </main>
  )
}

function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const tone =
    status.tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : status.tone === "bad"
        ? "border-red-300 bg-red-50 text-red-700"
        : "border-orange-300 bg-orange-50 text-orange-700"

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black", tone)}>
      <span className={cn(
        "h-2 w-2 rounded-full",
        status.tone === "good" && "bg-emerald-500",
        status.tone === "watch" && "bg-orange-500",
        status.tone === "bad" && "bg-red-500"
      )} />
      {status.label}
    </div>
  )
}

function DecisionSummary({ periodLabel, lines }: { periodLabel: string; lines: string[] }) {
  if (lines.length === 0) return null

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm dark:border-blue-400/30 dark:bg-blue-500/10">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-background/80 p-2 shadow-sm">
          <Info className="h-5 w-5 text-blue-700 dark:text-blue-200" />
        </div>
        <div>
          <h2 className="text-base font-black">Résumé {periodLabel}</h2>
          <div className="mt-2 grid gap-1 text-sm font-semibold text-foreground">
            {lines.slice(0, 4).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function DashboardSection({
  tone,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  tone: keyof typeof sectionStyles
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const style = sectionStyles[tone]
  return (
    <section className={cn("space-y-4 rounded-2xl border p-4 shadow-sm", style.wrapper)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-background/80 p-2 shadow-sm">
            <Icon className={cn("h-5 w-5", style.icon)} />
          </div>
          <div>
            <h2 className={sectionTitleClass}>{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricTooltip({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Explication"
        onClick={(event) => {
          event.preventDefault()
          setOpen((value) => !value)
        }}
        onBlur={() => setOpen(false)}
        className="group inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
        <span className={cn(
          "pointer-events-none absolute right-0 top-6 z-50 w-60 rounded-lg bg-gray-950 p-3 text-left text-xs font-semibold leading-relaxed text-white opacity-0 shadow-xl transition group-hover:opacity-100",
          open && "opacity-100"
        )}>
          {text}
        </span>
      </button>
    </span>
  )
}

function KpiCard({
  href,
  title,
  value,
  description,
  variation,
}: {
  href: string
  title: string
  value: string
  description: string
  variation: Variation
}) {
  const searchParams = useSearchParams()
  const targetHref = getHrefWithCurrentQuery(href, searchParams)

  return (
    <Link href={targetHref} className="rounded-xl border bg-background p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black uppercase text-muted-foreground">{title}</p>
        <MetricTooltip text={description} />
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <VariationBadge variation={variation} />
      <p className={cn("mt-2 text-xs font-black", getVariationInterpretation(variation).className)}>
        {getVariationInterpretation(variation).label}
      </p>
    </Link>
  )
}

function SimpleMetricCard({
  href,
  title,
  value,
  description,
  danger = false,
}: {
  href?: string
  title: string
  value: string
  description: string
  danger?: boolean
}) {
  const searchParams = useSearchParams()
  const targetHref = href ? getHrefWithCurrentQuery(href, searchParams) : null
  const content = (
    <div className={cn(
      "h-full rounded-xl border bg-background p-4 shadow-sm transition",
      href && "hover:border-primary/40 hover:shadow-md",
      danger && "border-red-200 bg-red-50/80 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200"
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black uppercase text-muted-foreground">{title}</p>
        <MetricTooltip text={description} />
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
  return targetHref ? <Link href={targetHref}>{content}</Link> : content
}

function VariationBadge({ variation }: { variation: Variation }) {
  if (variation.trend === "none" || variation.percent === null) {
    return <p className="mt-2 text-xs font-bold text-muted-foreground">Comparaison indisponible</p>
  }

  const tone =
    variation.trend === "up"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : variation.trend === "down"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-orange-200 bg-orange-50 text-orange-700"
  const sign = variation.absolute > 0 ? "+" : ""
  const dot =
    variation.trend === "up"
      ? "bg-emerald-500"
      : variation.trend === "down"
        ? "bg-red-500"
        : "bg-orange-500"

  return (
    <div className={cn("mt-3 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black", tone)}>
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span>{sign}{formatMoney(variation.absolute)} ({variation.percent.toFixed(1)}%)</span>
    </div>
  )
}

function TrendChart({
  title,
  points,
  valueKey,
}: {
  title: string
  points: Array<{ date: string; label: string; revenue: number; orders: number }>
  valueKey: "revenue" | "orders"
}) {
  const validPoints = points.filter((point) => point[valueKey] > 0)
  const maxValue = Math.max(1, ...points.map((point) => point[valueKey]))

  return (
    <Card className="border bg-background">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {validPoints.length < 2 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Graphique disponible après au moins 2 points de données.
          </div>
        ) : (
          <div className="space-y-3">
            {points.map((point) => (
              <div key={point.date} className="grid grid-cols-[88px_1fr_90px] items-center gap-3">
                <span className="truncate text-xs font-bold text-muted-foreground">{point.label}</span>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (point[valueKey] / maxValue) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-xs font-black">
                  {valueKey === "revenue" ? `${formatMoney(point.revenue)} F` : point.orders}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AlertActionList({ alerts }: { alerts: Array<{ title: string; description: string; href: string; severity: "high" | "medium" }> }) {
  const searchParams = useSearchParams()

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 text-sm font-semibold text-orange-800 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-200">
        Aucune action prioritaire détectée avec les données actuelles.
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {alerts.map((alert) => (
        <Link
          key={`${alert.title}-${alert.href}`}
          href={getHrefWithCurrentQuery(alert.href, searchParams)}
          className={cn(
            "flex items-start gap-3 rounded-xl border bg-orange-50 p-4 text-orange-800 transition hover:border-primary/40 hover:shadow-md dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-200",
            alert.severity === "high" && "border-red-300 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200"
          )}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block font-black">⚠ {alert.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{alert.description}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function getHrefWithCurrentQuery(href: string, searchParams: { toString(): string } | null) {
  const queryString = searchParams?.toString()
  if (!queryString) return href
  return href.includes("?") ? `${href}&${queryString}` : `${href}?${queryString}`
}

function RankedList({
  title,
  items,
  empty,
}: {
  title: string
  items: Array<{ key: string; label: string; value: string }>
  empty: string
}) {
  return (
    <Card className="border bg-background">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item, index) => (
            <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span className="min-w-0 truncate text-sm font-black">{index + 1}. {item.label}</span>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">{item.value}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function InsightsPanel({ insights }: { insights: string[] }) {
  return (
    <Card className="border bg-background">
      <CardHeader>
        <CardTitle className="text-base">Insights automatiques</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Insights disponibles dès que la période contient assez de données.
          </p>
        ) : (
          insights.map((insight) => (
            <p key={insight} className="rounded-xl border bg-muted/30 p-3 text-sm font-semibold">
              {insight}
            </p>
          ))
        )}
      </CardContent>
    </Card>
  )
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

  if (pendingRequests.length === 0) return null

  return (
    <Card className="border bg-background">
      <CardHeader>
        <CardTitle className="text-base">Demandes caisse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRequests.map((request: any) => (
          <div key={request.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">{request.cashierName || request.cashierId}</p>
              <p className="text-xs text-muted-foreground">Ouverture de caisse</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => approve(request)}>Valider</Button>
              <Button size="sm" variant="outline" onClick={() => reject(request)}>Refuser</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
  const currentOrders = orders.filter((order) => isDateInRange(toDate(order.createdAt), period.current))
  const previousOrders = orders.filter((order) => isDateInRange(toDate(order.createdAt), period.previous))
  const currentPayments = payments.filter((payment) => isConfirmedPayment(payment) && isDateInRange(toDate(payment.createdAt), period.current))
  const previousPayments = payments.filter((payment) => isConfirmedPayment(payment) && isDateInRange(toDate(payment.createdAt), period.previous))
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
  const live = computeLiveOverview(orders)
  const treasury = buildTreasuryOverview(payments, cashMovements, cashSessions, currentMovements)
  const trend = buildTrendPoints(orders, payments, period.current)
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
  const summary = getFinancialSummary({
    movements: cashMovements,
    payments,
    scope: { mode: "global", sessionId: null },
  })
  const expenses = sumBy(currentMovements.filter((movement) => movement.type === "expense"), (movement) => getAmount(movement.amount))
  const transfers = sumBy(currentMovements.filter((movement) => movement.type === "transfer"), (movement) => getAmount(movement.amount))
  const openSessions = (cashSessions || []).filter((session) => isOpenCashSession(session.status)).length

  return {
    balance: summary.balance,
    expenses,
    transfers,
    openSessions,
    anomalies: summary.anomalies,
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
    const stock = Math.max(0, Number(item.stockEstimated || 0))
    const cost = Math.max(0, Number(item.costPerUnit || 0))
    return total + stock * cost
  }, 0)

  const estimatedLosses = items.reduce((total, item) => {
    const expected = Number(item.stockEstimated || 0)
    const real = Number(item.lastManualStock ?? expected)
    const cost = Math.max(0, Number(item.costPerUnit || 0))
    return total + Math.max(0, expected - real) * cost
  }, 0)

  const criticalItemIds = new Set<string>()
  for (const alert of filteredAlerts) {
    if (alert.itemId && (alert.type === "low_stock" || alert.type === "incoherent_stock")) {
      criticalItemIds.add(alert.itemId)
    }
  }
  for (const item of items) {
    const avgDailyConsumption = Number(item.avgDailyConsumption || 0)
    const stockEstimated = Number(item.stockEstimated || 0)
    if (avgDailyConsumption > 0 && stockEstimated >= 0 && stockEstimated / avgDailyConsumption < 2) {
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
    const dayPayments = payments.filter((payment) => isConfirmedPayment(payment) && isDateInRange(toDate(payment.createdAt), dayRange))
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
  return { label: "Niveau stable", className: "text-orange-700" }
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

function isConfirmedPayment(payment: any) {
  if (payment.status && payment.status !== "confirmed") return false
  const invalidStatus = payment.refundStatus || payment.voidStatus || payment.cancellationStatus
  if (["refunded", "voided", "cancelled", "canceled"].includes(String(invalidStatus || "").toLowerCase())) {
    return false
  }
  return !(payment.refunded === true || payment.voided === true || payment.cancelled === true || payment.canceled === true)
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
