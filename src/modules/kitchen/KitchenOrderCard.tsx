"use client"

import * as React from "react"
import { CheckCircle, Clock, CookingPot, Package, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  ORDER_ITEM_STATUS,
  ORDER_OPERATION_STATUS,
  type OrderOperationStatus,
  nextOrderStatus,
  normalizeOrderItemStatus,
  normalizeOrderType,
  orderStatusFromKitchenStatus,
  isOrderPaid,
} from "@/lib/order-lifecycle"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { cn } from "@/lib/utils"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import { getKitchenOrderItems } from "@/utils/preparation-logic"

type KitchenOrderCardProps = {
  order: RestaurantOrder
  onUpdateStatus: (orderId: string, status: OrderOperationStatus) => Promise<void>
}

const statusLabels: Record<string, string> = {
  pending: "EN ATTENTE",
  preparing: "EN PR\u00c9PARATION",
  ready: "PR\u00caTES",
  served: "SERVIES",
  picked_up: "R\u00c9CUP\u00c9R\u00c9ES",
  completed: "TERMIN\u00c9ES",
}

const actionLabels: Record<string, string> = {
  pending: "EN ATTENTE",
  preparing: "EN PR\u00c9PARATION",
  ready: "PR\u00caTES",
  served: "SERVIES",
  picked_up: "R\u00c9CUP\u00c9R\u00c9ES",
  completed: "TERMIN\u00c9ES",
  en_preparation: "EN PR\u00c9PARATION",
  pretes: "PR\u00caTES",
  servies: "SERVIES",
}

const statusColors: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  preparing: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ready: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  served: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  picked_up: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  completed: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  preparing: <CookingPot className="h-3 w-3" />,
  ready: <CheckCircle className="h-3 w-3" />,
  served: <CheckCircle className="h-3 w-3" />,
  picked_up: <CheckCircle className="h-3 w-3" />,
  completed: <CheckCircle className="h-3 w-3" />,
}

type KitchenDisplayOrderType = "dine_in" | "pickup" | "delivery"

function getKitchenDisplayOrderType(order: RestaurantOrder): KitchenDisplayOrderType {
  const details = order as RestaurantOrder & {
    publicOrderType?: "pickup" | "delivery" | null
    type?: string
  }

  if (
    order.table ||
    order.tableId ||
    order.orderType === "dine_in" ||
    details.type === "table"
  ) {
    return "dine_in"
  }

  if (details.publicOrderType === "delivery" || order.orderType === "delivery") {
    return "delivery"
  }

  return "pickup"
}

const orderTypeLabels: Record<KitchenDisplayOrderType, string> = {
  dine_in: "SUR PLACE",
  pickup: "\u00c0 EMPORTER",
  delivery: "LIVRAISON",
}

function isPaymentLockedForKitchen(order: RestaurantOrder) {
  return normalizeOrderType(order.orderType) !== "dine_in" && !isOrderPaid(order)
}

function getCreatedAtMs(order: RestaurantOrder) {
  return (
    order.createdAt?.toMillis?.() ??
    order.createdAt?.toDate?.().getTime?.() ??
    Date.now()
  )
}

