"use client"

import * as React from "react"
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { ChefHat, LogOut } from "lucide-react"

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
  accent: string
}> = [
  { status: ORDER_OPERATION_STATUS.PENDING, title: "EN ATTENTE", accent: "border-t-orange-500" },
  { status: ORDER_OPERATION_STATUS.IN_PREPARATION, title: "EN PR\u00c9PARATION", accent: "border-t-orange-500" },
  { status: ORDER_OPERATION_STATUS.READY, title: "PR\u00caTES", accent: "border-t-orange-500" },
  { status: ORDER_OPERATION_STATUS.SERVED, title: "SERVIES", accent: "border-t-orange-500" },
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

      <section className="min-h-0 flex-1 overflow-hidden p-3">
        <div className="grid h-full min-h-0 grid-cols-4 gap-3">
          {KITCHEN_COLUMNS.map((column) => {
            const columnOrders = groupedOrders[column.status]

            return (
              <section
                key={column.status}
                className={cn(
                  "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border border-t-4 bg-card text-card-foreground",
                  column.accent
                )}
              >
                <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
                  <h2 className="text-xs font-black uppercase tracking-wide text-foreground">
                    {column.title}
                  </h2>
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-black text-primary">
                    {columnOrders.length}
                  </span>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {columnOrders.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-center text-xs font-semibold text-muted-foreground">
                      Aucune commande
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
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
