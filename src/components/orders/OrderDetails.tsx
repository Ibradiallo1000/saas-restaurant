"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { printCustomerReceipt, printKitchenTicket } from "@/lib/order-printing"
import { getOrderStatus } from "@/lib/order-lifecycle"
import {
  getOrderItemName,
  getOrderItemPrice,
  getOrderLocationLabel,
  getOrderTotal,
  getOrderTypeLabel,
} from "@/lib/order-utils"
import type { RestaurantOrder } from "@/types"

export function OrderDetails({ order }: { order: RestaurantOrder }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Commande #{order.id.slice(-6)}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {getOrderTypeLabel(order.type)} - {getOrderLocationLabel(order)}
            </p>
          </div>
          <Badge>{getOrderStatus(order)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 text-sm">
          <div className="font-semibold">Client</div>
          <div className="mt-1 text-muted-foreground">{order.customerName || "Non renseigne"}</div>
          <div className="text-muted-foreground">{order.customerPhone || "Telephone absent"}</div>
        </div>

        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={`${order.id}-${item.productId}-${getOrderItemName(item)}`} className="flex justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{getOrderItemName(item)}</div>
                {item.variants?.length ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.variants.map((variant) => `${variant.name}: ${variant.value}`).join(", ")}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="font-bold">x{item.quantity}</div>
                <div className="text-xs text-muted-foreground">{getOrderItemPrice(item).toLocaleString()} FCFA</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Paiement: {order.paymentStatus}</span>
          <span className="text-xl font-bold">{getOrderTotal(order).toLocaleString()} FCFA</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => printKitchenTicket(order)}>Ticket cuisine</Button>
          <Button onClick={() => printCustomerReceipt(order)}>Ticket client</Button>
        </div>
      </CardContent>
    </Card>
  )
}
