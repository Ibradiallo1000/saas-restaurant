"use client"

import { ORDER_OPERATION_STATUS, getOrderStatus } from "@/lib/order-lifecycle"
import type { RestaurantOrder } from "@/types"
import { OrderCard } from "@/components/orders/OrderCard"

const COLUMNS = [
  { status: ORDER_OPERATION_STATUS.PENDING, title: "Nouvelles" },
  { status: ORDER_OPERATION_STATUS.IN_PREPARATION, title: "En preparation" },
  { status: ORDER_OPERATION_STATUS.READY, title: "Pretes" },
  { status: ORDER_OPERATION_STATUS.SERVED, title: "Servies" },
] as const

type KitchenBoardProps = {
  orders: RestaurantOrder[]
  onPreparing: (order: RestaurantOrder) => void
  onReady: (order: RestaurantOrder) => void
}

export function KitchenBoard({ orders, onPreparing, onReady }: KitchenBoardProps) {
  return (
    <div className="grid h-[calc(100vh-96px)] grid-cols-1 gap-4 lg:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnOrders = orders.filter((order) => {
          const status = getOrderStatus(order)
          const kitchenStatus =
            status === ORDER_OPERATION_STATUS.COMPLETED
              ? ORDER_OPERATION_STATUS.SERVED
              : status

          return kitchenStatus === column.status
        })

        return (
          <section key={column.status} className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
            <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 text-white">
              <h2 className="font-semibold">{column.title}</h2>
              <span className="rounded-full bg-background/10 px-2 py-1 text-xs font-bold">{columnOrders.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  mode="kitchen"
                  onPreparing={column.status === ORDER_OPERATION_STATUS.PENDING ? onPreparing : undefined}
                  onReady={column.status === ORDER_OPERATION_STATUS.IN_PREPARATION ? onReady : undefined}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
