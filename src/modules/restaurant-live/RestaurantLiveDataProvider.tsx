"use client"

import * as React from "react"
import { collection } from "firebase/firestore"
import { usePathname } from "next/navigation"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { COLLECTION_NAMES } from "@/lib/constants"
import { isOrderServed, isOrderPaid } from "@/lib/order-lifecycle"
import {
  restaurantOrdersRef,
  restaurantTableSessionsRef,
  restaurantTablesRef,
} from "@/lib/restaurant-firestore-paths"

type RestaurantLiveDataContextType = {
  activeOrders: any[]
  cashSessionRequests: any[]
  cashSessions: any[]
  cashMovements: any[]
  isLoadingOrders: boolean
  isLoadingSessions: boolean
  isLoadingTables: boolean
  payments: any[]
  tableSessions: any[]
  tables: any[]
  unpaidServedCount: number
}

const RestaurantLiveDataContext = React.createContext<RestaurantLiveDataContextType>({
  activeOrders: [],
  cashSessionRequests: [],
  cashSessions: [],
  cashMovements: [],
  isLoadingOrders: false,
  isLoadingSessions: false,
  isLoadingTables: false,
  payments: [],
  tableSessions: [],
  tables: [],
  unpaidServedCount: 0,
})

export function RestaurantLiveDataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ""
  const [isClient, setIsClient] = React.useState(false)
  const enabled = isClient && isOperationalRoute(pathname)
  const db = useFirestore()
  const { restaurantId } = useRestaurant()

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  const ordersQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return restaurantOrdersRef(db, restaurantId)
  }, [db, enabled, restaurantId])
  const { data: activeOrders, isLoading: isLoadingOrders } = useCollection<any>(ordersQuery)

  const tablesQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return restaurantTablesRef(db, restaurantId)
  }, [db, enabled, restaurantId])
  const { data: tables, isLoading: isLoadingTables } = useCollection<any>(tablesQuery)

  const tableSessionsQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return restaurantTableSessionsRef(db, restaurantId)
  }, [db, enabled, restaurantId])
  const { data: tableSessions } = useCollection<any>(tableSessionsQuery)

  const cashSessionsQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS)
  }, [db, enabled, restaurantId])
  const { data: cashSessions, isLoading: isLoadingCashSessions } = useCollection<any>(cashSessionsQuery)

  const cashSessionRequestsQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests")
  }, [db, enabled, restaurantId])
  const { data: cashSessionRequests, isLoading: isLoadingCashSessionRequests } =
    useCollection<any>(cashSessionRequestsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PAYMENTS)
  }, [db, enabled, restaurantId])
  const { data: payments } = useCollection<any>(paymentsQuery)

  const cashMovementsQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS)
  }, [db, enabled, restaurantId])
  const { data: cashMovements } = useCollection<any>(cashMovementsQuery)

  const pendingCashSessionRequests = React.useMemo(() => {
    return (cashSessionRequests || []).filter((request) => isPendingCashSessionRequestStatus(request.status))
  }, [cashSessionRequests])

  const unpaidServedCount = React.useMemo(() => {
    return (activeOrders || []).filter((order) => {
      return isOrderServed(order) && !isOrderPaid(order)
    }).length
  }, [activeOrders])

  const value = React.useMemo<RestaurantLiveDataContextType>(
    () => ({
      activeOrders: activeOrders || [],
      cashSessionRequests: pendingCashSessionRequests,
      cashSessions: cashSessions || [],
      cashMovements: cashMovements || [],
      isLoadingOrders,
      isLoadingSessions: isLoadingCashSessions || isLoadingCashSessionRequests,
      isLoadingTables,
      payments: payments || [],
      tableSessions: tableSessions || [],
      tables: tables || [],
      unpaidServedCount,
    }),
    [
      activeOrders,
      pendingCashSessionRequests,
      cashSessions,
      cashMovements,
      isLoadingCashSessionRequests,
      isLoadingCashSessions,
      isLoadingOrders,
      isLoadingTables,
      payments,
      tableSessions,
      tables,
      unpaidServedCount,
    ]
  )

  return (
    <RestaurantLiveDataContext.Provider value={value}>
      {children}
    </RestaurantLiveDataContext.Provider>
  )
}

function isPendingCashSessionRequestStatus(status: unknown) {
  return status === "pending" || status === "requested" || status === "request"
}

export function useRestaurantLiveData() {
  return React.useContext(RestaurantLiveDataContext)
}

function isOperationalRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/owner") ||
    pathname.startsWith("/pos") ||
    pathname.startsWith("/tables")
  )
}
