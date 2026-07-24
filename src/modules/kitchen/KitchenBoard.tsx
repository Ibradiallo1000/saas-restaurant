"use client"

import * as React from "react"
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  CookingPot,
  LogOut,
  Maximize2,
  Minimize2,
  Utensils,
  type LucideIcon,
} from "lucide-react"

import {
  KitchenBoard as KitchenBoardLayout,
  KitchenColumn,
  KitchenEmptyState,
  KitchenHeader,
  KitchenLoadSummary,
  KitchenPage,
} from "@/components/kitchen-ui"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useAuth, useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import {
  ORDER_OPERATION_STATUS,
  type OrderOperationStatus,
  itemStatusFromOperationStatus,
  normalizeOrderItemStatus,
  normalizeOrderType,
  orderStatusFromKitchenStatus,
  toKitchenServedEventStatus,
} from "@/lib/order-lifecycle"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { KitchenOrderCard } from "@/modules/kitchen/KitchenOrderCard"
import { isKitchenPaymentDelayed } from "@/modules/kitchen/kitchen-view-model"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import { playNewOrderNotificationSound } from "@/services/notification-sound.service"
import { isKitchenItem, orderHasKitchenItems } from "@/utils/preparation-logic"

type KitchenBoardProps = {
  orders: RestaurantOrder[]
  restaurantId: string
}

type KitchenColumnStatus =
  | typeof ORDER_OPERATION_STATUS.PENDING
  | typeof ORDER_OPERATION_STATUS.IN_PREPARATION
  | typeof ORDER_OPERATION_STATUS.READY
  | typeof ORDER_OPERATION_STATUS.SERVED

const KITCHEN_JOURNAL_MARKER = "__kitchenServedToday"
const DEBUG_PICKED_UP_ORDER_ID = "MEy8U4UOHDUoJz5UVZq7"

const KITCHEN_COLUMNS: Array<{
  status: KitchenColumnStatus
  title: string
  icon: LucideIcon
  emptyDescription: string
}> = [
  {
    status: ORDER_OPERATION_STATUS.PENDING,
    title: "En attente",
    icon: Clock3,
    emptyDescription: "Les nouvelles commandes apparaîtront ici.",
  },
  {
    status: ORDER_OPERATION_STATUS.IN_PREPARATION,
    title: "En préparation",
    icon: CookingPot,
    emptyDescription: "Les commandes en préparation apparaîtront ici.",
  },
  {
    status: ORDER_OPERATION_STATUS.READY,
    title: "Prêtes",
    icon: Utensils,
    emptyDescription: "Les commandes prêtes à servir apparaîtront ici.",
  },
  {
    status: ORDER_OPERATION_STATUS.SERVED,
    title: "Servies",
    icon: CheckCircle2,
    emptyDescription: "Les commandes servies resteront visibles ici.",
  },
]

