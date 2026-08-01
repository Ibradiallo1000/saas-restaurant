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
  type DocumentData,
  type Query,
  type QuerySnapshot,
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
  restaurantId: string,
  preparationStationId?: string
): Query {
  return query(
    collectionGroup(db, "orderItems"),
    where("restaurantId", "==", restaurantId),
    where(preparationStationId ? "preparationStationId" : "preparationMode", "==", preparationStationId || "kitchen"),
    where("status", "in", ["pending", "preparing", "ready"]),
    orderBy("createdAt", "asc"),
    limit(KITCHEN_ACTIVE_ITEM_LIMIT)
  )
}

export function subscribeCanonicalKitchenRead(input: {
  db: Firestore
  restaurantId: string
  preparationStationId?: string
  onData(snapshot: CanonicalKitchenSnapshot): void
  onError(error: Error): void
  log?: Pick<Console, "warn">
}): Unsubscribe {
  let active = true
  let generation = 0
  let latestKitchenSnapshot: QuerySnapshot<DocumentData> | null = null
  let parentUnsubscribes: Unsubscribe[] = []
  const kitchenQuery = createCanonicalKitchenItemsQuery(input.db, input.restaurantId, input.preparationStationId)

  const refresh = async () => {
      const snapshot = latestKitchenSnapshot
      if (!snapshot) return
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
        const [parentContexts, productImages] = await Promise.all([
          loadParentContexts(input.db, input.restaurantId, orderIds),
          loadProductImages(
            input.db,
            input.restaurantId,
            [...new Set(rawItems.map((item) => stringValue(item.data.productId)).filter(Boolean))]
          ),
        ])
        if (!active || currentGeneration !== generation) return

        let invalidDocumentCount = 0
        const items = rawItems.flatMap((rawItem) => {
          const orderId = stringValue(rawItem.data.orderId)
          const parent = parentContexts.get(orderId)
          if (!parent) {
            invalidDocumentCount += 1
            return []
          }
          const view = toKitchenOrderItemView(
            rawItem,
            parent,
            Date.now(),
            productImages.get(stringValue(rawItem.data.productId)) ?? null
          )
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
  }

  const syncParentSubscriptions = (snapshot: QuerySnapshot<DocumentData>) => {
    parentUnsubscribes.forEach((unsubscribe) => unsubscribe())
    parentUnsubscribes = []
    const orderIds = [...new Set(
      snapshot.docs.map((item) => stringValue(item.data().orderId)).filter(Boolean)
    )]
    for (const ids of chunks(orderIds, 30)) {
      if (!ids.length) continue
      parentUnsubscribes.push(onSnapshot(
        query(
          collection(input.db, "restaurants", input.restaurantId, "orders"),
          where(documentId(), "in", ids)
        ),
        () => void refresh(),
        (error) => {
          if (active) input.onError(asError(error))
        }
      ))
    }
  }

  const unsubscribeItems = onSnapshot(
    kitchenQuery,
    (snapshot) => {
      latestKitchenSnapshot = snapshot
      syncParentSubscriptions(snapshot)
      void refresh()
    },
    (error) => {
      if (active) input.onError(asError(error))
    }
  )
  return () => {
    active = false
    generation += 1
    unsubscribeItems()
    parentUnsubscribes.forEach((unsubscribe) => unsubscribe())
    parentUnsubscribes = []
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
      const tableId = nullableString(data.tableId)
      const storedTableLabel = nullableString(data.table ?? data.tableName ?? data.tableNumber)
      contexts.set(documentSnapshot.id, {
        restaurantId,
        orderId: documentSnapshot.id,
        orderType: stringValue(data.orderType ?? data.type) || "unknown",
        serviceMode: stringValue(data.serviceMode ?? data.orderType ?? data.type) || "unknown",
        paymentStatus: stringValue(data.paymentStatus) || "unpaid",
        tableId,
        tableNumber: storedTableLabel && storedTableLabel !== tableId
          ? storedTableLabel
          : null,
        orderNumber:
          stringValue(data.displayId ?? data.orderNumber ?? data.reference) ||
          documentSnapshot.id,
        customerName: nullableString(data.customerName ?? data.customer?.name),
        customerPhone: nullableString(
          data.customer?.phone ?? data.customerPhone ?? data.phoneNumber
        ),
        deliveryAddress: deliveryAddressValue(data.deliveryAddress ?? data.delivery?.address),
        orderNote: nullableString(
          data.notes ?? data.customerNote ?? data.customerNotes ?? data.kitchenNote
        ),
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
  const unresolvedTableIds = [...new Set(
    [...contexts.values()]
      .filter((context) => !context.tableNumber && context.tableId)
      .map((context) => context.tableId as string)
  )]
  for (const ids of chunks(unresolvedTableIds, 30)) {
    const snapshot = await getDocs(query(
      collection(db, "restaurants", restaurantId, "tables"),
      where(documentId(), "in", ids)
    ))
    const labels = new Map(snapshot.docs.map((table) => [
      table.id,
      nullableString(table.data().name ?? table.data().label ?? table.data().number),
    ]))
    contexts.forEach((context, orderId) => {
      if (!context.tableNumber && context.tableId && labels.get(context.tableId)) {
        contexts.set(orderId, { ...context, tableNumber: labels.get(context.tableId) ?? null })
      }
    })
  }
  return contexts
}

async function loadProductImages(
  db: Firestore,
  restaurantId: string,
  productIds: readonly string[]
) {
  const images = new Map<string, string>()
  for (const ids of chunks(productIds, 30)) {
    if (ids.length === 0) continue
    const snapshot = await getDocs(query(
      collection(db, "restaurants", restaurantId, "products"),
      where(documentId(), "in", ids)
    ))
    snapshot.docs.forEach((product) => {
      const imageUrl = nullableString(
        product.data().imageUrl ?? product.data().image ?? product.data().photoUrl
      )
      if (imageUrl) images.set(product.id, imageUrl)
    })
  }
  return images
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

function deliveryAddressValue(value: unknown) {
  if (typeof value === "string") return value.trim() || null
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : null
}

function integerOr(value: unknown, fallback: number) {
  return Number.isInteger(value) ? Number(value) : fallback
}

function asError(value: unknown) {
  return value instanceof Error ? value : new Error("Lecture Cuisine indisponible.")
}
