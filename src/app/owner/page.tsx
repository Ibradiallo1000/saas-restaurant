"use client"

import * as React from "react"
import Link from "next/link"
import { addDoc, collection, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  Activity,
  ChefHat,
  AlertTriangle,
  Eye,
  Loader2,
  Wallet,
  Banknote,
  ReceiptText,
  Package,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES } from "@/lib/constants"
import { computeAnalyticsFromOrders } from "@/lib/analytics/computeAnalyticsFromOrders"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import { getOrderStatus } from "@/lib/order-lifecycle"
import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

// 🔥 IMPORT TYPE
import type { Order } from "@/types/index"

type OwnerInventoryItem = {
  id: string
  name?: string
  stockEstimated?: number
  avgDailyConsumption?: number
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
  itemMargins?: Array<{
    sales?: number
    cost?: number
    margin?: number
    missingCost?: boolean
  }>
  createdDate?: string
}

const premiumCardClass =
  "bg-white dark:bg-white/5 backdrop-blur border border-border dark:border-white/10 rounded-2xl shadow-lg hover:scale-[1.02] transition"

const sectionTitleClass = "text-sm font-black uppercase tracking-tight text-foreground md:text-xl md:font-semibold md:normal-case md:tracking-normal"

const statusColors: Record<string, string> = {
  pending: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-500/10 dark:border-orange-400/30",
  preparing: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-400/30",
  ready: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/10 dark:border-purple-400/30",
  served: "text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-500/10 dark:border-green-400/30",
}

const KITCHEN_PRODUCTION_STATUSES = ["pending", "preparing", "ready", "served"] as const

function isKitchenServedStatus(status: string | null | undefined) {
  return status === "served" || status === "picked_up" || status === "completed"
}

export default function OwnerPage() {
  return <OwnerPageContent />
}