export function KitchenBoard({ orders, restaurantId }: KitchenBoardProps) {
  const db = useFirestore()
  const auth = useAuth()
  const router = useRouter()
  const { restaurant } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const previousSnapshotRef = React.useRef<Map<string, string | null | undefined>>(
    new Map()
  )
  const previousItemCountsRef = React.useRef<Map<string, number>>(new Map())
  const kitchenAlertedOrderIdsRef = React.useRef<Set<string>>(new Set())
  const ordersRef = React.useRef(orders)
  const seenOrderIdsRef = React.useRef<Set<string>>(new Set())
  const entrySoundOrderIdsRef = React.useRef<Set<string>>(new Set())
  const hasHydratedOrdersRef = React.useRef(false)
  const [enteringOrderIds, setEnteringOrderIds] = React.useState<Set<string>>(
    () => new Set()
  )
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const pageRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(document.fullscreenElement === pageRef.current)
    document.addEventListener("fullscreenchange", handleFullScreenChange)
    handleFullScreenChange()
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange)
  }, [])

  React.useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  const handleFullScreen = React.useCallback(async () => {
    try {
      if (document.fullscreenElement === pageRef.current) {
        await document.exitFullscreen()
        return
      }
      await pageRef.current?.requestFullscreen()
    } catch (error) {
      console.error(error)
      toast({
        title: "Plein écran indisponible",
        description: "Le navigateur n’a pas autorisé le passage en plein écran.",
        variant: "destructive",
      })
    }
  }, [toast])

  const kitchenOrders = React.useMemo(() => {
    debugKitchenBoardStage("received orders from OrdersProvider", orders)

    return orders
      .filter((order) => orderHasKitchenItems(order.items || []))
      .filter(shouldShowInTodayKitchen)
      .sort((a, b) => {
        const priorityDiff = getKitchenQueuePriority(a) - getKitchenQueuePriority(b)

        if (priorityDiff !== 0) return priorityDiff

        return getCreatedAtMs(a) - getCreatedAtMs(b)
      })
  }, [orders])

  const groupedOrders = React.useMemo(() => {
      const groups: Record<KitchenColumnStatus, RestaurantOrder[]> = {
        pending: [],
        preparing: [],
        ready: [],
        served: [],
      }

    kitchenOrders.forEach((order) => {
      if (!order.kitchenStatus) console.warn("Missing kitchenStatus", order.id)
      if (isKitchenServedTodayOrder(order)) {
        debugKitchenBoardColumn(order, ORDER_OPERATION_STATUS.SERVED, "journal marker")
        groups.served.push(order)
        return
      }

      const kitchenStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)

      if (
        kitchenStatus === ORDER_OPERATION_STATUS.PENDING ||
        kitchenStatus === ORDER_OPERATION_STATUS.IN_PREPARATION ||
        kitchenStatus === ORDER_OPERATION_STATUS.READY
      ) {
        debugKitchenBoardColumn(order, kitchenStatus, "active status")
        groups[kitchenStatus].push(order)
      }
    })

    debugKitchenBoardStage("after grouping", [
      ...groups.pending,
      ...groups.preparing,
      ...groups.ready,
      ...groups.served,
    ])

    return groups
  }, [kitchenOrders])

  React.useEffect(() => {
    const currentOrderIds = new Set(kitchenOrders.map((order) => order.id))
    const newOrderIds = kitchenOrders
      .map((order) => order.id)
      .filter((orderId) => !seenOrderIdsRef.current.has(orderId))

    seenOrderIdsRef.current.forEach((orderId) => {
      if (!currentOrderIds.has(orderId)) {
        seenOrderIdsRef.current.delete(orderId)
        entrySoundOrderIdsRef.current.delete(orderId)
      }
    })

    kitchenOrders.forEach((order) => {
      seenOrderIdsRef.current.add(order.id)
    })

    if (!hasHydratedOrdersRef.current) {
      hasHydratedOrdersRef.current = true
      return
    }

    const animatedOrderIds = newOrderIds.filter(Boolean)
    if (animatedOrderIds.length === 0) return

    setEnteringOrderIds((current) => {
      const next = new Set(current)
      animatedOrderIds.forEach((orderId) => next.add(orderId))
      return next
    })

    animatedOrderIds.forEach((orderId) => {
      if (entrySoundOrderIdsRef.current.has(orderId)) return
      entrySoundOrderIdsRef.current.add(orderId)
      playNewOrderNotificationSound()
    })

    const timeout = window.setTimeout(() => {
      setEnteringOrderIds((current) => {
        const next = new Set(current)
        animatedOrderIds.forEach((orderId) => next.delete(orderId))
        return next
      })
    }, 650)

    return () => window.clearTimeout(timeout)
  }, [kitchenOrders])

  React.useEffect(() => {
    if (!kitchenOrders.length) return

    const previous = previousSnapshotRef.current
    const previousItemCounts = previousItemCountsRef.current

    kitchenOrders.forEach((order) => {
      const currentPaymentStatus = getOrderPaymentStatus(order)
      const previousPaymentStatus = previous.get(order.id)
      
      const currentItemsCount = order.items?.length || 0
      const previousItemsCount = previousItemCounts.get(order.id)
      
      const shouldAlertKitchen =
        previous.has(order.id) &&
        normalizeOrderType(getKitchenOrderTypeValue(order)) !== "dine_in" &&
        previousPaymentStatus !== "verified" &&
        currentPaymentStatus === "verified" &&
        !kitchenAlertedOrderIdsRef.current.has(order.id)

      if (shouldAlertKitchen) {
        kitchenAlertedOrderIdsRef.current.add(order.id)
        triggerKitchenAlert(order, toast)
      }

      if (previousItemsCount !== undefined && currentItemsCount > previousItemsCount) {
        triggerKitchenAlert(order, toast, "Nouvel article ajouté", "Un ou plusieurs articles ont été ajoutés à cette commande.")
      }

      previous.set(order.id, currentPaymentStatus)
      previousItemCounts.set(order.id, currentItemsCount)
    })
  }, [kitchenOrders, toast])

  const updateStatus = React.useCallback(async (orderId: string, newOrderStatus: OrderOperationStatus) => {
    if (!db) return
    const order = ordersRef.current.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return

    const currentStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
    const nextItemStatus = itemStatusFromOperationStatus(newOrderStatus)
    const nextItems = (order.items || []).map((item) => {
      if (!isKitchenItem(item)) {
        return item
      }

      const itemStatus = normalizeOrderItemStatus((item as any).status ?? order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)

      if (itemStatus !== itemStatusFromOperationStatus(currentStatus)) {
        return item
      }

      return {
        ...item,
        status: nextItemStatus,
        ...(nextItemStatus === "served" ? { servedAt: new Date() } : {}),
      }
    })

    const orderRef = doc(restaurantOrdersRef(db, restaurantId), orderId)
    const historyStatus = toKitchenServedEventStatus(newOrderStatus)
    const timestampField = getKitchenTimestampField(newOrderStatus)
    await updateDoc(orderRef, {
      kitchenStatus: newOrderStatus,
      ...(timestampField ? { [`timestamps.${timestampField}`]: serverTimestamp() } : {}),
      statusHistory: arrayUnion({
        status: historyStatus,
        at: new Date(),
        source: "kitchen",
      }),
      items: nextItems,
      updatedAt: serverTimestamp(),
    })
  }, [db, restaurantId])

  const delayedCount = React.useMemo(
    () => kitchenOrders.filter((order) => isKitchenPaymentDelayed(order, nowMs)).length,
    [kitchenOrders, nowMs]
  )
  const loadMetrics = React.useMemo(() => [
    { id: "pending", label: "Nouvelles", value: groupedOrders.pending.length },
    { id: "preparing", label: "Préparation", value: groupedOrders.preparing.length },
    { id: "ready", label: "Prêtes", value: groupedOrders.ready.length, tone: "ready" as const },
    { id: "overdue", label: "Retard", value: delayedCount, tone: delayedCount ? "overdue" as const : "normal" as const },
    { id: "total", label: "Visibles", value: kitchenOrders.length },
  ], [delayedCount, groupedOrders, kitchenOrders.length])

  return (
    <KitchenPage
      ref={pageRef}
      fullScreen={isFullScreen}
      header={
        <KitchenHeader
          title={<span className="inline-flex items-center gap-2"><ChefHat aria-hidden="true" className="size-6" />Cuisine</span>}
          description={restaurant?.name || "Restaurant"}
          load={<KitchenLoadSummary items={loadMetrics} />}
          actions={
            <>
              <span className="hidden text-sm font-semibold text-[var(--dashboard-subtitle)] sm:inline">{user?.displayName || user?.email?.split("@")[0] || "Cuisine"}</span>
              <ThemeToggle />
              <button type="button" onClick={handleLogout} className="dashboard-focus-visible inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] px-3 text-sm font-semibold hover:bg-[var(--kitchen-card-muted)]">
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sr-only sm:hidden">Se déconnecter</span>
              </button>
            </>
          }
          fullScreenAction={
            <button type="button" onClick={handleFullScreen} aria-pressed={isFullScreen} className="dashboard-focus-visible inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] px-3 text-sm font-semibold hover:bg-[var(--kitchen-card-muted)]">
              {isFullScreen ? <Minimize2 aria-hidden="true" className="size-4" /> : <Maximize2 aria-hidden="true" className="size-4" />}
              <span className="hidden sm:inline">{isFullScreen ? "Quitter le plein écran" : "Plein écran"}</span>
              <span className="sr-only sm:hidden">{isFullScreen ? "Quitter le plein écran" : "Passer en plein écran"}</span>
            </button>
          }
        />
      }
    >
      <KitchenBoardLayout layout="adaptive" className="h-full overflow-y-auto md:auto-rows-[minmax(24rem,1fr)] xl:grid-cols-4 xl:auto-rows-fr xl:overflow-hidden">
        {KITCHEN_COLUMNS.map((column) => {
          const columnOrders = groupedOrders[column.status]
          const Icon = column.icon
          return (
            <KitchenColumn
              key={column.status}
              id={`kitchen-${column.status}`}
              title={<span className="inline-flex items-center gap-2"><Icon aria-hidden="true" className="size-5" />{column.title}</span>}
              count={columnOrders.length}
              description={column.emptyDescription}
              variant={column.status}
              emptyState={<KitchenEmptyState title="Aucune commande" description={column.emptyDescription} className="min-h-52 border-0 bg-transparent" />}
              className="min-h-[24rem] xl:min-h-0"
            >
              {columnOrders.map((order) => (
                <KitchenOrderCard key={order.id} order={order} nowMs={nowMs} onUpdateStatus={updateStatus} isNew={enteringOrderIds.has(order.id)} />
              ))}
            </KitchenColumn>
          )
        })}
      </KitchenBoardLayout>
    </KitchenPage>
  )
}

