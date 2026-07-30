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

function compareCanonicalItems(left: any, right: any) {
  const leftMs = left.createdAt?.toMillis?.() ?? left.createdAt?.getTime?.() ?? 0
  const rightMs = right.createdAt?.toMillis?.() ?? right.createdAt?.getTime?.() ?? 0
  return leftMs - rightMs || String(left.orderItemId).localeCompare(String(right.orderItemId))
}