function OwnerPageContent() {
  const db = useFirestore()
  const { restaurantId, loading } = useRestaurant()
  const {
    activeOrders,
    cashMovements,
    cashSessions,
    isLoadingOrders,
    isLoadingSessions,
    payments,
  } = useRestaurantLiveData()
  const orders = React.useMemo(() => activeOrders as Order[], [activeOrders])
  const inventoryAlertsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryAlerts"),
      where("resolved", "==", false)
    )
  }, [db, restaurantId])
  const inventoryItemsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId])
  const inventoryLogsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryLogs"),
      where("createdDate", "==", getTodayKey())
    )
  }, [db, restaurantId])
  const { data: inventoryAlerts } = useCollection<OwnerInventoryAlert>(inventoryAlertsQuery)
  const { data: inventoryItems } = useCollection<OwnerInventoryItem>(inventoryItemsQuery)
  const { data: inventoryLogs } = useCollection<OwnerInventoryLog>(inventoryLogsQuery)

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

  const analytics = computeAnalyticsFromOrders(orders)
  const finance = React.useMemo(
    () => computeOwnerFinancialOverview(payments, cashMovements, cashSessions),
    [cashMovements, cashSessions, payments]
  )
  const live = computeLiveOverview(orders)
  const isLiveLoading = isLoadingOrders || isLoadingSessions
  const inventoryOverview = React.useMemo(
    () => buildOwnerInventoryOverview(inventoryAlerts || [], inventoryItems || [], inventoryLogs || []),
    [inventoryAlerts, inventoryItems, inventoryLogs]
  )

  return (
    <main className="space-y-3 pb-20 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary md:h-6 md:w-6" />
            <h1 className="text-xl font-black uppercase tracking-tight md:text-3xl">
              Analytics
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
          Production, alertes et finance en temps reel.
        </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-600 dark:text-green-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          LIVE
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        <section className="space-y-2">
          <h2 className={sectionTitleClass}>Production cuisine</h2>
          <div className="grid grid-cols-2 gap-2">
            {KITCHEN_PRODUCTION_STATUSES.map((status) => (
              <div key={status} className={cn("rounded-xl border p-3", statusColors[status])}>
                <p className="text-[10px] font-black uppercase leading-tight">{formatStatus(status)}</p>
                <p className="mt-1 text-2xl font-black leading-none">{live.statusCounts[status] || 0}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border bg-card/95 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionTitleClass}>Alertes</h2>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black">
              {live.anomalies.length + finance.pendingValidationSessions}
            </span>
          </div>
          {live.anomalies.length + finance.pendingValidationSessions === 0 ? (
            <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              Aucune alerte critique.
            </div>
          ) : (
            <div className="grid gap-2">
              <OwnerActionAlert
                href="/manager/commandes?status=late"
                title={`${live.anomalies.length} commande(s) en retard`}
                context={live.anomalies[0] ? `Commande #${live.anomalies[0].id.slice(-6).toUpperCase()}` : "Cuisine a jour"}
                action="Voir"
                danger={live.anomalies.length > 0}
              />
              <OwnerActionAlert
                href="/manager/caisse"
                title={`${finance.pendingValidationSessions} caisse(s) a verifier`}
                context="Validation et paiement"
                action="Verifier"
                danger={finance.pendingValidationSessions > 0}
              />
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className={sectionTitleClass}>Resume financier</h2>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard title="Solde" value={`${finance.balance.toLocaleString()} FCFA`} icon={Wallet} />
            <MetricCard title="CA aujourd'hui" value={`${finance.todayRevenue.toLocaleString()} FCFA`} icon={DollarSign} />
            <MetricCard title="Depenses" value={`${finance.todayExpenses.toLocaleString()} FCFA`} icon={Banknote} />
          </div>
        </section>

        <OwnerInventorySnapshot overview={inventoryOverview} />

        <section className="space-y-2">
          <h2 className={sectionTitleClass}>Analytics secondaire</h2>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard title="Commandes" value={analytics.totalOrders} icon={Activity} />
            <MetricCard title="En cours" value={live.activeOrders} icon={ChefHat} />
            <MetricCard title="Panier moyen" value={`${finance.averageConfirmedPayment.toLocaleString()} FCFA`} icon={TrendingUp} />
            <MetricCard title="Ce mois" value={`${finance.thisMonthRevenue.toLocaleString()} FCFA`} icon={Calendar} />
          </div>
        </section>
      </div>

      <div className="hidden space-y-6 md:block">

      <section className="space-y-4">
        <h2 className={sectionTitleClass}>Vue globale</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total commandes"
          value={analytics.totalOrders}
          icon={Activity}
        />
        <MetricCard
          title="CA confirme"
          value={`${finance.confirmedRevenue.toLocaleString()} FCFA`}
          icon={DollarSign}
        />
        <MetricCard
          title="Panier moyen"
          value={`${finance.averageConfirmedPayment.toLocaleString()} FCFA`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Ce mois"
          value={`${finance.thisMonthRevenue.toLocaleString()} FCFA`}
          icon={Calendar}
        />
        </div>
      </section>

      <OwnerInventorySnapshot overview={inventoryOverview} />

      <section className="space-y-4">
        <h2 className={sectionTitleClass}>Tresorerie</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Solde reel" value={`${finance.balance.toLocaleString()} FCFA`} icon={Wallet} />
          <MetricCard title="Depenses" value={`${finance.expenses.toLocaleString()} FCFA`} icon={Banknote} />
          <MetricCard title="Transfers" value={`${finance.transfers.toLocaleString()} FCFA`} icon={ReceiptText} />
          <MetricCard title="Sessions ouvertes" value={finance.openSessions} icon={Activity} />
        </div>
        {finance.anomalies.length > 0 ? (
          <Card className={premiumCardClass}>
            <CardContent className="space-y-2 p-5">
              {finance.anomalies.map((anomaly) => (
                <div key={anomaly.type} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
                  {anomaly.label}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className={sectionTitleClass}>Temps réel</h2>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground dark:border-white/10 dark:bg-white/5">
            <Eye className="h-3.5 w-3.5" />
            {isLiveLoading ? "Sync..." : "Read only"}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Ventes live" value={`${live.liveRevenue.toLocaleString()} FCFA`} icon={TrendingUp} />
          <MetricCard title="Commandes en cours" value={live.activeOrders} icon={Activity} />
          <MetricCard title="Cuisine active" value={`${live.kitchenActive} commande(s)`} icon={ChefHat} />
          <MetricCard title="Alertes anomalies" value={live.anomalies.length} icon={AlertTriangle} />
        </div>

        <OwnerCashSessionRequests restaurantId={restaurantId} />
      </section>

      <section className="space-y-4">
        <h2 className={sectionTitleClass}>Production cuisine</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className={premiumCardClass}>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Statut cuisine</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-4">
              {KITCHEN_PRODUCTION_STATUSES.map((status) => (
                <div key={status} className={cn("rounded-xl border p-5", statusColors[status])}>
                  <p className="text-[10px] font-black uppercase">{formatStatus(status)}</p>
                  <p className="mt-2 text-2xl font-bold">{live.statusCounts[status] || 0}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className={premiumCardClass}>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Alertes anomalies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {live.anomalies.map((order) => (
                <div key={order.id} className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
                  Commande #{order.id.slice(-6).toUpperCase()} en retard ({getOrderAgeMinutes(order)} min)
                </div>
              ))}
              {live.anomalies.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune anomalie active</div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CHART + TOP */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              Évolution sur 7 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.last7Days.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted-foreground">
                    {day.label}
                  </span>

                  <div className="flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          (day.count / Math.max(1, analytics.maxDayCount)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <span className="w-8 text-right text-xs font-medium text-muted-foreground">
                    {day.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={premiumCardClass}>
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              Top produits
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {analytics.topProducts.slice(0, 5).map((product, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-5 dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-sm font-medium text-foreground">
                  {product.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {product.count} vendus
                </span>
              </div>
            ))}

            {analytics.topProducts.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Pas assez de données
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </main>
  )
}

//
// 🔥 COMPONENT METRIC
//
function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className={premiumCardClass}>
      <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-5 md:pb-2">
        <CardTitle className="text-xs font-bold text-muted-foreground md:text-sm md:font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-[var(--color-primary)]" />
      </CardHeader>

      <CardContent className="p-3 pt-0 md:p-5 md:pt-0">
        <div className="text-lg font-black leading-tight text-foreground md:text-2xl md:font-bold">
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function OwnerActionAlert({
  href,
  title,
  context,
  action,
  danger,
}: {
  href: string
  title: string
  context: string
  action: string
  danger?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 transition hover:border-primary/40 hover:bg-muted/30",
        danger && "border-red-200 bg-red-50/80 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200"
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-xs font-black">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{context}</span>
      </span>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
        {action}
      </span>
    </Link>
  )
}

function OwnerInventorySnapshot({
  overview,
}: {
  overview: ReturnType<typeof buildOwnerInventoryOverview>
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitleClass}>Stock & alertes</h2>
      </div>

      <Card className={premiumCardClass}>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3 md:p-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-xs font-black uppercase text-muted-foreground">Alertes critiques</p>
            </div>
            {overview.alerts.length > 0 ? (
              <div className="space-y-2">
                {overview.alerts.map((alert) => (
                  <p key={alert.id} className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs font-bold text-orange-800">
                    ⚠️ {formatOwnerAlert(alert)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-bold text-emerald-800">
                Aucun problème critique.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <p className="text-xs font-black uppercase text-muted-foreground">Jours restants</p>
            </div>
            {overview.daysLeft.length > 0 ? (
              <div className="space-y-2">
                {overview.daysLeft.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2 text-xs">
                    <span className="truncate font-bold">{item.name}</span>
                    <span className={cn("shrink-0 font-black", item.daysLeft < 2 ? "text-red-700" : "text-muted-foreground")}>
                      {item.daysLeft.toFixed(1)} jours
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                Pas assez de données de consommation.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-black uppercase text-muted-foreground">Résumé simple</p>
            </div>
            <div className="grid gap-2">
              <div className="rounded-lg border bg-background p-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Aujourd'hui - ventes</p>
                <p className="text-lg font-black">{overview.totalSales.toLocaleString()} FCFA</p>
              </div>
              <div className="rounded-lg border bg-background p-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Aujourd'hui - marge</p>
                <p className={cn("text-lg font-black", overview.margin >= 0 ? "text-emerald-700" : "text-red-700")}>
                  {overview.margin.toLocaleString()} FCFA
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function OwnerCashSessionRequests({ restaurantId }: { restaurantId: string }) {
  const db = useFirestore()
  const { user, role } = useTenant()
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

  return (
    <Card className={premiumCardClass}>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Demandes caisse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRequests.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucune demande en attente</div>
        ) : (
          pendingRequests.map((request: any) => (
            <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-foreground">{request.cashierName || request.cashierId}</p>
                <p className="text-xs text-muted-foreground">Ouverture de caisse</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => approve(request)}>Valider</Button>
                <Button size="sm" variant="outline" onClick={() => reject(request)}>Refuser</Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

//
// 🔥 ANALYTICS ENGINE (FIX TIMESTAMP)
//
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
      liveRevenue += Number(order.total || 0)
    }
  })

  const kitchenActive = stats.pending + stats.in_preparation + stats.ready
  const anomalies = orders.filter((order) => {
    const status = getOrderStatus(order)
    return ["pending", "preparing"].includes(status) && getOrderAgeMinutes(order) > 15
  })

  return {
    activeOrders,
    anomalies,
    kitchenActive,
    liveRevenue,
    statusCounts: stats,
  }
}

function computeOwnerFinancialOverview(payments: any[], cashMovements: any[], cashSessions: any[]) {
  const summary = getFinancialSummary({
    movements: cashMovements,
    payments,
    scope: { mode: "global", sessionId: null },
  })
  const openSessions = (cashSessions || []).filter((session) => isOpenCashSession(session.status)).length
  const pendingValidationSessions = (cashSessions || []).filter((session) => {
    return isClosedCashSession(session.status) && session.validatedByManager !== true
  }).length

  const anomalies: Array<{ type: string; label: string }> = summary.anomalies.map((anomaly) => ({
    type: anomaly.type,
    label: anomaly.label,
  }))
  if (pendingValidationSessions > 0) {
    anomalies.push({
      type: "pending_cash_validation",
      label: `${pendingValidationSessions} session(s) caisse cloturee(s) en attente de validation`,
    })
  }

  return {
    averageConfirmedPayment: summary.averageDeposit,
    balance: summary.balance,
    confirmedRevenue: summary.deposits,
    expenses: summary.expenses,
    openSessions,
    pendingValidationSessions,
    todayExpenses: summary.todayExpenses,
    todayRevenue: summary.todayDeposits,
    thisMonthRevenue: summary.thisMonthDeposits,
    transfers: summary.transfers,
    anomalies,
  }
}

function buildOwnerInventoryOverview(
  alerts: OwnerInventoryAlert[],
  items: OwnerInventoryItem[],
  logs: OwnerInventoryLog[]
) {
  const filteredAlerts = alerts
    .filter((alert) => alert.resolved !== true && ["high", "medium"].includes(String(alert.severity)))
    .sort((a, b) => getOwnerAlertRank(b.severity) - getOwnerAlertRank(a.severity))
    .slice(0, 3)

  const daysLeft = items
    .map((item) => {
      const avgDailyConsumption = Number(item.avgDailyConsumption || 0)
      const stockEstimated = Number(item.stockEstimated || 0)
      if (!Number.isFinite(avgDailyConsumption) || avgDailyConsumption <= 0) return null
      if (!Number.isFinite(stockEstimated) || stockEstimated < 0) return null

      return {
        id: item.id,
        name: getOwnerInventoryItemName(item),
        daysLeft: stockEstimated / avgDailyConsumption,
      }
    })
    .filter((item): item is { id: string; name: string; daysLeft: number } => Boolean(item))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3)

  let totalSales = 0
  let totalCost = 0

  for (const log of logs) {
    for (const item of log.itemMargins || []) {
      if (item.missingCost || Number(item.cost || 0) <= 0) continue
      totalSales += Number(item.sales || 0)
      totalCost += Number(item.cost || 0)
    }
  }

  return {
    alerts: filteredAlerts,
    daysLeft,
    totalSales: Math.round(totalSales),
    margin: Math.round(totalSales - totalCost),
  }
}

function getOwnerAlertRank(severity: OwnerInventoryAlert["severity"]) {
  if (severity === "high") return 3
  if (severity === "medium") return 2
  return 1
}

function formatOwnerAlert(alert: OwnerInventoryAlert) {
  if (alert.message?.trim()) return alert.message.trim()
  if (alert.type === "missing_cost") return "Coût non défini"
  if (alert.type === "incoherent_stock") return "Stock incohérent"
  if (alert.type === "low_stock") return "Stock critique"
  return "Alerte stock"
}

function getOwnerInventoryItemName(item: OwnerInventoryItem) {
  return typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Produit"
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isOpenCashSession(status: unknown) {
  return status === "open" || status === "active"
}

function isClosedCashSession(status: unknown) {
  return status === "closed" || status === "validated" || status === "ended"
}

function getOrderAgeMinutes(order: Order) {
  const createdAt = order.createdAt?.toDate?.().getTime?.() ?? Date.now()
  return Math.max(0, Math.floor((Date.now() - createdAt) / 60000))
}

function formatStatus(status: string) {
  if (status === "pending") return "En attente"
  if (status === "preparing" || status === "in_progress") return "Preparation"
  if (status === "ready") return "Pret"
  if (status === "served") return "Servi"
  return status
}
