"use client"

import * as React from "react"
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from "firebase/firestore"

import { useFirestore } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import {
  DEFAULT_RESTAURANT_PAGE_SIZE,
  getRestaurantPage,
  restaurantCollection,
} from "@/lib/firestore/restaurant-data"

type UseRestaurantPageOptions<T> = {
  collectionName: string
  constraints?: QueryConstraint[]
  enabled?: boolean
  orderByField?: string | null
  pageSize?: number
  initialItems?: Array<T & { id: string }>
  resetKey?: string
}

const EMPTY_CONSTRAINTS: QueryConstraint[] = []
const EMPTY_ITEMS: Array<DocumentData & { id: string }> = []

export function useRestaurantPage<T extends DocumentData = DocumentData>({
  collectionName,
  constraints = EMPTY_CONSTRAINTS,
  enabled = true,
  orderByField = "createdAt",
  pageSize = DEFAULT_RESTAURANT_PAGE_SIZE,
  initialItems = EMPTY_ITEMS as Array<T & { id: string }>,
  resetKey = "",
}: UseRestaurantPageOptions<T>) {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const [items, setItems] = React.useState<Array<T & { id: string }>>(initialItems)
  const [cursor, setCursor] = React.useState<QueryDocumentSnapshot<T, DocumentData> | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const autoLoadKey = `${restaurantId ?? "none"}:${collectionName}:${enabled ? "enabled" : "disabled"}:${resetKey}`

  const loadMore = React.useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (!enabled || !db || !restaurantId || isLoading || (!hasMore && !reset)) return

      setIsLoading(true)
      setError(null)

      try {
        const collectionRef = restaurantCollection<T>(db, restaurantId, collectionName)
        const page = await getRestaurantPage<T>({
          collectionRef,
          constraints,
          cursor: reset ? null : cursor,
          orderByField,
          pageSize,
        })

        setItems((current) => (reset ? page.items : [...current, ...page.items]))
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      } catch (caught) {
        const nextError = caught instanceof Error ? caught : new Error("Unable to load restaurant page")
        console.error("Failed to load restaurant page", {
          collectionName,
          orderByField,
          reset,
          error: nextError,
        })
        setError(nextError)
      } finally {
        setIsLoading(false)
      }
    },
    [
      collectionName,
      constraints,
      cursor,
      db,
      enabled,
      hasMore,
      isLoading,
      orderByField,
      pageSize,
      restaurantId,
    ]
  )

  const refetch = React.useCallback(() => {
    setCursor(null)
    setHasMore(true)
    return loadMore({ reset: true })
  }, [loadMore])

  React.useEffect(() => {
    setItems(initialItems)
    setCursor(null)
    setHasMore(true)
    setError(null)
  }, [autoLoadKey, initialItems])

  React.useEffect(() => {
    if (!enabled || !db || !restaurantId || items.length > 0 || !hasMore || isLoading || error) return
    void loadMore({ reset: true })
  }, [db, enabled, error, hasMore, isLoading, items.length, loadMore, restaurantId])

  return {
    error,
    hasMore,
    isLoading,
    items,
    loadMore,
    refetch,
  }
}
