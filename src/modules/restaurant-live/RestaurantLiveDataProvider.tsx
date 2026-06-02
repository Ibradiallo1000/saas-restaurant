"use client"

import * as React from "react"
import { collection, doc, updateDoc } from "firebase/firestore"
import { usePathname } from "next/navigation"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
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
  pendingCashValidationCount: number
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
  pendingCashValidationCount: 0,
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

  React.useEffect(() => {
    if (!db || !restaurantId || !activeOrders?.length) return

    activeOrders.forEach((order: any) => {
      if (!order?.id || order.kitchenStatus) return

      console.warn("Missing kitchenStatus", order.id)
      updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS, order.id), {
        kitchenStatus: mapLegacyStatus(order.status ?? order.orderStatus),
      }).catch((error) => {
        console.warn("Failed to migrate kitchenStatus", order.id, error)
      })
    })
  }, [activeOrders, db, restaurantId])

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

  const { toast } = useToast()
  const lastPaymentAlertsRef = React.useRef<Set<string>>(new Set())
  const lastCashClosureAlertsRef = React.useRef<Set<string>>(new Set())
  const cashClosureAlertsInitializedRef = React.useRef(false)
  const hasInteractedRef = React.useRef(false)

  React.useEffect(() => {
    const handleInteraction = () => {
      hasInteractedRef.current = true
      document.removeEventListener("click", handleInteraction)
      document.removeEventListener("keydown", handleInteraction)
      document.removeEventListener("touchstart", handleInteraction)
    }
    document.addEventListener("click", handleInteraction)
    document.addEventListener("keydown", handleInteraction)
    document.addEventListener("touchstart", handleInteraction)
    return () => {
      document.removeEventListener("click", handleInteraction)
      document.removeEventListener("keydown", handleInteraction)
      document.removeEventListener("touchstart", handleInteraction)
    }
  }, [])

  React.useEffect(() => {
    if (!tableSessions) return
    const pendingRequests = tableSessions.filter((s: any) => s.paymentRequest?.status === "requested")
    pendingRequests.forEach((session: any) => {
      const alertKey = `${session.id}-${session.paymentRequest?.status}`
      if (!lastPaymentAlertsRef.current.has(alertKey)) {
        lastPaymentAlertsRef.current.add(alertKey)
        if (hasInteractedRef.current && typeof window !== 'undefined' && window.navigator?.vibrate) {
          window.navigator.vibrate([100, 50, 100])
        }
        try {
          const audio = new Audio("/sounds/son.mp3")
          audio.play().catch(() => {})
        } catch(e) {}

        toast({
          title: "Demande de paiement",
          description: `Table ${session.tableName || session.tableId} demande paiement (${session.paymentRequest?.method === "cash" ? "Espèces" : session.paymentRequest?.provider || "Mobile Money"})`,
        })
      }
    })
  }, [tableSessions, toast])

  const cashSessionsQuery = useMemoFirebase(() => {
    if (!enabled || !db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS)
  }, [db, enabled, restaurantId])
  const { data: cashSessions, isLoading: isLoadingCashSessions } = useCollection<any>(cashSessionsQuery)

  const pendingCashValidationSessions = React.useMemo(() => {
    return (cashSessions || []).filter((session: any) => {
      return (
        (session.status === "closed" || session.status === "pending_validation") &&
        !session.validatedByManager
      )
    })
  }, [cashSessions])

  React.useEffect(() => {
    if (!cashSessions) return

    const currentKeys = new Set(
      pendingCashValidationSessions.map((session: any) => `${session.id}-${session.status}`)
    )

    if (!cashClosureAlertsInitializedRef.current) {
      lastCashClosureAlertsRef.current = currentKeys
      cashClosureAlertsInitializedRef.current = true
      return
    }

    pendingCashValidationSessions.forEach((session: any) => {
      const alertKey = `${session.id}-${session.status}`
      if (lastCashClosureAlertsRef.current.has(alertKey)) return

      lastCashClosureAlertsRef.current.add(alertKey)
      if (hasInteractedRef.current && typeof window !== "undefined" && window.navigator?.vibrate) {
        window.navigator.vibrate([120, 50, 120])
      }
      try {
        const audio = new Audio("/sounds/son.mp3")
        audio.play().catch(() => {})
      } catch {}

      toast({
        title: "Caisse clôturée",
        description: "Une session POS attend la validation manager.",
      })
    })

    lastCashClosureAlertsRef.current.forEach((key) => {
      if (!currentKeys.has(key)) lastCashClosureAlertsRef.current.delete(key)
    })
  }, [cashSessions, pendingCashValidationSessions, toast])

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
      pendingCashValidationCount: pendingCashValidationSessions.length,
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
      pendingCashValidationSessions.length,
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

function mapLegacyStatus(status: string | null | undefined) {
  if (status === "preparing" || status === "preparation" || status === "en_preparation") return "preparing"
  if (status === "ready" || status === "prete" || status === "pretes") return "ready"
  if (status === "served" || status === "servie" || status === "servies" || status === "completed" || status === "terminee") return "served"
  if (status === "picked_up" || status === "recuperee") return "served"
  return "pending"
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
