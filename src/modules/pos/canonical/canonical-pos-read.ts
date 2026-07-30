"use client"

import * as React from "react"
import {
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore"

import { useFirestore } from "@/firebase"
import { mergeCanonicalPosOrders } from "./pos-selectors"

export const POS_CANONICAL_ITEM_LIMIT = 500

export function useCanonicalPosOrders(input: {
  restaurantId: string
  enabled: boolean
  parentOrders: readonly any[]
}) {
  const db = useFirestore()
  const [items, setItems] = React.useState<any[]>([])
  const [error, setError] = React.useState<Error | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaturated, setIsSaturated] = React.useState(false)

  React.useEffect(() => {
    if (!db || !input.enabled || !input.restaurantId) {
      setItems([])
      setError(null)
      setIsLoading(false)
      setIsSaturated(false)
      return
    }
    setIsLoading(true)
    return onSnapshot(
      query(
        collectionGroup(db, "orderItems"),
        where("restaurantId", "==", input.restaurantId),
        orderBy("createdAt", "asc"),
        limit(POS_CANONICAL_ITEM_LIMIT)
      ),
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          orderItemId: item.id,
          version: Number(item.data().version ?? 1),
        })))
        setIsSaturated(snapshot.size >= POS_CANONICAL_ITEM_LIMIT)
        setError(null)
        setIsLoading(false)
      },
      (value) => {
        setError(value)
        setIsLoading(false)
      }
    )
  }, [db, input.enabled, input.restaurantId])

  const orders = React.useMemo(
    () => mergeCanonicalPosOrders(input.parentOrders, items),
    [input.parentOrders, items]
  )
  return { orders, items, error, isLoading, isSaturated }
}
