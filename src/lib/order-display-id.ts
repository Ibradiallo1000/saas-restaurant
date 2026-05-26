type OrderDisplayLike = {
  id: string
  displayId?: string | null
  number?: number | string | null
  orderNumber?: number | string | null
}

export function getDisplayOrderId(order: OrderDisplayLike) {
  if (order.displayId) {
    return order.displayId.startsWith("CMD-") ? order.displayId : `CMD-${order.displayId}`
  }

  const explicitNumber = order.number ?? order.orderNumber
  if (explicitNumber !== undefined && explicitNumber !== null && explicitNumber !== "") {
    return `CMD-${String(explicitNumber).padStart(4, "0")}`
  }

  return `CMD-${hashOrderId(order.id).toString().padStart(4, "0")}`
}

export function getOrderDisplayId(order: OrderDisplayLike) {
  return getDisplayOrderId(order)
}

function hashOrderId(id: string) {
  let hash = 0

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 10000
  }

  return hash
}