function formatElapsedTime(createdAtMs: number, nowMs: number) {
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - createdAtMs) / 60000))

  if (elapsedMinutes < 1) return "moins d'1 min"
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`

  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60

  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
}

function getElapsedMinutes(createdAtMs: number, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - createdAtMs) / 60000))
}

function getKitchenContextLines(order: RestaurantOrder, type: KitchenDisplayOrderType) {
  const details = order as RestaurantOrder & {
    customerName?: string | null
    phoneNumber?: string | null
    customerPhone?: string | null
    tableNumber?: string | null
    deliveryAddress?: string | { street?: string; label?: string; zone?: string; city?: string } | null
  }
  const customerName = details.customer?.name || details.customerName || null
  const phoneNumber =
    details.customer?.phone || details.phoneNumber || details.customerPhone || null
  const tableNumber = details.table || details.tableNumber || details.tableId || null
  const deliveryAddress = formatDeliveryAddress(details.deliveryAddress)

  if (type === "dine_in") {
    return [`SUR PLACE${tableNumber ? ` • Table ${tableNumber}` : ""}`]
  }

  if (type === "delivery") {
    return [
      "LIVRAISON",
      customerName ? `Client : ${customerName}` : null,
      phoneNumber ? `Tel : ${phoneNumber}` : null,
      deliveryAddress ? `Adresse : ${deliveryAddress}` : null,
    ].filter(Boolean) as string[]
  }

  return ["\u00c0 EMPORTER"]
}

function formatDeliveryAddress(
  value: string | { street?: string; label?: string; zone?: string; city?: string } | null | undefined
) {
  if (!value) return null
  if (typeof value === "string") return value

  return [value.label, value.street, value.zone, value.city].filter(Boolean).join(", ") || null
}

export function KitchenOrderCard({ order, onUpdateStatus }: KitchenOrderCardProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const [isPaymentJustVerified, setIsPaymentJustVerified] = React.useState(false)

  if (!order.kitchenStatus) console.warn("Missing kitchenStatus", order.id)
  const orderStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
  const status = orderStatus
  const followingStatus = nextOrderStatus(orderStatus, order.orderType)
  const nextAction = followingStatus
    ? {
        label: actionLabels[followingStatus] || statusLabels[status] || followingStatus,
        status: followingStatus,
      }
    : null

  const kitchenItems = React.useMemo(
    () => getKitchenOrderItems(order.items || []),
    [order.items]
  )
  const totalItems = kitchenItems.reduce((acc, item) => acc + item.quantity, 0)
  const displayOrderType = getKitchenDisplayOrderType(order)
  const isTableOrder = displayOrderType === "dine_in"
  const orderCode = getOrderDisplayId(order)
  const orderTypeLabel = orderTypeLabels[displayOrderType]
  const contextLines = getKitchenContextLines(order, displayOrderType)
  const isPaymentLocked = isPaymentLockedForKitchen(order)
  const previousPaymentLockedRef = React.useRef(isPaymentLocked)
  const createdAtMs = getCreatedAtMs(order)
  const elapsedTime = formatElapsedTime(createdAtMs, nowMs)
  const elapsedMinutes = getElapsedMinutes(createdAtMs, nowMs)
  const isPaymentDelayed = isPaymentLocked && elapsedMinutes > 10
  const isPaidNonTableOrder = normalizeOrderType(order.orderType) !== "dine_in" && !isPaymentLocked
  const isPaid = isOrderPaid(order)

  const lastItemAddedAt = React.useMemo(() => {
    const itemTimes = kitchenItems.map((item: any) => {
      if (item.createdAt?.toMillis) return item.createdAt.toMillis()
      if (item.createdAt?.getTime) return item.createdAt.getTime()
      if (typeof item.createdAt === "number") return item.createdAt
      return 0
    })
    return Math.max(0, ...itemTimes, createdAtMs)
  }, [kitchenItems, createdAtMs])

  const isRecentActivity = (nowMs - lastItemAddedAt) < 20000 // 20 secondes
  const isNewOrder = (lastItemAddedAt - createdAtMs) < 10000 // dans les 10s apres creation

  React.useEffect(() => {
    console.log({
      orderId: order.id,
      type: order.orderType,
      payment: (order as { paymentStatus?: string | null }).paymentStatus,
    })
  }, [order])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 30000)

    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    const wasLocked = previousPaymentLockedRef.current

    if (wasLocked && !isPaymentLocked) {
      setIsPaymentJustVerified(true)
      toast({
        title: "Paiement verifie",
        description: `${orderCode} peut passer en preparation.`,
      })

      const timeout = window.setTimeout(() => {
        setIsPaymentJustVerified(false)
      }, 2500)

      previousPaymentLockedRef.current = isPaymentLocked
      return () => window.clearTimeout(timeout)
    }

    previousPaymentLockedRef.current = isPaymentLocked
    return undefined
  }, [isPaymentLocked, orderCode, toast])

  const handleAction = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (!nextAction || isUpdating) return
    if (isPaymentLocked) {
      toast({
        title: "Paiement en attente",
        description: "Cette commande doit etre verifiee avant preparation.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      await onUpdateStatus(order.id, nextAction.status)
      toast({
        title: "Statut mis a jour",
        description: `${orderCode} -> ${nextAction.label}`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Mise à jour refusée",
        description: "Impossible de synchroniser la commande avec la cuisine.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setIsDetailOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setIsDetailOpen(true)
          }
        }}
        className={cn(
          "cursor-pointer rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm outline-none ring-primary/40 transition focus:ring-2",
          isPaymentLocked && "cursor-not-allowed opacity-50",
          isPaymentDelayed && "border-red-500/50 ring-1 ring-red-500/20",
          isPaidNonTableOrder && "border-emerald-500/40 ring-1 ring-emerald-500/20",
          isPaymentJustVerified && "animate-pulse border-emerald-500 ring-2 ring-emerald-500/50",
          isRecentActivity && "border-amber-500 ring-2 ring-amber-500/50 animate-pulse bg-amber-500/5"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black">{orderCode}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {isTableOrder ? (
                <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              <span className="line-clamp-2 text-[11px] font-black uppercase leading-tight text-foreground">
                {contextLines[0] || orderTypeLabel}
              </span>
            </div>
            {contextLines.length > 1 ? (
              <div className="mt-2 space-y-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                {contextLines.slice(1).map((line) => (
                  <p key={line} className="line-clamp-1">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
            
            {(order as any).notes || (order as any).customerNote || (order as any).customerNotes ? (
              <div className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-[10px] font-semibold italic text-amber-700 dark:text-amber-300">
                Note : {(order as any).notes || (order as any).customerNote || (order as any).customerNotes}
              </div>
            ) : null}

            {isRecentActivity && (
              <p className="mt-1.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                {isNewOrder ? "🆕 Nouvelle commande" : "🆕 Ajout à la commande"}
              </p>
            )}
          </div>

          <Badge
            variant="outline"
            className={cn("shrink-0 gap-1 text-[10px] font-black uppercase", statusColors[status])}
          >
            {statusIcons[status]}
            {statusLabels[status] || status}
          </Badge>
        </div>

        {isPaymentLocked ? (
          <Badge
            variant="outline"
            className={cn(
              "mt-3 w-fit text-[10px] font-black uppercase",
              isPaymentDelayed
                ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            )}
          >
            {isPaymentDelayed ? "RETARD PAIEMENT" : "EN ATTENTE DE PAIEMENT"} - {elapsedTime}
          </Badge>
        ) : null}

        {isPaid ? (
          <Badge
            variant="outline"
            className="mt-3 w-fit border-emerald-500/40 bg-emerald-500/10 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300"
          >
            ✔ Déjà payé
          </Badge>
        ) : null}

        <ul className="mt-3 space-y-2">
          {kitchenItems.slice(0, 5).map((item, index) => {
            const itemStatus = normalizeOrderItemStatus((item as any).status ?? order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
            const { options, extras, note } = parseItemDetails(item)
            
            return (
            <li
              key={`${order.id}-${item.productId ?? index}-${item.name}`}
              className={cn(
                "flex flex-col gap-1 rounded-md px-2 py-1.5 text-xs leading-tight",
                itemStatus === ORDER_ITEM_STATUS.SERVED && "bg-muted text-muted-foreground line-through opacity-70",
                itemStatus === ORDER_ITEM_STATUS.PENDING && "bg-amber-500/10 text-card-foreground ring-1 ring-amber-500/20",
                itemStatus !== ORDER_ITEM_STATUS.SERVED &&
                  itemStatus !== ORDER_ITEM_STATUS.PENDING &&
                  "text-card-foreground"
              )}
            >
              <div className="flex items-start justify-between font-bold">
                <span>{item.quantity}x {item.name}</span>
                <span className="ml-2 shrink-0 text-[9px] font-black uppercase opacity-70">
                  {formatItemStatus(itemStatus)}
                </span>
              </div>

              {options.length > 0 ? (
                <div className="text-[10px] text-muted-foreground">
                  {options.map((opt, idx) => (
                    <div key={idx}>({opt.name} : {opt.value})</div>
                  ))}
                </div>
              ) : null}

              {extras.length > 0 ? (
                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 space-y-0.5">
                  {extras.map((ext, idx) => (
                    <div key={idx}>+ {ext.name}</div>
                  ))}
                </div>
              ) : null}

              {note ? (
                <div className="mt-1 inline-block w-fit rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-400 border border-red-500/20">
                  NOTE : {note}
                </div>
              ) : null}
            </li>
            )
          })}
        </ul>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            {totalItems} produit{totalItems !== 1 ? "s" : ""}
          </span>

          {nextAction && !isPaymentLocked ? (
            <button
              type="button"
              onClick={handleAction}
              disabled={isUpdating}
              className="h-8 rounded-lg bg-primary px-3 text-[10px] font-black uppercase text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "..." : nextAction.label}
            </button>
          ) : null}
        </div>
      </article>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 text-lg font-black">
              <span>{orderCode}</span>
              <Badge
                variant="outline"
                className={cn("gap-1 text-[10px] font-black uppercase", statusColors[status])}
              >
                {statusIcons[status]}
                {statusLabels[status] || status}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Détails opérationnels de la commande, produits, statut cuisine et informations client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">
              <div className="space-y-1">
                {contextLines.map((line, index) => (
                  <p
                    key={line}
                    className={cn(
                      index === 0
                        ? "text-sm font-black uppercase text-foreground"
                        : "text-xs font-semibold text-muted-foreground"
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-muted-foreground">Temps ecoule</span>
                <span className="font-bold text-foreground">{elapsedTime}</span>
              </div>
            </div>

            {isPaymentLocked ? (
              <div
                className={cn(
                  "rounded-lg border p-3 text-xs font-black uppercase",
                  isPaymentDelayed
                    ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                )}
              >
                {isPaymentDelayed ? "RETARD PAIEMENT" : "EN ATTENTE DE PAIEMENT"}
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                Produits
              </h3>
              <div className="space-y-2">
                {kitchenItems.map((item, index) => (
                  <OrderItemDetail
                    key={`${order.id}-detail-${item.productId ?? index}-${item.name}`}
                    item={item}
                  />
                ))}
              </div>
            </div>

            <OrderNotes order={order} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function parseItemDetails(item: any) {
  const options: Array<{ name: string; value: string }> = item.options || []
  const extras: Array<{ name: string; price?: number }> = item.extras || []
  const note: string | null = item.note || item.notes || null

  if (!item.options && !item.extras && item.selectedOptions) {
    item.selectedOptions.forEach((opt: any) => {
      const name = String(opt.optionName || "").toLowerCase().trim()
      if (name && name !== "supplement" && name !== "supplément" && name !== "extra") {
        options.push({ name: opt.optionName || "Option", value: opt.choiceName })
      } else {
        extras.push({ name: opt.choiceName, price: opt.price })
      }
    })
  }

  if (extras.length === 0 && (item.supplements || item.supplementNames)?.length > 0) {
    const sups = item.supplements || item.supplementNames
    sups.forEach((sup: any) => {
      if (typeof sup === "string") {
        extras.push({ name: sup, price: 0 })
      } else {
        extras.push({ name: `${sup.quantity ? `${sup.quantity}x ` : ""}${sup.name || ""}`, price: 0 })
      }
    })
  }

  return { options, extras, note }
}

function OrderItemDetail({ item }: { item: RestaurantOrder["items"][number] }) {
  const itemStatus = normalizeOrderItemStatus((item as any).status)
  const { options, extras, note } = parseItemDetails(item)

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted p-3",
        itemStatus === ORDER_ITEM_STATUS.SERVED && "opacity-60",
        itemStatus === ORDER_ITEM_STATUS.PENDING && "border-amber-500/30 bg-amber-500/10"
      )}
    >
      <div className="flex justify-between gap-3">
        <span className="font-bold text-foreground">
          {item.quantity}x {item.name}
        </span>
        <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">
          {formatItemStatus(itemStatus)}
        </span>
      </div>

      {options.length > 0 ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {options.map((opt, idx) => (
             <div key={idx}>({opt.name} : {opt.value})</div>
          ))}
        </div>
      ) : null}

      {extras.length > 0 ? (
        <div className="mt-1.5 space-y-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          {extras.map((ext, idx) => (
             <div key={idx}>+ {ext.name}</div>
          ))}
        </div>
      ) : null}

      {note ? (
        <div className="mt-2 inline-block rounded bg-red-500/10 px-2 py-1 text-[11px] font-black uppercase text-red-700 dark:text-red-400 border border-red-500/20">
          NOTE : {note}
        </div>
      ) : null}
    </div>
  )
}

function formatItemStatus(status: string) {
  if (status === ORDER_ITEM_STATUS.PREPARING) return "Preparation"
  if (status === ORDER_ITEM_STATUS.READY) return "Pret"
  if (status === ORDER_ITEM_STATUS.SERVED) return "Servi"
  return "Nouveau"
}

function OrderNotes({ order }: { order: RestaurantOrder }) {
  const details = order as RestaurantOrder & {
    notes?: string
    customerNote?: string
    customerNotes?: string
  }
  const note = details.notes || details.customerNote || details.customerNotes

  if (!note) return null

  return (
    <div>
      <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
        Notes client
      </h3>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-700 dark:text-amber-200">
        {note}
      </div>
    </div>
  )
}
