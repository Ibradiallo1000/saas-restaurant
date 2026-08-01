"use client"

import * as React from "react"
import {
  Timestamp,
  collection,
  collectionGroup,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore"

import { useFirestore } from "@/firebase"
import { timestampMs } from "./selectors"

export interface ServedPreparationItem {
  orderId: string
  orderItemId: string
  orderNumber: string
  productName: string
  productImageUrl: string | null
  quantity: number
  orderType: string
  tableNumber: string | null
  preparedAt: number
  servedAt: number
}

const HISTORY_LIMIT = 250

export function useServedPreparationHistory(input: {
  restaurantId?: string
  userId?: string
  preparationStationId?: string
  enabled: boolean
}) {
  const db = useFirestore()
  const [items, setItems] = React.useState<ServedPreparationItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (!db || !input.enabled || !input.restaurantId || !input.userId) {
      setItems([])
      setIsLoading(false)
      setError(null)
      return
    }

    let active = true
    let generation = 0
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    setItems([])
    setIsLoading(true)
    setError(null)

    const historyQuery = query(
      collectionGroup(db, "orderItems"),
      where("restaurantId", "==", input.restaurantId),
      where(input.preparationStationId ? "preparationStationId" : "preparationMode", "==", input.preparationStationId || "kitchen"),
      where("status", "==", "served"),
      where("servedAt", ">=", Timestamp.fromDate(dayStart)),
      orderBy("servedAt", "desc"),
      limit(HISTORY_LIMIT)
    )

    const unsubscribe = onSnapshot(historyQuery, async (snapshot) => {
      const currentGeneration = ++generation
      try {
        const rows = snapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() }))
        const orderIds = [...new Set(rows.map((row) => text(row.data.orderId)).filter(Boolean))]
        const productIds = [...new Set(rows.map((row) => text(row.data.productId)).filter(Boolean))]
        const [orders, products] = await Promise.all([
          loadByIds(db, "restaurants", input.restaurantId!, "orders", orderIds),
          loadByIds(db, "restaurants", input.restaurantId!, "products", productIds),
        ])
        if (!active || currentGeneration !== generation) return

        setItems(rows.flatMap((row) => {
          const orderId = text(row.data.orderId)
          const productId = text(row.data.productId)
          const order = orders.get(orderId)
          const servedAt = timestampMs(row.data.servedAt)
          if (!orderId || !servedAt || !order) return []
          const quantity = positiveInteger(row.data.servedQuantity) || positiveInteger(row.data.quantity) || 1
          const table = text(order.table ?? order.tableName ?? order.tableNumber)
          return [{
            orderId,
            orderItemId: row.id,
            orderNumber: text(order.displayId ?? order.orderNumber ?? order.reference) || orderId,
            productName: text(row.data.nameSnapshot ?? row.data.name) || "Produit",
            productImageUrl: text(products.get(productId)?.imageUrl ?? products.get(productId)?.image ?? products.get(productId)?.photoUrl) || null,
            quantity,
            orderType: text(order.orderType ?? order.type ?? order.serviceMode) || "unknown",
            tableNumber: table || null,
            preparedAt: timestampMs(row.data.readyAt),
            servedAt,
          } satisfies ServedPreparationItem]
        }))
        setIsLoading(false)
        setError(null)
      } catch (value) {
        if (!active || currentGeneration !== generation) return
        setIsLoading(false)
        setError(value instanceof Error ? value : new Error("Historique indisponible."))
      }
    }, (value) => {
      if (!active) return
      setIsLoading(false)
      setError(value)
    })

    return () => {
      active = false
      generation += 1
      unsubscribe()
    }
  }, [db, input.enabled, input.preparationStationId, input.restaurantId, input.userId])

  return { items, isLoading, error }
}

async function loadByIds(
  db: NonNullable<ReturnType<typeof useFirestore>>,
  root: string,
  restaurantId: string,
  child: string,
  ids: string[]
) {
  const result = new Map<string, Record<string, any>>()
  for (let index = 0; index < ids.length; index += 30) {
    const batch = ids.slice(index, index + 30)
    if (!batch.length) continue
    const snapshot = await getDocs(query(collection(db, root, restaurantId, child), where(documentId(), "in", batch)))
    snapshot.docs.forEach((entry) => result.set(entry.id, entry.data()))
  }
  return result
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function positiveInteger(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : 0
}
