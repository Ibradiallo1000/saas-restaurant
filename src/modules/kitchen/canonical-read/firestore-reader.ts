import {
  collection,
  collectionGroup,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Query,
  type Unsubscribe,
} from "firebase/firestore"

import type {
  KitchenOrderItemView,
  KitchenParentContext,
  RawCanonicalKitchenItem,
} from "./model.ts"
import {
  countKitchenColumns,
  groupKitchenItems,
  selectKitchenColumns,
  sortKitchenGroups,
  toKitchenOrderItemView,
  isKitchenReadSaturated,
  timestampMs,
} from "./selectors.ts"

export const KITCHEN_ACTIVE_ITEM_LIMIT = 200

export interface CanonicalKitchenSnapshot {
  items: KitchenOrderItemView[]
  groups: ReturnType<typeof groupKitchenItems>
  columns: ReturnType<typeof selectKitchenColumns>
  counters: ReturnType<typeof countKitchenColumns>
  isSaturated: boolean
  invalidDocumentCount: number
}

export function createCanonicalKitchenItemsQuery(
  db: Firestore,
  restaurantId: string
): Query {
  return query(
    collectionGroup(db, "orderItems"),
    where("restaurantId", "==", restaurantId),
    where("preparationMode", "==", "kitchen"),
    where("status", "in", ["pending", "preparing", "ready"]),
    orderBy("createdAt", "asc"),
    limit(KITCHEN_ACTIVE_ITEM_LIMIT)
  )
}

export function subscribeCanonicalKitchenRead(input: {
  db: Firestore
  restaurantId: string
  onData(snapshot: CanonicalKitchenSnapshot): void
  onError(error: Error): void
  log?: Pick<Console, "warn">
}): Unsubscribe {
  let active = true
  let generation = 0
  const kitchenQuery = createCanonicalKitchenItemsQuery(input.db, input.restaurantId)

  const unsubscribe = onSnapshot(
    kitchenQuery,
    async (snapshot) => {
      const currentGeneration = ++generation
      try {
        const unique = new Map<string, RawCanonicalKitchenItem>()
        snapshot.docs.forEach((documentSnapshot) => {
          unique.set(documentSnapshot.ref.path, {
            id: documentSnapshot.id,
            data: documentSnapshot.data(),
          })
        })
        const rawItems = [...unique.values()]
        const orderIds = [
          ...new Set(
            rawItems
              .map((item) => stringValue(item.data.orderId))
              .filter(Boolean)
          ),
        ]
        const parentContexts = await loadParentContexts(
          input.db,
          input.restaurantId,
          orderIds
        )
        if (!active || currentGeneration !== generation) return

        let invalidDocumentCount = 0
        const items = rawItems.flatMap((rawItem) => {
          const orderId = stringValue(rawItem.data.orderId)
          const parent = parentContexts.get(orderId)
          if (!parent) {
            invalidDocumentCount += 1
            return []
          }
          const view = toKitchenOrderItemView(rawItem, parent)
          if (!view) {
            invalidDocumentCount += 1
            return []
          }
          return [view]
        })
        const modes = new Map(
          [...parentContexts].map(([orderId, parent]) => [orderId, parent.preparationModes])
        )
        const groups = sortKitchenGroups(groupKitchenItems(items, modes))
        const isSaturated = isKitchenReadSaturated(
          snapshot.size,
          KITCHEN_ACTIVE_ITEM_LIMIT
        )
        if (isSaturated) {
          input.log?.warn("KITCHEN_CANONICAL_READ_SATURATED", {
            restaurantId: input.restaurantId,
            limit: KITCHEN_ACTIVE_ITEM_LIMIT,
          })
        }
        input.onData({
          items,
          groups,
          columns: selectKitchenColumns(groups),
          counters: countKitchenColumns(items),
          isSaturated,
          invalidDocumentCount,
        })
      } catch (error) {
        if (active && currentGeneration === generation) {
          input.onError(asError(error))
        }
      }
    },
    (error) => {
      if (active) input.onError(asError(error))
    }
  )

  return () => {
    active = false
    generation += 1
    unsubscribe()
  }
}

async function loadParentContexts(
  db: Firestore,
  restaurantId: string,
  orderIds: readonly string[]
) {
  const contexts = new Map<string, KitchenParentContext>()
  for (const ids of chunks(orderIds, 30)) {
    if (ids.length === 0) continue
    const snapshot = await getDocs(
      query(
        collection(db, "restaurants", restaurantId, "orders"),
        where(documentId(), "in", ids)
      )
    )
    snapshot.docs.forEach((documentSnapshot) => {
      const data = documentSnapshot.data()
      const embeddedItems = Array.isArray(data.items) ? data.items : null
      contexts.set(documentSnapshot.id, {
        restaurantId,
        orderId: documentSnapshot.id,
        orderType: stringValue(data.orderType ?? data.type) || "unknown",
        tableNumber: nullableString(data.tableNumber ?? data.tableName ?? data.tableId ?? data.table),
        orderNumber:
          stringValue(data.displayId ?? data.orderNumber ?? data.reference) ||
          documentSnapshot.id,
        customerName: nullableString(data.customerName ?? data.customer?.name),
        createdAt: timestampMs(data.createdAt),
        canonicalItemCount: integerOr(data.canonicalItemCount, 0),
        canonicalProjectionCount: embeddedItems?.length ?? null,
        preparationModes: new Set(
          (embeddedItems ?? [])
            .map((item) => stringValue(item?.preparationMode))
            .filter(Boolean)
        ),
      })
    })
  }
  return contexts
}

function chunks<T>(values: readonly T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function nullableString(value: unknown) {
  const normalized = stringValue(value)
  return normalized || null
}

function integerOr(value: unknown, fallback: number) {
  return Number.isInteger(value) ? Number(value) : fallback
}

function asError(value: unknown) {
  return value instanceof Error ? value : new Error("Lecture Cuisine indisponible.")
}
