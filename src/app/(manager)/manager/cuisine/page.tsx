"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ChefHat, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { ORDER_OPERATION_STATUS, orderStatusFromKitchenStatus } from "@/lib/order-lifecycle"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

const KITCHEN_COLUMNS = [
  { status: ORDER_OPERATION_STATUS.PENDING, label: "En attente" },
  { status: ORDER_OPERATION_STATUS.IN_PREPARATION, label: "En preparation" },
  { status: ORDER_OPERATION_STATUS.READY, label: "Pretes" },
  { status: ORDER_OPERATION_STATUS.SERVED, label: "Servies" },
]

const LATE_ORDER_THRESHOLD_MINUTES = 20

function getManagerKitchenColumnStatus(order: any) {
  if (!order.kitchenStatus) console.warn("Missing kitchenStatus", order.id)
  const status = orderStatusFromKitchenStatus(order.kitchenStatus ?? order.status ?? order.orderStatus)
  if (status === ORDER_OPERATION_STATUS.PICKED_UP || status === ORDER_OPERATION_STATUS.COMPLETED) {
    return ORDER_OPERATION_STATUS.SERVED
  }
  return status
}

export default function ManagerCuisinePage() {
  const now = useLiveNow()
  const { activeOrders, isLoadingOrders } = useRestaurantLiveData()
  const visibleKitchenOrders = React.useMemo(() => {
    return activeOrders.filter((order: any) => shouldShowInTodayKitchen(order, now))
  }, [activeOrders, now])

  const ordersByStatus = React.useMemo(() => {
    return KITCHEN_COLUMNS.reduce<Record<string, any[]>>((groups, column) => {
      groups[column.status] = visibleKitchenOrders
        .filter((order: any) => getManagerKitchenColumnStatus(order) === column.status)
        .sort((a: any, b: any) => getOrderAgeMinutes(b, now) - getOrderAgeMinutes(a, now))
      return groups
    }, {})
  }, [visibleKitchenOrders, now])

  const lateCount = visibleKitchenOrders.filter((order: any) => isLateOrder(order, now)).length

  return (
    <main className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col gap-4 overflow-hidden pb-4 md:gap-6">
      <section className="rounded-2xl border bg-card p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-primary md:text-3xl">
                Cuisine
              </h1>
              <p className="text-sm text-muted-foreground">
                Vue kanban manager en lecture seule. Les actions restent reservees au staff cuisine.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-600">
              {lateCount} retard
            </div>
            <Button asChild variant="outline" className="min-h-11 font-black">
              <Link href="/manager/commandes">Aller vers commandes</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="grid h-full min-h-0 min-w-[960px] grid-cols-4 gap-3">
        {KITCHEN_COLUMNS.map((column) => {
          const orders = ordersByStatus[column.status] || []

          return (
            <Card key={column.status} className="flex min-h-[260px] flex-col overflow-hidden xl:min-h-0">
              <CardContent className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
                <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-tight">{column.label}</h2>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-black text-muted-foreground">
                    {orders.length}
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {isLoadingOrders ? (
                  <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                    Chargement...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                    Aucune commande.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order: any) => (
                      <ReadOnlyKitchenOrderCard key={order.id} order={order} now={now} />
                    ))}
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        </div>
      </section>
    </main>
  )
}

function ReadOnlyKitchenOrderCard({ order, now }: { order: any; now: number }) {
  const minutes = getOrderAgeMinutes(order, now)
  const late = isLateOrder(order, now)
  const items = order.items || []

  return (
    <article className={`rounded-xl border bg-background p-3 shadow-sm ${late ? "border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black">{getOrderDisplayId(order)}</h3>
          <p className="text-xs font-bold uppercase text-muted-foreground">{getOrderTypeLabel(order)}</p>
        </div>
        <p className={`flex items-center gap-1 text-xs font-black ${late ? "text-red-600" : "text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" />
          {minutes} min
        </p>
      </div>

      {late ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Blocage possible
        </div>
      ) : null}

      <div className="mt-3 space-y-1 text-sm">
        {items.slice(0, 4).map((item: any) => (
          <p key={`${order.id}-${item.productId}-${item.name || item.nameSnapshot}`} className="truncate">
            {item.quantity}x {item.name || item.nameSnapshot}
          </p>
        ))}
        {items.length > 4 ? (
          <p className="text-xs font-bold text-muted-foreground">+{items.length - 4} produits</p>
        ) : null}
      </div>
    </article>
  )
}

function useLiveNow(intervalMs = 30000) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}

function getOrderAgeMinutes(order: any, now: number) {
  const createdAt = order.createdAt?.toDate?.().getTime?.() ?? now
  return Math.max(0, Math.floor((now - createdAt) / 60000))
}

function isLateOrder(order: any, now: number) {
  const status = orderStatusFromKitchenStatus(order.kitchenStatus ?? order.status ?? order.orderStatus)
  const isActionableStatus =
    status === ORDER_OPERATION_STATUS.PENDING ||
    status === ORDER_OPERATION_STATUS.IN_PREPARATION
  return isActionableStatus && getOrderAgeMinutes(order, now) > LATE_ORDER_THRESHOLD_MINUTES
}

function shouldShowInTodayKitchen(order: any, now: number) {
  const status = getManagerKitchenColumnStatus(order)
  if (status !== ORDER_OPERATION_STATUS.SERVED) return true

  const servedAt = getKitchenServedAtMs(order) ?? order.createdAt?.toDate?.().getTime?.() ?? now
  const orderDate = new Date(servedAt)
  const currentDate = new Date(now)

  return (
    orderDate.getFullYear() === currentDate.getFullYear() &&
    orderDate.getMonth() === currentDate.getMonth() &&
    orderDate.getDate() === currentDate.getDate()
  )
}

function getKitchenServedAtMs(order: any) {
  const servedAt =
    order.timestamps?.servedAt ??
    order.timestamps?.pickedUpAt ??
    order.servedAt ??
    order.pickedUpAt ??
    order.updatedAt
  const explicitTimestamp = toTimestampMs(servedAt)
  if (explicitTimestamp) return explicitTimestamp

  const history = Array.isArray(order.statusHistory) ? order.statusHistory : []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index]
    const eventStatus = orderStatusFromKitchenStatus(event?.status)
    if (eventStatus === ORDER_OPERATION_STATUS.SERVED || eventStatus === ORDER_OPERATION_STATUS.PICKED_UP) {
      const historyTimestamp = toTimestampMs(event?.at)
      if (historyTimestamp) return historyTimestamp
    }
  }

  return null
}

function toTimestampMs(value: any) {
  if (!value) return null
  if (typeof value === "number") return value
  if (value instanceof Date) return value.getTime()
  return value.toMillis?.() ?? value.toDate?.().getTime?.() ?? null
}

function getOrderTypeLabel(order: any) {
  const type = order.orderType || (order.type === "table" ? "dine_in" : order.type)
  if (type === "dine_in") return "Sur place"
  if (type === "delivery") return "Livraison"
  return "A emporter"
}
