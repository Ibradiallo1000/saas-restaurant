import type { RestaurantOrder } from "@/modules/restaurant/types"

import type {
  ActiveKitchenItemStatus,
  KitchenOrderGroup,
  KitchenOrderItemView,
} from "./model.ts"

export interface CanonicalKitchenBoardOrder extends RestaurantOrder {
  __canonicalOrderId: string
  __canonicalStatus: ActiveKitchenItemStatus
  __canonicalItems: KitchenOrderItemView[]
}

export function adaptCanonicalGroupsToKitchenBoard(
  groups: readonly KitchenOrderGroup[]
): CanonicalKitchenBoardOrder[] {
  return groups.flatMap((group) =>
    (["pending", "preparing", "ready"] as const).flatMap((status) => {
      const items = group.items.filter((item) => item.status === status)
      if (items.length === 0) return []
      const first = items[0]
      return [{
        id: `${group.orderId}:${status}`,
        __canonicalOrderId: group.orderId,
        __canonicalStatus: status,
        __canonicalItems: items,
        restaurantId: group.restaurantId,
        displayId: group.orderNumber,
        orderNumber: group.orderNumber,
        orderType: group.orderType,
        type: group.orderType,
        table: group.tableNumber,
        tableNumber: group.tableNumber,
        customerName: group.customerName,
        customer: group.customerName ? { name: group.customerName } : null,
        kitchenStatus: status,
        orderStatus: status,
        paymentStatus: "verified",
        createdAt: timestampLike(first.createdAt),
        updatedAt: timestampLike(
          Math.max(...items.map((item) => item.updatedAt))
        ),
        items: items.map((item) => ({
          id: item.orderItemId,
          orderItemId: item.orderItemId,
          productId: item.productId,
          name: item.productName,
          quantity: item.activeQuantity,
          status: item.status,
          version: item.version,
          preparationMode: "kitchen",
          selectedOptions: item.variants,
          supplements: item.supplements,
          instructions: item.customerNote,
          createdAt: timestampLike(item.createdAt),
          updatedAt: timestampLike(item.updatedAt),
        })),
      } as unknown as CanonicalKitchenBoardOrder]
    })
  )
}

export function isCanonicalKitchenBoardOrder(
  order: RestaurantOrder
): order is CanonicalKitchenBoardOrder {
  return (
    typeof (order as Partial<CanonicalKitchenBoardOrder>).__canonicalOrderId === "string" &&
    Array.isArray((order as Partial<CanonicalKitchenBoardOrder>).__canonicalItems)
  )
}

function timestampLike(milliseconds: number) {
  return {
    toMillis: () => milliseconds,
    toDate: () => new Date(milliseconds),
  }
}

