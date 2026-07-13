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
  Inbox,
  LogOut,
  Utensils,
  type LucideIcon,
} from "lucide-react"

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
import { cn } from "@/lib/utils"
import { KitchenOrderCard } from "@/modules/kitchen/KitchenOrderCard"
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

const KITCHEN_COLUMNS: Array<{
  status: KitchenColumnStatus
  title: string
  icon: LucideIcon
  shellClass: string
  iconClass: string
  badgeClass: string
  emptyDescription: string
}> = [
  {
    status: ORDER_OPERATION_STATUS.PENDING,
    title: "En attente",
    icon: Clock3,
    shellClass: "border-slate-200/80 bg-slate-50/90 dark:border-slate-700/70 dark:bg-slate-900/45",
    iconClass: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    badgeClass: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-100",
    emptyDescription: "Les nouvelles commandes apparaîtront ici.",
  },
  {
    status: ORDER_OPERATION_STATUS.IN_PREPARATION,
    title: "En préparation",
    icon: CookingPot,
    shellClass: "border-orange-200/70 bg-orange-50/55 dark:border-orange-500/20 dark:bg-orange-500/10",
    iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
    emptyDescription: "Les commandes en préparation apparaîtront ici.",
  },
  {
    status: ORDER_OPERATION_STATUS.READY,
    title: "Prêtes",
    icon: Utensils,
    shellClass: "border-emerald-200/70 bg-emerald-50/55 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    emptyDescription: "Les commandes prêtes à servir apparaîtront ici.",
  },
  {
    status: ORDER_OPERATION_STATUS.SERVED,
    title: "Servies",
    icon: CheckCircle2,
    shellClass: "border-sky-200/70 bg-sky-50/55 dark:border-sky-500/20 dark:bg-sky-500/10",
    iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
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

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  const kitchenOrders = React.useMemo(() => {
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
      const kitchenStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)

      if (kitchenStatus !== ORDER_OPERATION_STATUS.COMPLETED) {
        const columnStatus =
          kitchenStatus === ORDER_OPERATION_STATUS.PICKED_UP
            ? ORDER_OPERATION_STATUS.SERVED
            : kitchenStatus
        groups[columnStatus].push(order)
      }
    })

    return groups
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
        normalizeOrderType(order.orderType) !== "dine_in" &&
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

  const updateStatus = async (orderId: string, newOrderStatus: OrderOperationStatus) => {
    if (!db) return
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
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
  }

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between bg-primary px-6 text-white">
        {/* LEFT */}
        <div className="flex items-center gap-3">
          {restaurant?.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant?.name || "Restaurant"}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
              <ChefHat className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-black">
              {restaurant?.name || "Restaurant"}
            </p>
            <p className="text-xs font-bold text-white/70 uppercase tracking-wide">
              CUISINE
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-black uppercase text-white sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            service actif
          </div>

          {/* THEME */}
          <div className="[&_button]:text-white [&_button:hover]:bg-white/15 [&_button:hover]:text-white">
            <ThemeToggle />
          </div>

          {/* USER */}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold">{user?.displayName || user?.email?.split("@")[0] || "Cuisine"}</p>
            <p className="text-xs text-white/70">Chef</p>
          </div>

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className="rounded-md p-2 text-white hover:bg-white/15 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="grid h-full min-h-0 grid-cols-1 gap-5 overflow-y-auto lg:grid-cols-4 lg:overflow-hidden">
          {KITCHEN_COLUMNS.map((column) => {
            const columnOrders = groupedOrders[column.status]
            const Icon = column.icon

            return (
              <section
                key={column.status}
                className={cn(
                  "flex min-h-[420px] flex-col overflow-hidden rounded-[20px] border text-card-foreground shadow-[0_18px_42px_rgba(15,23,42,0.08)] ring-1 ring-white/60 backdrop-blur dark:shadow-[0_18px_42px_rgba(0,0,0,0.24)] dark:ring-white/5 lg:min-h-0",
                  column.shellClass
                )}
              >
                <header className="flex shrink-0 items-center justify-between border-b border-white/70 px-4 py-4 dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm",
                        column.iconClass
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h2 className="truncate text-base font-semibold leading-tight text-foreground">
                      {column.title}
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-sm font-black shadow-sm",
                      column.badgeClass
                    )}
                  >
                    {columnOrders.length}
                  </span>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
                  {columnOrders.length === 0 ? (
                    <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[18px] border border-dashed border-foreground/10 bg-white/45 px-5 text-center shadow-inner dark:bg-black/10">
                      <span
                        className={cn(
                          "flex h-16 w-16 items-center justify-center rounded-full",
                          column.iconClass
                        )}
                      >
                        <Inbox className="h-7 w-7" />
                      </span>
                      <p className="mt-4 text-base font-semibold text-foreground">
                        Aucune commande
                      </p>
                      <p className="mt-1 max-w-[14rem] text-sm font-medium leading-5 text-muted-foreground">
                        {column.emptyDescription}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5">
                      {columnOrders.map((order) => (
                        <KitchenOrderCard
                          key={order.id}
                          order={order}
                          onUpdateStatus={updateStatus}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </main>
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
  if (status !== ORDER_OPERATION_STATUS.SERVED && status !== ORDER_OPERATION_STATUS.PICKED_UP) return true
  return isToday(getKitchenServedAtMs(order) ?? getCreatedAtMs(order))
}

function isToday(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function getKitchenServedAtMs(order: RestaurantOrder) {
  const servedAt =
    (order as any).timestamps?.servedAt ??
    (order as any).timestamps?.pickedUpAt ??
    (order as any).servedAt ??
    (order as any).pickedUpAt ??
    (order as any).updatedAt
  const explicitTimestamp = toTimestampMs(servedAt)
  if (explicitTimestamp) return explicitTimestamp

  const history = Array.isArray((order as any).statusHistory) ? (order as any).statusHistory : []
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

function getKitchenQueuePriority(order: RestaurantOrder) {
  const paymentStatus = (order as { paymentStatus?: string | null }).paymentStatus
  const isDineIn = normalizeOrderType(order.orderType) === "dine_in"
  const isVerified = paymentStatus === "verified"

  if (!isDineIn && isVerified) return 0
  if (isDineIn) return 1

  return 2
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
