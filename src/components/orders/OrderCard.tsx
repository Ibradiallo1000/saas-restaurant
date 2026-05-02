"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { normalizePaymentStatus } from "@/lib/order-payment"
import { normalizeOrderStatus } from "@/lib/order-status"
import {
  getOrderItemName,
  getOrderLocationLabel,
  getOrderTotal,
  getOrderTypeLabel,
} from "@/lib/order-utils"
import { cn } from "@/lib/utils"
import type { RestaurantOrder } from "@/types"

type OrderCardProps = {
  order: RestaurantOrder
  mode?: "pos" | "kitchen" | "compact"
  onAccept?: (order: RestaurantOrder) => void
  onCancel?: (order: RestaurantOrder) => void
  onPreparing?: (order: RestaurantOrder) => void
  onReady?: (order: RestaurantOrder) => void
  onServed?: (order: RestaurantOrder) => void
  onPaid?: (order: RestaurantOrder) => void
  onSelect?: (order: RestaurantOrder) => void
}

export function OrderCard({
  order,
  mode = "compact",
  onAccept,
  onCancel,
  onPreparing,
  onReady,
  onServed,
  onPaid,
  onSelect,
}: OrderCardProps) {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const status = normalizeOrderStatus(order.status)
  const paymentStatus = normalizePaymentStatus(order.paymentStatus)

  return (
    <Card className={cn("overflow-hidden", mode === "kitchen" && "border-2", statusBorder(status))}>
      <CardHeader className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className={cn(mode === "kitchen" ? "text-xl" : "text-base")}>
              {getOrderLocationLabel(order)}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getOrderTypeLabel(order.type)}</Badge>
              <Badge className={statusClass(status)}>{status}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">{getOrderTotal(order).toLocaleString()} FCFA</div>
            <div className="text-xs text-muted-foreground">{totalItems} article{totalItems > 1 ? "s" : ""}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {mode === "kitchen" ? (
          <div className="space-y-2 text-lg font-semibold">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.productId}-${getOrderItemName(item)}`} className="flex justify-between gap-3 rounded-md bg-muted p-3">
                <span>{getOrderItemName(item)}</span>
                <span>x{item.quantity}</span>
              </div>
            ))}
          </div>
        ) : null}

        {mode !== "kitchen" ? (
          <button
            type="button"
            onClick={() => onSelect?.(order)}
            className="w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="font-medium">Details commande</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {order.customerName || "Client"} - {paymentStatus === PAYMENT_STATUS.VALIDATED ? "Payé" : "Paiement en attente"}
            </div>
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {status === ORDER_STATUS.NOUVELLE && onAccept ? (
            <Button className="h-11" onClick={() => onAccept(order)}>Accepter</Button>
          ) : null}
          {status === ORDER_STATUS.NOUVELLE && onPreparing ? (
            <Button className="h-11" onClick={() => onPreparing(order)}>Commencer</Button>
          ) : null}
          {status === ORDER_STATUS.PREPARATION && onReady ? (
            <Button className="h-11" onClick={() => onReady(order)}>Marquer pret</Button>
          ) : null}
          {status === ORDER_STATUS.PRETE && onServed ? (
            <Button className="h-11" onClick={() => onServed(order)}>Servir</Button>
          ) : null}
          {paymentStatus !== PAYMENT_STATUS.VALIDATED && onPaid ? (
            <Button variant="outline" className="h-11" onClick={() => onPaid(order)}>Paiement OK</Button>
          ) : null}
          {status !== ORDER_STATUS.PAYEE && onCancel ? (
            <Button variant="destructive" className="h-11" onClick={() => onCancel(order)}>Annuler</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function statusClass(status: RestaurantOrder["status"]) {
  switch (status) {
    case ORDER_STATUS.NOUVELLE:
      return "bg-zinc-500"
    case ORDER_STATUS.PREPARATION:
      return "bg-orange-500"
    case ORDER_STATUS.PRETE:
      return "bg-blue-600"
    case ORDER_STATUS.SERVIE:
      return "bg-green-600"
    case ORDER_STATUS.PAYEE:
      return "bg-emerald-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function statusBorder(status: RestaurantOrder["status"]) {
  switch (status) {
    case ORDER_STATUS.PREPARATION:
      return "border-orange-500"
    case ORDER_STATUS.PRETE:
      return "border-blue-600"
    default:
      return "border-border"
  }
}
