"use client"

import * as React from "react"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  ChefHat,
  CheckCircle2,
  CalendarCheck2,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  type ServedPreparationItem,
} from "@/modules/kitchen/canonical-read"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import { playNewOrderNotificationSound } from "@/services/notification-sound.service"
import { isKitchenItem, orderHasKitchenItems } from "@/utils/preparation-logic"
import { KitchenAvailabilityPanel } from "@/modules/kitchen/KitchenAvailabilityPanel"
import { resolveStaffDisplayName, resolveStaffRoleLabel } from "@/lib/staff-identity"

type KitchenBoardProps = {
  orders: RestaurantOrder[]
  restaurantId: string
  stationName?: string
  stationSelector?: React.ReactNode
  servedItems?: ServedPreparationItem[]
  servedHistoryLoading?: boolean
  servedHistoryError?: Error | null
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

export function KitchenBoard({ orders, servedItems = [], servedHistoryLoading = false, servedHistoryError = null, restaurantId, stationName = "Cuisine principale", stationSelector }: KitchenBoardProps) {
  const auth = useAuth()
  const router = useRouter()
  const { restaurant } = useRestaurant()
  const { user, profile, role } = useTenant()
  const staffName = resolveStaffDisplayName(profile?.staffProfile, user, "Membre de l’équipe")
  const staffRole = resolveStaffRoleLabel(profile?.staffProfile?.role || role)
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
  const [workspaceTab, setWorkspaceTab] = React.useState<"orders" | "availability" | "served">("orders")
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

  const readyQuantity = React.useMemo(() => groupedOrders.ready.reduce(
    (total, currentOrder) => total + (currentOrder.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    0
  ), [groupedOrders.ready])
  const servedQuantity = React.useMemo(() => servedItems.reduce((total, item) => total + item.quantity, 0), [servedItems])

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
                subtitle={stationName}
              />
              {stationSelector ? <div className="mt-1 max-w-48">{stationSelector}</div> : null}
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                Cuisine active
                <CheckCircle2 aria-hidden="true" className="size-3" />
              </span>
            </div>
            <PreparationAccountActions staffName={staffName} staffRole={staffRole} onLogout={handleLogout} compact />
          </header>
          <PosHeader
            className="hidden md:block"
            title={
              <>
                <OperationalStationIdentity
                  fallbackIcon={ChefHat}
                  restaurantLogoUrl={restaurant?.logoUrl}
                  restaurantName={restaurant?.name}
                  subtitle={stationName}
                />
                {stationSelector ? <div className="mt-1 max-w-xs">{stationSelector}</div> : null}
              </>
            }
            sessionStatus="active"
            sessionLabel="Cuisine active"
            actions={
              <PreparationAccountActions staffName={staffName} staffRole={staffRole} onLogout={handleLogout} />
            }
          />
        </>
      }
    >
      <div className="-mt-[var(--kitchen-gutter-y)] flex h-[calc(100%+var(--kitchen-gutter-y))] min-h-0 flex-col gap-2 md:mt-0 md:h-full md:gap-[var(--pos-layout-gap)]">
        <div className="grid shrink-0 grid-cols-3 gap-2 py-2" role="tablist" aria-label="Espace Cuisine">
          <button type="button" role="tab" aria-selected={workspaceTab === "orders"} onClick={() => setWorkspaceTab("orders")} className={workspaceTab === "orders" ? "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-bold text-white" : "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--order-surface-muted)] px-4 text-sm font-bold"}>Commandes</button>
          <button type="button" role="tab" aria-selected={workspaceTab === "availability"} onClick={() => setWorkspaceTab("availability")} className={workspaceTab === "availability" ? "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-bold text-white" : "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--order-surface-muted)] px-4 text-sm font-bold"}>Disponibilités</button>
          <button type="button" role="tab" aria-selected={workspaceTab === "served"} onClick={() => setWorkspaceTab("served")} className={workspaceTab === "served" ? "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--brand-primary)] px-2 text-sm font-bold text-white" : "dashboard-focus-visible min-h-11 rounded-xl bg-[var(--order-surface-muted)] px-2 text-sm font-bold"}>Servies aujourd’hui</button>
        </div>
        {workspaceTab === "availability" ? <div className="min-h-0 flex-1 overflow-hidden"><KitchenAvailabilityPanel restaurantId={restaurantId} orders={orders} /></div> : workspaceTab === "served" ? <ServedTodayPanel items={servedItems} loading={servedHistoryLoading} error={servedHistoryError} /> : <>
        <div className="grid shrink-0 grid-cols-3 gap-2" aria-label="Compteurs du service courant">
          <PreparationCounter label="Préparées aujourd’hui" value={readyQuantity + servedQuantity} />
          <PreparationCounter label="Servies aujourd’hui" value={servedQuantity} />
          <PreparationCounter label="Encore prêtes à remettre" value={readyQuantity} />
        </div>
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

function PreparationCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--kitchen-border)] bg-[var(--kitchen-card)] px-2 py-2 text-center shadow-sm sm:px-3">
      <strong className="block text-lg font-black tabular-nums text-[var(--dashboard-title)]">{value}</strong>
      <span className="block break-words text-[10px] font-semibold leading-tight text-[var(--dashboard-muted)] sm:text-xs">{label}</span>
    </div>
  )
}

