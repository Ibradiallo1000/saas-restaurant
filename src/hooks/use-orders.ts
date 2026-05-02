"use client"

import * as React from "react"
import {
  Firestore,
  QueryConstraint,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"

import { useFirestore } from "@/firebase"
import { COLLECTION_NAMES, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { canTransition, normalizeOrderStatus } from "@/lib/order-status"
import type { RestaurantOrder } from "@/types"

type UseOrdersOptions = {
  companyId?: string | null
  statuses?: RestaurantOrder["status"][]
  onNewOrders?: (orders: RestaurantOrder[]) => void
}

export function useOrders({ companyId, statuses, onNewOrders }: UseOrdersOptions) {
  const db = useFirestore()
  const [orders, setOrders] = React.useState<RestaurantOrder[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const knownIdsRef = React.useRef<Set<string>>(new Set())
  const initializedRef = React.useRef(false)
  const onNewOrdersRef = React.useRef(onNewOrders)

  React.useEffect(() => {
    onNewOrdersRef.current = onNewOrders
  }, [onNewOrders])

  React.useEffect(() => {
    if (!db || !companyId) {
      setOrders([])
      setIsLoading(false)
      setError(null)
      knownIdsRef.current = new Set()
      initializedRef.current = false
      return
    }

    setIsLoading(true)
    setError(null)

    const constraints: QueryConstraint[] = []
    const ordersQuery = query(collection(db, COLLECTION_NAMES.COMPANIES, companyId, COLLECTION_NAMES.ORDERS), ...constraints)

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const nextOrders = snapshot.docs
          .map((snapshotDoc) => ({
            ...(snapshotDoc.data() as Omit<RestaurantOrder, "id">),
            id: snapshotDoc.id,
          }))
          .sort((left, right) => (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0))

        const nextIds = new Set(nextOrders.map((order) => order.id))

        if (initializedRef.current) {
          const newOrders = nextOrders.filter((order) => !knownIdsRef.current.has(order.id))
          if (newOrders.length) {
            onNewOrdersRef.current?.(newOrders)
          }
        } else {
          initializedRef.current = true
        }

        knownIdsRef.current = nextIds
        setOrders(nextOrders)
        setIsLoading(false)
      },
      (snapshotError) => {
        setError(snapshotError)
        setOrders([])
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [companyId, db])

  const updateStatus = React.useCallback(
    async (orderId: string, status: RestaurantOrder["status"]) => {
      if (!db || !companyId) return
      const currentOrder = orders.find((order) => order.id === orderId)
      if (currentOrder && !canTransition(currentOrder.status, status)) return

      await updateDoc(orderRef(db, companyId, orderId), {
        status: normalizeOrderStatus(status),
        updatedAt: serverTimestamp(),
        ...timestampForStatus(status),
      })
    },
    [companyId, db, orders]
  )

  const markPaid = React.useCallback(
    async (orderId: string) => {
      if (!db || !companyId) return
      await updateDoc(orderRef(db, companyId, orderId), {
        paymentMethod: "cash",
        paymentStatus: PAYMENT_STATUS.VALIDATED,
        status: ORDER_STATUS.PAYEE,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    },
    [companyId, db]
  )

  return {
    orders,
    isLoading,
    error,
    updateStatus,
    markPaid,
  }
}

function orderRef(db: Firestore, companyId: string, orderId: string) {
  return doc(db, COLLECTION_NAMES.COMPANIES, companyId, COLLECTION_NAMES.ORDERS, orderId)
}

function timestampForStatus(status: RestaurantOrder["status"]) {
  switch (status) {
    case ORDER_STATUS.PREPARATION:
      return { preparingAt: serverTimestamp() }
    case ORDER_STATUS.PRETE:
      return { readyAt: serverTimestamp() }
    case ORDER_STATUS.SERVIE:
      return { servedAt: serverTimestamp() }
    case ORDER_STATUS.PAYEE:
      return { paidAt: serverTimestamp() }
    default:
      return {}
  }
}
