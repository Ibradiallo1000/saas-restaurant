"use client"

import type { RestaurantOrder } from "@/modules/restaurant/types"
import type { OrderStatus } from "@/lib/order-status"
import { KitchenOrderCard } from "./KitchenOrderCard"

type KitchenColumnProps = {
  title: string
  status: OrderStatus
  orders: RestaurantOrder[]
  onUpdateStatus: (
    orderId: string,
    status: OrderStatus
  ) => Promise<void>
}

const STATUS_STYLES = {
  nouvelle: "border-yellow-300 bg-yellow-50",
  preparation: "border-orange-300 bg-orange-50",
  prete: "border-blue-300 bg-blue-50",
  servie: "border-green-300 bg-green-50",
  payee: "border-emerald-300 bg-emerald-50",
}

export function KitchenColumn({
  title,
  status,
  orders,
  onUpdateStatus,
}: KitchenColumnProps) {
  return (
    <section className={`flex h-full flex-col rounded-lg border ${STATUS_STYLES[status]}`}>
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-black uppercase text-gray-950">{title}</h2>

        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-gray-800 shadow-sm">
          {orders.length}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {orders.length === 0 ? (
          <div className="py-6 text-center text-gray-400">
            Aucune commande
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {orders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
