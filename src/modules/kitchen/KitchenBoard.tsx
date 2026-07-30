"use client"

import * as React from "react"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  ChefHat,
  Clock3,
  CookingPot,
  LogOut,
  RefreshCw,
  Utensils,
  type LucideIcon,
} from "lucide-react"

import {
  KitchenBoard as KitchenBoardLayout,
  KitchenColumn,
  KitchenEmptyState,
  KitchenPage,
} from "@/components/kitchen-ui"
import {
  OperationalMetricStrip,
  OperationalStationIdentity,
} from "@/components/operational-ui"
import { PosHeader } from "@/components/pos-ui"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useAuth } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import {
  ORDER_OPERATION_STATUS,
  type OrderOperationStatus,
  itemStatusFromOperationStatus,
  normalizeOrderItemStatus,
  normalizeOrderType,
  orderStatusFromKitchenStatus,
} from "@/lib/order-lifecycle"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { KitchenOrderCard } from "@/modules/kitchen/KitchenOrderCard"
import {
  executeKitchenItemsTransition,
  isCanonicalKitchenBoardOrder,
} from "@/modules/kitchen/canonical-read"
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
]

export function KitchenBoard({ orders, restaurantId }: KitchenBoardProps) {
  const auth = useAuth()
  const router = useRouter()
  const { restaurant } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const previousItemCountsRef = React.useRef<Map<string, number>>(new Map())
  const ordersRef = React.useRef(orders)
  const seenOrderIdsRef = React.useRef<Set<string>>(new Set())
  const entrySoundOrderIdsRef = React.useRef<Set<string>>(new Set())
  const hasHydratedOrdersRef = React.useRef(false)
  const [enteringOrderIds, setEnteringOrderIds] = React.useState<Set<string>>(
    () => new Set()
  )
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  React.useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  const kitchenOrders = React.useMemo(() => {
    debugKitchenBoardStage("received orders from OrdersProvider", orders)

    return orders
      .filter((order) => orderHasKitchenItems(order.items || []))
      .filter(shouldShowInTodayKitchen)
      .sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b))
  }, [orders])

  const groupedOrders = React.useMemo(() => {
      const groups: Record<KitchenColumnStatus, RestaurantOrder[]> = {
        pending: [],
        preparing: [],
        ready: [],
      }

    kitchenOrders.forEach((order) => {
      if (!order.kitchenStatus) console.warn("Missing kitchenStatus", order.id)
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

    const previousItemCounts = previousItemCountsRef.current

    kitchenOrders.forEach((order) => {
      const currentItemsCount = order.items?.length || 0
      const previousItemsCount = previousItemCounts.get(order.id)

      if (previousItemsCount !== undefined && currentItemsCount > previousItemsCount) {
        triggerKitchenAlert(order, toast, "Nouvel article ajouté", "Un ou plusieurs articles ont été ajoutés à cette commande.")
      }

      previousItemCounts.set(order.id, currentItemsCount)
    })
  }, [kitchenOrders, toast])

  const updateStatus = React.useCallback(async (orderId: string, newOrderStatus: OrderOperationStatus) => {
    if (!user) return
    if (
      newOrderStatus !== ORDER_OPERATION_STATUS.IN_PREPARATION &&
      newOrderStatus !== ORDER_OPERATION_STATUS.READY
    ) {
      throw new Error("KITCHEN_COMMAND_FORBIDDEN")
    }
    const order = ordersRef.current.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return

    const currentStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
    const targetStatus = itemStatusFromOperationStatus(newOrderStatus)
    if (targetStatus !== "preparing" && targetStatus !== "ready") {
      throw new Error("KITCHEN_COMMAND_FORBIDDEN")
    }
    const canonicalOrderId = isCanonicalKitchenBoardOrder(order)
      ? order.__canonicalOrderId
      : order.id
    const eligibleItems = (order.items || []).filter((item) => {
      if (!isKitchenItem(item)) return false
      return normalizeOrderItemStatus(
        (item as any).status ??
        order.kitchenStatus ??
        (order as any).status ??
        (order as any).orderStatus
      ) === itemStatusFromOperationStatus(currentStatus)
    })
    await executeKitchenItemsTransition({
      user,
      restaurantId,
      orderId: canonicalOrderId,
      targetStatus,
      items: eligibleItems.map((item, index) => ({
        orderItemId: String(
          (item as any).orderItemId ??
          (item as any).id ??
          `${(item as any).productId ?? "item"}-${index}`
        ),
        expectedVersion: Number((item as any).version ?? 1),
      })),
    })
  }, [restaurantId, user])

  const loadMetrics = React.useMemo(() => [
    { id: "pending", label: "Nouvelles", value: groupedOrders.pending.length },
    { id: "preparing", label: "Préparation", value: groupedOrders.preparing.length },
    { id: "ready", label: "Prêtes", value: groupedOrders.ready.length, tone: "positive" as const },
    { id: "total", label: "Visibles", value: kitchenOrders.length },
  ], [groupedOrders, kitchenOrders.length])

  return (
    <KitchenPage
      header={
        <PosHeader
          title={
            <OperationalStationIdentity
              fallbackIcon={ChefHat}
              restaurantLogoUrl={restaurant?.logoUrl}
              restaurantName={restaurant?.name}
              subtitle="Cuisine"
            />
          }
          sessionStatus="active"
          sessionLabel="Cuisine active"
          actions={
            <>
              <span className="hidden text-sm font-semibold text-[var(--dashboard-subtitle)] sm:inline">
                {user?.displayName || user?.email?.split("@")[0] || "Cuisine01"}
              </span>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => router.refresh()}
                aria-label="Actualiser la Cuisine"
                title="Actualiser"
                className="dashboard-focus-visible inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-dashboard-button)] border border-[var(--pos-divider)] hover:bg-[var(--pos-muted)]"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
              </button>
              <button type="button" onClick={handleLogout} className="dashboard-focus-visible inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-dashboard-button)] border border-[var(--pos-divider)] px-3 text-sm font-semibold hover:bg-[var(--pos-muted)]">
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sr-only sm:hidden">Se déconnecter</span>
              </button>
            </>
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-[var(--pos-layout-gap)]">
        <OperationalMetricStrip items={loadMetrics} label="Indicateurs de production Cuisine" />
        <KitchenBoardLayout layout="adaptive" className="min-h-0 flex-1 overflow-y-auto md:auto-rows-[minmax(24rem,1fr)] xl:grid-cols-3 xl:auto-rows-fr xl:overflow-hidden">
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
      </div>
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
  const status = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
  return (
    status === ORDER_OPERATION_STATUS.PENDING ||
    status === ORDER_OPERATION_STATUS.IN_PREPARATION ||
    status === ORDER_OPERATION_STATUS.READY
  )
}

function getKitchenOrderTypeValue(order: RestaurantOrder) {
  const details = order as RestaurantOrder & {
    publicOrderType?: string | null
    type?: string | null
    mode?: string | null
  }

  return order.orderType ?? details.publicOrderType ?? details.type ?? details.mode
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