function getCreatedAtMs(order: RestaurantOrder) {
  return (
    order.createdAt?.toMillis?.() ??
    order.createdAt?.toDate?.().getTime?.() ??
    Date.now()
  )
}

function shouldShowInTodayKitchen(order: RestaurantOrder) {
  if (isKitchenServedTodayOrder(order)) return true

  const status = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
  return (
    status === ORDER_OPERATION_STATUS.PENDING ||
    status === ORDER_OPERATION_STATUS.IN_PREPARATION ||
    status === ORDER_OPERATION_STATUS.READY
  )
}

function isKitchenServedTodayOrder(order: RestaurantOrder) {
  return Boolean((order as any)[KITCHEN_JOURNAL_MARKER])
}

function getKitchenQueuePriority(order: RestaurantOrder) {
  const paymentStatus = (order as { paymentStatus?: string | null }).paymentStatus
  const isDineIn = normalizeOrderType(getKitchenOrderTypeValue(order)) === "dine_in"
  const isVerified = paymentStatus === "verified"

  if (!isDineIn && isVerified) return 0
  if (isDineIn) return 1

  return 2
}

function getKitchenOrderTypeValue(order: RestaurantOrder) {
  const details = order as RestaurantOrder & {
    publicOrderType?: string | null
    type?: string | null
    mode?: string | null
  }

  return order.orderType ?? details.publicOrderType ?? details.type ?? details.mode
}

