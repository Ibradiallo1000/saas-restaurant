export function mergeCanonicalPosOrders(
  parents: readonly any[],
  canonicalItems: readonly any[]
) {
  const byOrder = new Map<string, any[]>()
  canonicalItems.forEach((item) => {
    const orderId = String(item.orderId ?? "")
    if (!orderId) return
    const current = byOrder.get(orderId) ?? []
    current.push(item)
    byOrder.set(orderId, current)
  })
  return parents.map((parent) => {
    const items = byOrder.get(String(parent.id)) ?? []
    const canonicalExpected = Number(parent.canonicalItemCount ?? 0)
    if (items.length === 0 && canonicalExpected <= 0) {
      return { ...parent, __canonicalPos: false, __legacyReadOnly: true }
    }
    return {
      ...parent,
      items: items.sort(compareCanonicalItems),
      __canonicalPos: true,
      __legacyReadOnly: false,
      __canonicalIncomplete:
        canonicalExpected > 0 && canonicalExpected !== items.length,
    }
  })
}

const ACTIVE_POS_OPERATION_STATUSES = new Set(["pending", "preparing", "ready"])

export function getTerminalCashSessionId(order: {
  completedCashSessionId?: unknown
  paymentCashSessionId?: unknown
  cashSessionId?: unknown
}) {
  for (const value of [
    order.completedCashSessionId,
    order.paymentCashSessionId,
    order.cashSessionId,
  ]) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export function isPosCollectionCandidate(
  order: {
    paymentStatus?: unknown
    completedCashSessionId?: unknown
    paymentCashSessionId?: unknown
    cashSessionId?: unknown
  },
  operationStatus: string,
  activeCashSessionId?: string | null
) {
  const isPaid = order.paymentStatus === "paid" || order.paymentStatus === "validated"
  if (ACTIVE_POS_OPERATION_STATUSES.has(operationStatus)) return true
  if (operationStatus === "served" && !isPaid) return true
  if (
    order.paymentStatus === "pending_cash" ||
    order.paymentStatus === "pending_mobile" ||
    order.paymentStatus === "pending_verification"
  ) {
    return true
  }
  if (!["served", "picked_up", "completed"].includes(operationStatus)) return false
  if (!activeCashSessionId) return false
  return getTerminalCashSessionId(order) === activeCashSessionId
}

export function resolvePosOrderColumn(
  order: { paymentStatus?: unknown },
  operationStatus: string
) {
  const isPaid = order.paymentStatus === "paid" || order.paymentStatus === "validated"
  if (
    isPaid &&
    (operationStatus === "served" ||
      operationStatus === "picked_up" ||
      operationStatus === "completed")
  ) {
    return "completed"
  }
  if (operationStatus === "picked_up") return "served"
  return [...ACTIVE_POS_OPERATION_STATUSES, "served", "completed"].includes(operationStatus)
    ? operationStatus
    : "pending"
}

function compareCanonicalItems(left: any, right: any) {
  const leftMs = left.createdAt?.toMillis?.() ?? left.createdAt?.getTime?.() ?? 0
  const rightMs = right.createdAt?.toMillis?.() ?? right.createdAt?.getTime?.() ?? 0
  return leftMs - rightMs || String(left.orderItemId).localeCompare(String(right.orderItemId))
}
