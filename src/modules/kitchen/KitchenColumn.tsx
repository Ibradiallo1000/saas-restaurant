"use client"

import type { RestaurantOrder } from "@/modules/restaurant/types"
import type { KitchenLifecycleStatus, OrderOperationStatus } from "@/lib/order-lifecycle"
import { KitchenOrderCard } from "./KitchenOrderCard"

type KitchenColumnProps = {
  title: string
  status: KitchenLifecycleStatus
  orders: RestaurantOrder[]
  onUpdateStatus: (
    orderId: string,
    status: OrderOperationStatus
  ) => Promise<void>
}

export function KitchenColumn({
  title,
  status,
  orders,
  onUpdateStatus,
}: KitchenColumnProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border bg-card">
      {/* 🔥 HEADER SIMPLIFIÉ - Plus de détails techniques */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-card-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
          {orders.length}
        </span>
      </header>

      {/* 🔥 CONTENU - PAS de fond supplémentaire */}
      <div className="flex-1 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <div className="py-8 text-center text-sm font-medium text-muted-foreground">
            Aucune commande
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
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
