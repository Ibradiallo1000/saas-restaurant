"use client"

import * as React from "react"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  ChefHat,
  CheckCircle2,
  Clock3,
  CookingPot,
  LogOut,
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
import { KitchenAvailabilityPanel } from "@/modules/kitchen/KitchenAvailabilityPanel"

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
  const [mobileColumn, setMobileColumn] = React.useState<KitchenColumnStatus>(
    ORDER_OPERATION_STATUS.PENDING
  )
  const [workspaceTab, setWorkspaceTab] = React.useState<"orders" | "availability">("orders")
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

  const mobileTabs = React.useMemo(() => [
    { id: "pending", label: "Nouvelles", value: groupedOrders.pending.length },
    { id: "preparing", label: "Préparation", value: groupedOrders.preparing.length },
    { id: "ready", label: "Prêtes", value: groupedOrders.ready.length },
  ] satisfies Array<{ id: KitchenColumnStatus; label: string; value: number }>, [groupedOrders])

  return (
    <KitchenPage
      fullScreen
      header={
        <>
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--pos-divider)] bg-[var(--pos-panel)] px-[calc(var(--pos-gutter-x)+var(--safe-left,0px))] pb-2 pt-[calc(.5rem+var(--safe-top,0px))] pr-[calc(var(--pos-gutter-x)+var(--safe-right,0px))] shadow-[var(--shadow-dashboard-surface)] md:hidden">
            <div className="min-w-0">
              <OperationalStationIdentity
                compact
                fallbackIcon={ChefHat}
                restaurantLogoUrl={restaurant?.logoUrl}
                restaurantName={restaurant?.name}
                subtitle="Cuisine"
              />
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                Cuisine active
                <CheckCircle2 aria-hidden="true" className="size-3" />
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Déconnexion"
                title="Déconnexion"
                className="dashboard-focus-visible inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--pos-muted)] hover:text-foreground"
              >
                <LogOut aria-hidden="true" className="size-4" />
              </button>
            </div>
          </header>
          <PosHeader
            className="hidden md:block"
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
                <button type="button" onClick={handleLogout} className="dashboard-focus-visible inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-dashboard-button)] border border-[var(--pos-divider)] px-3 text-sm font-semibold hover:bg-[var(--pos-muted)]">
                  <LogOut aria-hidden="true" className="size-4" />
                  <span>Déconnexion</span>
                </button>
              </>
            }
          />
        </>
      }
    >
      <div className="-mt-[var(--kitchen-gutter-y)] flex h-[calc(100%+var(--kitchen-gutter-y))] min-h-0 flex-col gap-2 md:mt-0 md:h-full md:gap-[var(--pos-layout-gap)]">
        <div className="grid shrink-0 grid-cols-2 gap-2 py-2" role="tablist" aria-label="Espace Cuisine">
          <button type="button" role="tab" aria-selected={workspaceTab === "orders"} onClick={() => setWorkspaceTab("orders")} className={workspaceTab === "orders" ? "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-bold text-white" : "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--order-surface-muted)] px-4 text-sm font-bold"}>Commandes</button>
          <button type="button" role="tab" aria-selected={workspaceTab === "availability"} onClick={() => setWorkspaceTab("availability")} className={workspaceTab === "availability" ? "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-bold text-white" : "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--order-surface-muted)] px-4 text-sm font-bold"}>Disponibilités</button>
        </div>
        {workspaceTab === "availability" ? <div className="min-h-0 flex-1 overflow-hidden"><KitchenAvailabilityPanel restaurantId={restaurantId} orders={orders} /></div> : <>
        <div className="grid shrink-0 grid-cols-3 gap-2 py-2 md:hidden" role="tablist" aria-label="Colonnes Cuisine">
          {mobileTabs.map((tab) => {
            const activeTab = mobileColumn === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab}
                onClick={() => setMobileColumn(tab.id)}
                className={activeTab
                  ? "dashboard-focus-visible flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-2 text-xs font-bold text-white shadow-sm"
                  : "dashboard-focus-visible flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl bg-[var(--order-surface-muted)] px-2 text-xs font-bold text-[var(--dashboard-title)]"
                }
              >
                <span className="truncate">{tab.label}</span>
                <span className={activeTab ? "rounded-full bg-white/20 px-1.5 py-0.5 tabular-nums" : "rounded-full bg-[var(--dashboard-section)] px-1.5 py-0.5 tabular-nums"}>
                  {tab.value}
                </span>
              </button>
            )
          })}
        </div>

        <KitchenBoardLayout layout="stack" className="hidden min-h-0 flex-1 grid-cols-3 overflow-hidden md:grid">
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
              className="min-h-0"
            >
              {columnOrders.map((order) => (
                <KitchenOrderCard key={order.id} order={order} nowMs={nowMs} onUpdateStatus={updateStatus} isNew={enteringOrderIds.has(order.id)} />
              ))}
            </KitchenColumn>
          )
        })}
        </KitchenBoardLayout>

        <div className="min-h-0 flex-1 md:hidden">
          {(() => {
            const selectedColumn = KITCHEN_COLUMNS.find((column) => column.status === mobileColumn) ?? KITCHEN_COLUMNS[0]
            const columnOrders = groupedOrders[selectedColumn.status]
            const Icon = selectedColumn.icon
            return (
              <KitchenColumn
                id={`kitchen-mobile-${mobileColumn}`}
                title={<span className="inline-flex items-center gap-2"><Icon aria-hidden="true" className="size-5" />{selectedColumn.title}</span>}
                count={columnOrders.length}
                description={selectedColumn.emptyDescription}
                variant={selectedColumn.status}
                emptyState={<KitchenEmptyState title="Aucune commande" description={selectedColumn.emptyDescription} className="min-h-52 border-0 bg-transparent" />}
                className="h-full min-h-0"
              >
                {columnOrders.map((order) => (
                  <KitchenOrderCard key={order.id} order={order} nowMs={nowMs} onUpdateStatus={updateStatus} isNew={enteringOrderIds.has(order.id)} />
                ))}
              </KitchenColumn>
            )
          })()}
        </div>
        </>}
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
