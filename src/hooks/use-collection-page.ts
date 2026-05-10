"use client"

import * as React from "react"
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore"

import { useFirestore } from "@/firebase"

type UseCollectionPageOptions<T> = {
  collectionName: string
  constraints?: QueryConstraint[]
  enabled?: boolean
  orderByDirection?: "asc" | "desc"
  orderByField?: string | null
  pageSize?: number
}

const EMPTY_CONSTRAINTS: QueryConstraint[] = []

export function useCollectionPage<T = DocumentData>({
  collectionName,
  constraints = EMPTY_CONSTRAINTS,
  enabled = true,
  orderByDirection = "desc",
  orderByField = "createdAt",
  pageSize = 20,
}: UseCollectionPageOptions<T>) {
  const db = useFirestore()
  const [items, setItems] = React.useState<Array<T & { id: string }>>([])
  const [cursor, setCursor] = React.useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const resetKey = `${collectionName}:${enabled ? "enabled" : "disabled"}`

  const loadMore = React.useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (!enabled || !db || isLoading || (!hasMore && !reset)) return

      setIsLoading(true)
      setError(null)

      try {
        const collectionRef = collection(db, collectionName)
        const pageQuery = query(
          collectionRef,
          ...constraints,
          ...(orderByField ? [orderBy(orderByField, orderByDirection)] : []),
          limit(pageSize),
          ...(cursor && !reset ? [startAfter(cursor)] : [])
        )
        const snapshot = await getDocs(pageQuery)
        const nextItems = snapshot.docs.map((item) => ({
          ...(item.data() as T),
          id: item.id,
        }))

        setItems((current) => (reset ? nextItems : [...current, ...nextItems]))
        setCursor(snapshot.docs[snapshot.docs.length - 1] ?? null)
        setHasMore(snapshot.docs.length === pageSize)
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error("Unable to load collection page"))
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
      orderByDirection,
      orderByField,
      pageSize,
    ]
  )

  const refetch = React.useCallback(() => {
    setCursor(null)
    setHasMore(true)
    return loadMore({ reset: true })
  }, [loadMore])

  React.useEffect(() => {
    setItems([])
    setCursor(null)
    setHasMore(true)
    setError(null)
  }, [resetKey])

  React.useEffect(() => {
    if (!enabled || !db || items.length > 0 || isLoading || error) return
    void loadMore({ reset: true })
  }, [db, enabled, error, isLoading, items.length, loadMore])

  return {
    error,
    hasMore,
    isLoading,
    items,
    loadMore,
    refetch,
  }
}
