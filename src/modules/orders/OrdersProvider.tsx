"use client"

import * as React from "react"
import { limit, orderBy, query, where } from "firebase/firestore"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"

export const ACTIVE_ORDER_STATUSES = [
  "pending",
  "preparing",
  "ready",
  "served",
  "nouvelle",
  "preparation",
  "prete",
  "servie",
  "payee",
]

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

  const activeOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("status", "in", ACTIVE_ORDER_STATUSES),
      orderBy("createdAt", "desc"),
      limit(30)
    )
  }, [db, restaurantId])

  const { data, isLoading } = useCollection(activeOrdersQuery)

  const value = React.useMemo(
    () => ({
      orders: data || [],
      isLoading,
    }),
    [data, isLoading]
  )

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  )
}

export const useOrders = () => React.useContext(OrdersContext)
