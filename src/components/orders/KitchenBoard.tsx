"use client"

import { ORDER_STATUS } from "@/lib/constants"
import { normalizeOrderStatus } from "@/lib/order-status"
import type { RestaurantOrder } from "@/types"
import { OrderCard } from "@/components/orders/OrderCard"

const COLUMNS = [
  { status: ORDER_STATUS.NOUVELLE, title: "Nouvelles" },
  { status: ORDER_STATUS.PREPARATION, title: "En preparation" },
  { status: ORDER_STATUS.PRETE, title: "Pretes" },
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
        const columnOrders = orders.filter((order) => normalizeOrderStatus(order.status) === column.status)

        return (
          <section key={column.status} className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/[0.04]">
            <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 text-white">
              <h2 className="font-semibold">{column.title}</h2>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold">{columnOrders.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  mode="kitchen"
                  onPreparing={column.status === ORDER_STATUS.NOUVELLE ? onPreparing : undefined}
                  onReady={column.status === ORDER_STATUS.PREPARATION ? onReady : undefined}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
