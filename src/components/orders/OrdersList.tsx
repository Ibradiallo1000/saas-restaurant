"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { OrderCard } from "@/components/orders/OrderCard"
import type { RestaurantOrder } from "@/types"

type OrdersListProps = {
  orders: RestaurantOrder[]
  isLoading?: boolean
  onAccept?: (order: RestaurantOrder) => void
  onCancel?: (order: RestaurantOrder) => void
  onPreparing?: (order: RestaurantOrder) => void
  onReady?: (order: RestaurantOrder) => void
  onServed?: (order: RestaurantOrder) => void
  onPaid?: (order: RestaurantOrder) => void
  onSelect?: (order: RestaurantOrder) => void
}

export function OrdersList({ orders, isLoading, ...actions }: OrdersListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44" />
        ))}
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Aucune commande active
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} mode="pos" {...actions} />
      ))}
    </div>
  )
}
