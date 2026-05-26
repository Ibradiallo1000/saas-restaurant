"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { normalizePaymentMethod, normalizePaymentStatus } from "@/lib/order-payment"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { ORDER_OPERATION_STATUS, getOrderStatus } from "@/lib/order-lifecycle"
import {
  getOrderItemName,
  getOrderItemPrice,
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
  const status = getOrderStatus(order)
  const paymentStatus = normalizePaymentStatus(order.paymentStatus)
  const paymentMethod = normalizePaymentMethod(order.paymentMethod)
  const isKitchen = mode === "kitchen"
  const orderCode = getOrderDisplayId(order)
  const tableLabel = order.tableNumber ?? order.tableId ?? (order as any).table ?? null

  return (
    <Card className={cn("overflow-hidden bg-card", isKitchen && "border-2", statusBorder(status))}>
      <CardHeader className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className={cn(isKitchen ? "text-xl" : "text-base", "break-words")}>
              {isKitchen ? getOrderLocationLabel(order) : orderCode}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getOrderTypeLabel(order.type)}</Badge>
              <Badge className={statusClass(status)}>{status}</Badge>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-bold">{getOrderTotal(order).toLocaleString()} FCFA</div>
            <div className="text-xs text-muted-foreground">{totalItems} article{totalItems > 1 ? "s" : ""}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        {isKitchen ? (
          <div className="space-y-2 text-lg font-semibold">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.productId}-${getOrderItemName(item)}`} className="flex justify-between gap-3 rounded-md bg-muted p-3">
                <span className="min-w-0 break-words">{getOrderItemName(item)}</span>
                <span className="shrink-0">x{item.quantity}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-2 rounded-md border bg-background/40 p-3 text-sm">
              {order.items.map((item) => (
                <div key={`${order.id}-${item.productId}-${getOrderItemName(item)}`} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words font-medium">
                    {item.quantity}x {getOrderItemName(item)}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {(getOrderItemPrice(item) * item.quantity).toLocaleString()} FCFA
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-md bg-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase text-muted-foreground">Total</span>
                <span className="text-lg font-black text-primary">
                  {getOrderTotal(order).toLocaleString()} FCFA
                </span>
              </div>
            </div>

            <div className="space-y-1 rounded-md border p-3 text-xs">
              <div className="font-bold">Paiement :</div>
              <div>Type : {formatPaymentType((order as any).paymentType, paymentMethod)}</div>
              <div>Methode : {formatPaymentMethod(order.paymentMethod)}</div>
              <div>Statut : {order.paymentStatus ?? "pending"}</div>
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="rounded-md border p-3">
                Client : {order.customerPhone ? `Tel. ${order.customerPhone}` : "telephone absent"}
              </div>
              {order.type === "table" || tableLabel ? (
                <div className="rounded-md border p-3">Table : {tableLabel ?? "sur place"}</div>
              ) : null}
            </div>
          </>
        )}

        <div className={cn("grid gap-2", isKitchen ? "grid-cols-2" : "grid-cols-3")}>
          {status === ORDER_OPERATION_STATUS.PENDING && onAccept ? (
            <Button className="h-11" onClick={() => onAccept(order)}>Accepter</Button>
          ) : null}
          {status === ORDER_OPERATION_STATUS.PENDING && onPreparing ? (
            <Button className="h-11" onClick={() => onPreparing(order)}>Commencer</Button>
          ) : null}
          {status === ORDER_OPERATION_STATUS.IN_PREPARATION && onReady ? (
            <Button className="h-11" onClick={() => onReady(order)}>Marquer pret</Button>
          ) : null}
          {status === ORDER_OPERATION_STATUS.READY && onServed ? (
            <Button className="h-11" onClick={() => onServed(order)}>Servir</Button>
          ) : null}
          {!isKitchen && onSelect ? (
            <Button variant="outline" className="h-11" onClick={() => onSelect(order)}>Voir</Button>
          ) : null}
          {!isKitchen ? (
            <Button variant="outline" className="h-11" onClick={() => window.print()}>Imprimer</Button>
          ) : null}
          {!isKitchen && paymentStatus !== "paid" && onPaid ? (
            <Button className="h-11 bg-green-600 hover:bg-green-700" onClick={() => onPaid(order)}>Encaisser</Button>
          ) : null}
          {isKitchen && status !== ORDER_OPERATION_STATUS.COMPLETED && onCancel ? (
            <Button variant="destructive" className="h-11" onClick={() => onCancel(order)}>Annuler</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function formatPaymentMethod(method?: string | null) {
  if (!method) return "Non defini"
  if (method === "cash") return "Especes"
  if (method === "orange_money") return "Orange"
  if (method === "mtn_money") return "MTN"
  if (method === "wave") return "Wave"
  if (method === "mobile") return "Mobile"
  return method
}

function formatPaymentType(type?: string | null, method?: string | null) {
  if (type === "cash" || method === "cash") return "cash"
  if (type === "mobile" || method) return "mobile"
  return "pending"
}

function statusClass(status: string) {
  switch (status) {
    case ORDER_OPERATION_STATUS.PENDING:
      return "bg-secondary text-white"
    case ORDER_OPERATION_STATUS.IN_PREPARATION:
      return "bg-orange-500 text-white"
    case ORDER_OPERATION_STATUS.READY:
      return "bg-blue-600 text-white"
    case ORDER_OPERATION_STATUS.SERVED:
      return "bg-green-600 text-white"
    case ORDER_OPERATION_STATUS.COMPLETED:
      return "bg-emerald-700 text-white"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function statusBorder(status: string) {
  switch (status) {
    case ORDER_OPERATION_STATUS.IN_PREPARATION:
      return "border-orange-500"
    case ORDER_OPERATION_STATUS.READY:
      return "border-blue-600"
    default:
      return "border-border"
  }
}
