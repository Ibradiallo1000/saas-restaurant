import { ORDER_TYPE } from "@/lib/constants"
import type { OrderLocation, OrderType, RestaurantOrder } from "@/types"

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [ORDER_TYPE.DINE_IN]: "Sur place",
  [ORDER_TYPE.TAKEAWAY]: "A emporter",
  [ORDER_TYPE.DELIVERY]: "Livraison",
  [ORDER_TYPE.ROOM_SERVICE]: "Chambre hotel",
}

export function getOrderTypeLabel(type?: string | null) {
  if (!type) return "Commande"
  return ORDER_TYPE_LABELS[type as OrderType] ?? type
}

export function getOrderLocationLabel(
  order: Pick<RestaurantOrder, "type" | "location" | "tableNumber" | "roomNumber" | "tableId" | "roomId" | "deliveryAddress">
) {
  const location = normalizeOrderLocation(order)

  if (order.type === ORDER_TYPE.DINE_IN) {
    return location.tableNumber ? `Table ${location.tableNumber}` : "Sur place"
  }

  if (order.type === ORDER_TYPE.DELIVERY) {
    return location.address || "Livraison"
  }

  if (order.type === ORDER_TYPE.ROOM_SERVICE) {
    return location.roomNumber ? `Chambre ${location.roomNumber}` : "Chambre hotel"
  }

  return "A emporter"
}

export function normalizeOrderLocation(
  order: Pick<RestaurantOrder, "location" | "tableNumber" | "roomNumber" | "tableId" | "roomId" | "deliveryAddress">
): OrderLocation {
  return {
    tableNumber: order.location?.tableNumber ?? order.tableNumber ?? order.tableId ?? undefined,
    roomNumber: order.location?.roomNumber ?? order.roomNumber ?? order.roomId ?? undefined,
    address: order.location?.address ?? order.deliveryAddress ?? undefined,
    note: order.location?.note,
  }
}

export function getOrderTotal(order: Pick<RestaurantOrder, "total" | "totalAmount">) {
  return order.total ?? order.totalAmount ?? 0
}

export function getOrderItemName(item: RestaurantOrder["items"][number]) {
  return item.name ?? item.nameSnapshot
}

export function getOrderItemPrice(item: RestaurantOrder["items"][number]) {
  return item.price ?? item.priceSnapshot ?? 0
}
