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
      where("kitchenStatus", "in", ["pending", "preparing", "ready"]),
      orderBy("createdAt", "desc"),
      limit(150)
    )
  }, [db, restaurantId])

  const todayServedOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("createdAt", ">=", Timestamp.fromDate(todayStart)),
      where("kitchenStatus", "in", ["served", "completed", "picked_up"]),
      orderBy("createdAt", "desc"),
      limit(100)
    )
  }, [db, restaurantId, todayStart])

  const { data: activeOrders, isLoading: isLoadingActiveOrders } = useCollection(activeOrdersQuery)
  const { data: todayServedOrders, isLoading: isLoadingTodayServedOrders } = useCollection(todayServedOrdersQuery)
  const orders = React.useMemo(() => {
    const merged = new Map<string, any>()
    ;[...(activeOrders || []), ...(todayServedOrders || [])].forEach((order: any) => {
      if (order?.id) merged.set(order.id, order)
    })
    return Array.from(merged.values())
  }, [activeOrders, todayServedOrders])
  const isLoading = isLoadingActiveOrders || isLoadingTodayServedOrders

  React.useEffect(() => {
    if (!db || !restaurantId || !orders?.length) return

    orders.forEach((order: any) => {
      if (!order?.id || order.kitchenStatus) return
      console.warn("Missing kitchenStatus", order.id)
      const legacyStatus = order.status ?? order.orderStatus
      if (!legacyStatus) return
      updateDoc(doc(restaurantOrdersRef(db, restaurantId), order.id), {
        kitchenStatus: mapLegacyStatus(legacyStatus),
      }).catch((error) => {
        console.warn("Failed to migrate kitchenStatus", order.id, error)
      })
    })

    orders.forEach((order: any) => {
      if (!order?.id || order.tableSessionId || !order.sessionId || order.orderType !== "dine_in") return
      updateDoc(doc(restaurantOrdersRef(db, restaurantId), order.id), {
        tableSessionId: order.sessionId,
      }).catch((error) => {
        console.warn("Failed to migrate tableSessionId", order.id, error)
      })
    })
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