function getKitchenTimestampField(status: OrderOperationStatus) {
  if (status === ORDER_OPERATION_STATUS.IN_PREPARATION) return "preparingAt"
  if (status === ORDER_OPERATION_STATUS.READY) return "readyAt"
  if (status === ORDER_OPERATION_STATUS.SERVED) return "servedAt"
  if (status === ORDER_OPERATION_STATUS.PICKED_UP) return "pickedUpAt"
  return null
}

function getOrderPaymentStatus(order: RestaurantOrder) {
  return (order as { paymentStatus?: string | null }).paymentStatus ?? null
}

function debugKitchenBoardStage(stage: string, orders: RestaurantOrder[]) {
  const matches = orders.filter((order) => order.id === DEBUG_PICKED_UP_ORDER_ID)
  if (matches.length === 0) return

  console.group(`[KitchenBoard][pickedUpAt target] ${stage}`)
  console.log("localTime", new Date().toLocaleString())
  console.log("matchCount", matches.length)
  matches.forEach((order) => {
    console.log({
      id: order.id,
      kitchenStatus: order.kitchenStatus,
      orderStatus: (order as any).orderStatus,
      status: (order as any).status,
      orderType: order.orderType,
      type: (order as any).type,
      mode: (order as any).mode,
      journalMarker: Boolean((order as any)[KITCHEN_JOURNAL_MARKER]),
      hasKitchenItems: orderHasKitchenItems(order.items || []),
      shouldShowInTodayKitchen: shouldShowInTodayKitchen(order),
      items: order.items,
      itemPreparationFields: (order.items || []).map((item: any) => ({
        preparationMode: item?.preparationMode,
        destination: item?.destination,
        productionArea: item?.productionArea,
        status: item?.status,
      })),
    })
  })
  console.groupEnd()
}

function debugKitchenBoardColumn(
  order: RestaurantOrder,
  column: KitchenColumnStatus,
  reason: string
) {
  if (order.id !== DEBUG_PICKED_UP_ORDER_ID) return

  console.group("[KitchenBoard][pickedUpAt target] column calculated")
  console.log("localTime", new Date().toLocaleString())
  console.log("orderId", order.id)
  console.log("column", column)
  console.log("reason", reason)
  console.groupEnd()
}



function triggerKitchenAlert(
  order: RestaurantOrder,
  toast: ReturnType<typeof useToast>["toast"],
  title = "Commande prete pour preparation",
  description = `${getOrderDisplayId(order)} est payee et debloquee.`
) {
  playNewOrderNotificationSound()
  toast({
    title,
    description,
  })
}