function ServedTodayPanel({ items, loading, error }: { items: ServedPreparationItem[]; loading: boolean; error: Error | null }) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--kitchen-border)] bg-[var(--kitchen-card)] p-3" aria-labelledby="served-today-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="served-today-title" className="flex items-center gap-2 font-black text-[var(--dashboard-title)]">
            <CalendarCheck2 className="size-5 shrink-0" aria-hidden="true" />
            Servies aujourd’hui
          </h2>
          <p className="text-xs text-[var(--dashboard-muted)]">Historique en lecture seule du poste sélectionné.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--order-surface-muted)] px-2.5 py-1 text-sm font-black tabular-nums">{items.reduce((total, item) => total + item.quantity, 0)}</span>
      </div>
      {loading ? <p role="status" className="py-10 text-center text-sm text-[var(--dashboard-muted)]">Chargement des lignes servies…</p> : error ? <p role="alert" className="py-10 text-center text-sm font-semibold text-destructive">Impossible de charger l’historique du jour.</p> : items.length === 0 ? <KitchenEmptyState title="Aucune ligne servie" description="Les lignes remises depuis le POS apparaîtront ici immédiatement." className="min-h-52 border-0 bg-transparent" /> : (
        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={`${item.orderId}:${item.orderItemId}`} className="min-w-0 rounded-xl border border-[var(--kitchen-border)] bg-[var(--kitchen-card-muted)] p-3">
              <div className="flex min-w-0 gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--kitchen-card)]">
                  {item.productImageUrl ? <img src={item.productImageUrl} alt="" loading="lazy" className="size-full object-cover" /> : <Utensils className="m-4 size-6 text-[var(--dashboard-muted)]" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-bold text-[var(--dashboard-title)]">{item.quantity}× {item.productName}</h3>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Servie</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--dashboard-subtitle)]">Commande {item.orderNumber}</p>
                  <p className="mt-1 break-words text-xs text-[var(--dashboard-muted)]">{formatPreparationContext(item)}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--kitchen-border)] pt-2 text-xs">
                <div><dt className="text-[var(--dashboard-muted)]">Prête à</dt><dd className="font-bold tabular-nums">{formatPreparationTime(item.preparedAt)}</dd></div>
                <div className="text-right"><dt className="text-[var(--dashboard-muted)]">Servie à</dt><dd className="font-bold tabular-nums">{formatPreparationTime(item.servedAt)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function formatPreparationContext(item: ServedPreparationItem) {
  if (item.tableNumber) return `Table ${item.tableNumber}`
  const type = normalizeOrderType(item.orderType)
  if (type === "delivery") return "Livraison"
  if (type === "pickup") return "À emporter"
  return "Sur place"
}

function formatPreparationTime(value: number) {
  if (!value) return "—"
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function PreparationAccountActions({ staffName, staffRole, onLogout, compact = false }: { staffName: string; staffRole: string; onLogout: () => void; compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ThemeToggle />
      <div className="flex min-w-0 items-center gap-1">
        <span className={compact ? "hidden max-w-32 min-w-0 flex-col text-right min-[390px]:flex" : "hidden min-w-0 flex-col text-right sm:flex"}>
          <b className={compact ? "truncate text-xs" : "max-w-48 truncate text-sm text-[var(--dashboard-subtitle)]"}>{staffName}</b>
          <small className="truncate text-[10px] text-muted-foreground sm:text-xs">{staffRole}</small>
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Se déconnecter"
                className="dashboard-focus-visible inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--pos-divider)] text-muted-foreground hover:bg-[var(--pos-muted)] hover:text-foreground"
              >
                <LogOut aria-hidden="true" className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Se déconnecter</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
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
