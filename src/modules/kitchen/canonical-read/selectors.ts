import {
  ACTIVE_KITCHEN_ITEM_STATUSES,
  type ActiveKitchenItemStatus,
  type KitchenOrderGroup,
  type KitchenOrderItemView,
  type KitchenParentContext,
  type RawCanonicalKitchenItem,
} from "./model.ts"

export function calculateKitchenActiveQuantity(input: {
  quantity: number
  cancelledQuantity: number
}) {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) return null
  if (!Number.isInteger(input.cancelledQuantity) || input.cancelledQuantity < 0) return null
  if (input.cancelledQuantity > input.quantity) return null
  return input.quantity - input.cancelledQuantity
}

export function classifyKitchenOrderReadState(input: {
  canonicalItemCount: number
  canonicalProjectionCount: number | null
  canonicalDocumentsFound: number
}): KitchenOrderItemView["legacyState"] {
  if (input.canonicalDocumentsFound === 0) return "legacy_read_only"
  if (
    input.canonicalItemCount <= 0 ||
    (
      input.canonicalProjectionCount != null &&
      input.canonicalProjectionCount !== input.canonicalItemCount
    )
  ) return "canonical_inconsistent"
  return "canonical"
}

export function toKitchenOrderItemView(
  raw: RawCanonicalKitchenItem,
  parent: KitchenParentContext,
  now = Date.now()
): KitchenOrderItemView | null {
  const data = raw.data
  if (
    stringValue(data.restaurantId) !== parent.restaurantId ||
    stringValue(data.orderId) !== parent.orderId ||
    stringValue(data.preparationMode) !== "kitchen" ||
    !ACTIVE_KITCHEN_ITEM_STATUSES.includes(stringValue(data.status) as ActiveKitchenItemStatus)
  ) return null

  const quantity = integerValue(data.quantity)
  const cancelledQuantity = integerValue(data.cancelledQuantity)
  const servedQuantity = integerValue(data.servedQuantity)
  // LOT 1 documents created before explicit line versioning start at version 1,
  // exactly like FirestoreAtomicOrderCommandStore.
  const version = data.version == null ? 1 : integerValue(data.version)
  const activeQuantity = calculateKitchenActiveQuantity({ quantity, cancelledQuantity })
  const createdAt = timestampMs(data.createdAt)
  const updatedAt = timestampMs(data.updatedAt) || createdAt
  if (
    !raw.id ||
    !stringValue(data.productId) ||
    !stringValue(data.nameSnapshot ?? data.name) ||
    activeQuantity == null ||
    activeQuantity <= 0 ||
    servedQuantity < 0 ||
    servedQuantity > activeQuantity ||
    version < 1 ||
    createdAt <= 0
  ) return null

  const readState = classifyKitchenOrderReadState({
    canonicalItemCount: parent.canonicalItemCount,
    canonicalProjectionCount: parent.canonicalProjectionCount,
    canonicalDocumentsFound: 1,
  })
  return {
    restaurantId: parent.restaurantId,
    orderId: parent.orderId,
    orderItemId: raw.id,
    productId: stringValue(data.productId),
    productName: stringValue(data.nameSnapshot ?? data.name),
    quantity,
    activeQuantity,
    cancelledQuantity,
    servedQuantity,
    status: stringValue(data.status) as ActiveKitchenItemStatus,
    version,
    preparationMode: "kitchen",
    variants: arrayValue(data.variants ?? data.selectedOptions),
    supplements: arrayValue(data.supplements),
    customerNote: nullableString(data.customerNote ?? data.instructions),
    orderType: parent.orderType,
    tableNumber: parent.tableNumber,
    orderNumber: parent.orderNumber,
    customerName: parent.customerName,
    createdAt,
    updatedAt,
    elapsedTime: Math.max(0, now - createdAt),
    legacyState: readState,
    actionsAllowed: readState === "canonical",
  }
}

export function isKitchenReadSaturated(count: number, limit: number) {
  return Number.isInteger(count) && Number.isInteger(limit) && limit > 0 && count >= limit
}

export function groupKitchenItems(
  items: readonly KitchenOrderItemView[],
  parentModes: ReadonlyMap<string, ReadonlySet<string>> = new Map()
) {
  const grouped = new Map<string, KitchenOrderItemView[]>()
  for (const item of items) {
    const current = grouped.get(item.orderId) ?? []
    current.push(item)
    grouped.set(item.orderId, current)
  }
  return [...grouped.entries()].map(([orderId, orderItems]): KitchenOrderGroup => {
    const sortedItems = sortKitchenItems(orderItems)
    const first = sortedItems[0]
    const modes = parentModes.get(orderId)
    return {
      orderId,
      restaurantId: first.restaurantId,
      orderType: first.orderType,
      tableNumber: first.tableNumber,
      orderNumber: first.orderNumber,
      customerName: first.customerName,
      createdAt: first.createdAt,
      isMixed: Boolean(modes && modes.size > 1),
      legacyState: sortedItems.some((item) => item.legacyState === "canonical_inconsistent")
        ? "canonical_inconsistent"
        : "canonical",
      items: sortedItems,
    }
  })
}

export function sortKitchenItems(items: readonly KitchenOrderItemView[]) {
  return [...items].sort(
    (left, right) =>
      left.createdAt - right.createdAt ||
      left.orderItemId.localeCompare(right.orderItemId)
  )
}

export function sortKitchenGroups(groups: readonly KitchenOrderGroup[]) {
  return [...groups].sort(
    (left, right) =>
      left.createdAt - right.createdAt ||
      left.orderId.localeCompare(right.orderId)
  )
}

export function selectKitchenColumns(groups: readonly KitchenOrderGroup[]) {
  const columns: Record<ActiveKitchenItemStatus, KitchenOrderGroup[]> = {
    pending: [],
    preparing: [],
    ready: [],
  }
  for (const status of ACTIVE_KITCHEN_ITEM_STATUSES) {
    columns[status] = sortKitchenGroups(
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.status === status),
        }))
        .filter((group) => group.items.length > 0)
    )
  }
  return columns
}

export function countKitchenColumns(items: readonly KitchenOrderItemView[]) {
  return items.reduce<Record<ActiveKitchenItemStatus, number>>(
    (counts, item) => {
      counts[item.status] += 1
      return counts
    },
    { pending: 0, preparing: 0, ready: 0 }
  )
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function nullableString(value: unknown) {
  const normalized = stringValue(value)
  return normalized || null
}

function integerValue(value: unknown) {
  return Number.isInteger(value) ? Number(value) : -1
}

function arrayValue(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

export function timestampMs(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value && typeof value === "object") {
    const timestamp = value as { toMillis?: () => number; toDate?: () => Date }
    const millis = timestamp.toMillis?.() ?? timestamp.toDate?.().getTime()
    return typeof millis === "number" && Number.isFinite(millis) ? millis : 0
  }
  return 0
}
