"use client"

import * as React from "react"
import { doc, limit, orderBy, query, Timestamp, updateDoc, where } from "firebase/firestore"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { orderHasKitchenItems } from "@/utils/preparation-logic"

type OrdersContextType = {
  orders: any[]
  isLoading: boolean
}

const OrdersContext = React.createContext<OrdersContextType>({
  orders: [],
  isLoading: true,
})

const ACTIVE_KITCHEN_STATUSES = ["pending", "preparing", "ready", "served"]
const TODAY_SERVED_KITCHEN_STATUSES = [
  "served",
  "servie",
  "servies",
  "completed",
  "picked_up",
  "terminee",
]

export function OrdersProvider({
  children,
  restaurantId,
}: {
  children: React.ReactNode
  restaurantId?: string
}) {
  const db = useFirestore()
  const todayStart = React.useMemo(() => startOfToday(), [])

  const activeOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("kitchenStatus", "in", ACTIVE_KITCHEN_STATUSES),
      orderBy("createdAt", "desc"),
      limit(150)
    )
  }, [db, restaurantId])

  const todayServedOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("createdAt", ">=", Timestamp.fromDate(todayStart)),
      where("kitchenStatus", "in", TODAY_SERVED_KITCHEN_STATUSES),
      orderBy("createdAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId, todayStart])

  const todayRecentServedOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("kitchenStatus", "in", TODAY_SERVED_KITCHEN_STATUSES),
      orderBy("updatedAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId])

  const todayServedAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("timestamps.servedAt", ">=", Timestamp.fromDate(todayStart)),
      orderBy("timestamps.servedAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId, todayStart])

  const todayLegacyServedAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("servedAt", ">=", Timestamp.fromDate(todayStart)),
      orderBy("servedAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId, todayStart])

  const todayPickedUpAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("timestamps.pickedUpAt", ">=", Timestamp.fromDate(todayStart)),
      orderBy("timestamps.pickedUpAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId, todayStart])

  const todayLegacyPickedUpAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("pickedUpAt", ">=", Timestamp.fromDate(todayStart)),
      orderBy("pickedUpAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId, todayStart])

  const recentCreatedOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      orderBy("createdAt", "desc"),
      limit(150)
    )
  }, [db, restaurantId])

  const recentUpdatedOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      orderBy("updatedAt", "desc"),
      limit(150)
    )
  }, [db, restaurantId])

  const { data: activeOrders, isLoading: isLoadingActiveOrders } = useCollection(activeOrdersQuery)
  const { data: todayServedOrders, isLoading: isLoadingTodayServedOrders } = useCollection(todayServedOrdersQuery)
  const { data: todayServedAtOrders, isLoading: isLoadingTodayServedAtOrders } = useCollection(todayServedAtOrdersQuery)
  const { data: todayRecentServedOrders, isLoading: isLoadingTodayRecentServedOrders } = useCollection(todayRecentServedOrdersQuery)
  const { data: todayLegacyServedAtOrders, isLoading: isLoadingTodayLegacyServedAtOrders } = useCollection(todayLegacyServedAtOrdersQuery)
  const { data: todayPickedUpAtOrders, isLoading: isLoadingTodayPickedUpAtOrders } = useCollection(todayPickedUpAtOrdersQuery)
  const { data: todayLegacyPickedUpAtOrders, isLoading: isLoadingTodayLegacyPickedUpAtOrders } = useCollection(todayLegacyPickedUpAtOrdersQuery)
  const { data: recentCreatedOrders, isLoading: isLoadingRecentCreatedOrders } = useCollection(recentCreatedOrdersQuery)
  const { data: recentUpdatedOrders, isLoading: isLoadingRecentUpdatedOrders } = useCollection(recentUpdatedOrdersQuery)
  const orders = React.useMemo(() => {
    const merged = new Map<string, any>()
    ;[
      ...(activeOrders || []),
      ...(todayServedOrders || []),
      ...(todayRecentServedOrders || []),
      ...(todayServedAtOrders || []),
      ...(todayLegacyServedAtOrders || []),
      ...(todayPickedUpAtOrders || []),
      ...(todayLegacyPickedUpAtOrders || []),
      ...(recentCreatedOrders || []),
      ...(recentUpdatedOrders || []),
    ].forEach((order: any) => {
      if (order?.id) merged.set(order.id, order)
    })
    return Array.from(merged.values())
  }, [
    activeOrders,
    recentCreatedOrders,
    recentUpdatedOrders,
    todayLegacyPickedUpAtOrders,
    todayLegacyServedAtOrders,
    todayPickedUpAtOrders,
    todayRecentServedOrders,
    todayServedAtOrders,
    todayServedOrders,
  ])
  const isLoading =
    isLoadingActiveOrders ||
    isLoadingTodayServedOrders ||
    isLoadingTodayRecentServedOrders ||
    isLoadingTodayServedAtOrders ||
    isLoadingTodayLegacyServedAtOrders ||
    isLoadingTodayPickedUpAtOrders ||
    isLoadingTodayLegacyPickedUpAtOrders ||
    isLoadingRecentCreatedOrders ||
    isLoadingRecentUpdatedOrders

  // Legacy migrations should not run from the client UI because
  // normal kitchen users may not have permissions to update order documents.
  // These updates belong in a server-side migration script or admin-only tool.
  React.useEffect(() => {
    // intentionally no-op
  }, [db, orders, restaurantId])

  const kitchenOrders = React.useMemo(() => {
    const mergedOrders = new Map<string, any>()

    ;(orders || []).forEach((order: any) => {
      if (!order?.id) return

      const kitchenStatus = mapLegacyStatus(order.kitchenStatus ?? order.status ?? order.orderStatus)
      if (!["pending", "preparing", "ready", "served"].includes(kitchenStatus)) return
      if (!orderHasKitchenItems(order.items || [])) return

      mergedOrders.set(order.id, {
        ...order,
        kitchenStatus: order.kitchenStatus ?? kitchenStatus,
      })
    })

    return Array.from(mergedOrders.values())
  }, [orders])

  const value = React.useMemo(
    () => ({
      orders: kitchenOrders,
      isLoading,
    }),
    [isLoading, kitchenOrders]
  )

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  )
}

export const useOrders = () => React.useContext(OrdersContext)

function mapLegacyStatus(status: string | null | undefined) {
  if (status === "preparing" || status === "preparation" || status === "en_preparation") return "preparing"
  if (status === "ready" || status === "prete" || status === "pretes") return "ready"
  if (status === "served" || status === "servie" || status === "servies" || status === "completed" || status === "terminee") return "served"
  if (status === "picked_up" || status === "recuperee") return "served"
  return "pending"
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}
