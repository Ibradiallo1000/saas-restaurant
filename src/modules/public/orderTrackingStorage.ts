export const TRACKING_RETENTION_HOURS = 24

const TRACKING_RETENTION_MS = TRACKING_RETENTION_HOURS * 60 * 60 * 1000

type TrackedOrderRecord = {
  restaurantId: string
  orderId: string
  tableSessionId?: string | null
  createdAt: number
  updatedAt: number
  completedAt?: number | null
}

type RememberTrackedOrderInput = {
  restaurantId: string
  orderId: string
  tableSessionId?: string | null
  isCompleted?: boolean
}

function latestOrderKey(restaurantId: string) {
  return `restaurant_latest_order_${restaurantId}`
}

function latestTableSessionKey(restaurantId: string) {
  return `restaurant_latest_table_session_${restaurantId}`
}

function trackingRecordKey(restaurantId: string) {
  return `restaurant_latest_order_tracking_${restaurantId}`
}

function isStorageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage)
}

function readTrackingRecord(restaurantId: string): TrackedOrderRecord | null {
  if (!isStorageAvailable()) return null

  const raw = window.localStorage.getItem(trackingRecordKey(restaurantId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<TrackedOrderRecord>
    if (!parsed.orderId || !parsed.restaurantId) return null
    return {
      restaurantId: parsed.restaurantId,
      orderId: parsed.orderId,
      tableSessionId: parsed.tableSessionId ?? null,
      createdAt: Number(parsed.createdAt || Date.now()),
      updatedAt: Number(parsed.updatedAt || Date.now()),
      completedAt: parsed.completedAt ? Number(parsed.completedAt) : null,
    }
  } catch {
    return null
  }
}

function writeTrackingRecord(record: TrackedOrderRecord) {
  if (!isStorageAvailable()) return

  const payload = JSON.stringify(record)
  window.localStorage.setItem(trackingRecordKey(record.restaurantId), payload)
  window.localStorage.setItem(latestOrderKey(record.restaurantId), record.orderId)

  if (record.tableSessionId) {
    window.localStorage.setItem(latestTableSessionKey(record.restaurantId), record.tableSessionId)
  }

  window.sessionStorage?.setItem(trackingRecordKey(record.restaurantId), payload)
}

export function rememberTrackedOrder(input: RememberTrackedOrderInput) {
  if (!input.restaurantId || !input.orderId || !isStorageAvailable()) return

  const now = Date.now()
  const previous = readTrackingRecord(input.restaurantId)
  const isSameOrder = previous?.orderId === input.orderId

  writeTrackingRecord({
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    tableSessionId: input.tableSessionId ?? previous?.tableSessionId ?? null,
    createdAt: isSameOrder ? previous?.createdAt || now : now,
    updatedAt: now,
    completedAt: input.isCompleted
      ? previous?.completedAt || now
      : isSameOrder
        ? previous?.completedAt ?? null
        : null,
  })
}

export function getLatestTrackedOrder(restaurantId: string) {
  if (!isStorageAvailable()) return null

  const record = readTrackingRecord(restaurantId)
  if (record) {
    if (isTrackedOrderExpired(record)) return null
    return {
      orderId: record.orderId,
      tableSessionId: record.tableSessionId || window.localStorage.getItem(latestTableSessionKey(restaurantId)),
    }
  }

  const legacyOrderId = window.localStorage.getItem(latestOrderKey(restaurantId))
  if (!legacyOrderId) return null

  return {
    orderId: legacyOrderId,
    tableSessionId: window.localStorage.getItem(latestTableSessionKey(restaurantId)),
  }
}

export function isCurrentTrackedOrderExpired(restaurantId: string, orderId: string) {
  const record = readTrackingRecord(restaurantId)
  if (!record || record.orderId !== orderId) return false
  return isTrackedOrderExpired(record)
}

function isTrackedOrderExpired(record: TrackedOrderRecord) {
  if (!record.completedAt) return false
  return Date.now() - record.completedAt > TRACKING_RETENTION_MS
}
