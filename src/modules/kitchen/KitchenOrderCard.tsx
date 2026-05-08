"use client"

import * as React from "react"
import {
  CheckCircle,
  CookingPot,
  Package,
  Printer,
  Users,
  ChevronRight,
  AlertCircle,
  Clock
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  canTransition,
  nextOrderStatus,
  normalizeOrderStatus,
  orderStatusLabel,
  type OrderStatus,
} from "@/lib/order-status"
import { cn } from "@/lib/utils"

import type { RestaurantOrder } from "@/modules/restaurant/types"

type KitchenOrderCardProps = {
  order: RestaurantOrder
  onUpdateStatus: (
    orderId: string,
    status: OrderStatus
  ) => Promise<void>
}

const statusLabels: Record<string, string> = {
  nouvelle: "En attente",
  preparation: "En préparation",
  prete: "Prête",
  servie: "Servie",
  payee: "Payée",
}

const statusColors: Record<string, string> = {
  nouvelle: "bg-yellow-100 text-yellow-800",
  preparation: "bg-orange-100 text-orange-800",
  prete: "bg-blue-100 text-blue-800",
  servie: "bg-green-100 text-green-800",
  payee: "bg-emerald-100 text-emerald-800",
}

const statusIcons: Record<string, React.ReactNode> = {
  nouvelle: <AlertCircle className="h-3 w-3" />,
  preparation: <CookingPot className="h-3 w-3" />,
  prete: <CheckCircle className="h-3 w-3" />,
  servie: <CheckCircle className="h-3 w-3" />,
  payee: <CheckCircle className="h-3 w-3" />,
}

export function KitchenOrderCard({ order, onUpdateStatus }: KitchenOrderCardProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())

  const minutes = getMinutesSinceCreated(order.createdAt, now)
  const status = normalizeOrderStatus(order.status)
  const urgent = minutes > 15
  const warning = minutes >= 5 && minutes <= 15

  const cardAccentClass = urgent
    ? "border-l-red-500"
    : warning
      ? "border-l-orange-400"
      : "border-l-slate-200"

  const timeBadgeClass = urgent
    ? "bg-red-100 text-red-700 ring-red-200"
    : warning
      ? "bg-orange-100 text-orange-700 ring-orange-200"
      : "bg-slate-100 text-slate-700 ring-slate-200"

  const followingStatus = nextOrderStatus(status)
  const nextAction = followingStatus && canTransition(status, followingStatus)
    ? {
        label: orderStatusLabel(followingStatus),
        status: followingStatus,
        bg:
          followingStatus === "preparation"
            ? "bg-orange-600 hover:bg-orange-700"
            : followingStatus === "prete"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-emerald-600 hover:bg-emerald-700",
      }
    : null

  const visibleItems = order.items?.slice(0, 3) ?? []
  const remainingItems = Math.max(0, (order.items?.length ?? 0) - visibleItems.length)
  const totalItems = order.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0
  const isTableOrder = Boolean(order.table)

  const displayIdentifier = isTableOrder
    ? `Table ${order.table || order.sessionId?.slice(-4) || "?"}`
    : `À emporter #${order.id.slice(-4)}`

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  const handleAction = async () => {
    if (!nextAction || isUpdating) return

    setIsUpdating(true)
    try {
      await onUpdateStatus(order.id, nextAction.status)
      toast({
        title: "Statut mis à jour",
        description: `${displayIdentifier} → ${statusLabels[nextAction.status]}`,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePrint = () => {
    toast({ title: "Impression", description: "Ticket envoyé à l'imprimante" })
  }

  const formatTime = (date: any) => {
    if (!date) return ""
    const d = date.toDate ? date.toDate() : new Date(date)
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <>
      {/* CARTE */}
      <article
        className={cn(
          "flex h-56 flex-col rounded-2xl border border-l-[6px] bg-white p-5 shadow-sm transition-all duration-300 ease-in-out cursor-pointer",
          "hover:-translate-y-0.5 hover:shadow-xl",
          cardAccentClass
        )}
        onClick={() => setIsDetailOpen(true)}
      >
        {/* EN-TÊTE */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-black text-slate-950">
              {displayIdentifier}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-white/50"
              >
                {totalItems} plat{totalItems !== 1 ? 's' : ''}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-white/50"
              >
                <Clock className="h-2 w-2 mr-1" />
                {formatTime(order.createdAt)}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-black leading-none ring-1",
                timeBadgeClass
              )}
            >
              {minutes} min
            </div>
          </div>
        </div>

        {/* LISTE DES PRODUITS */}
        <ul className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-hidden">
          {visibleItems.map((item) => (
            <li
              key={`${order.id}-${item.productId}-${item.name}`}
              className="truncate text-sm font-bold leading-tight text-slate-700"
            >
              {item.quantity}x {item.name}
            </li>
          ))}
          {remainingItems > 0 && (
            <li className="text-sm font-black text-slate-500 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              +{remainingItems} autre{remainingItems !== 1 ? 's' : ''}
            </li>
          )}
        </ul>

        {/* TYPE CLIENT + ACTIONS */}
        <div className="mt-4 flex gap-2">
          {/* Type client */}
          <div className="flex-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            {isTableOrder ? (
              <Users className="h-3.5 w-3.5" />
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
            <span className="truncate">
              {isTableOrder ? "Sur place" : "À emporter"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {nextAction && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleAction()
                }}
                disabled={isUpdating}
                className={cn(
                  "h-8 px-4 rounded-lg text-xs font-black uppercase italic text-white shadow transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60",
                  nextAction.bg
                )}
              >
                {isUpdating ? "..." : nextAction.label}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePrint()
              }}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 flex items-center justify-center"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </article>

      {/* MODAL DÉTAIL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              {displayIdentifier}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Statut et heure + timer */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Badge className={cn("font-black uppercase gap-1 text-[10px]", statusColors[status])}>
                  {statusIcons[status]}
                  <span>{statusLabels[status] || status}</span>
                </Badge>
                <div
                  className={cn(
                    "rounded-full px-2 py-1 text-xs font-black leading-none ring-1",
                    timeBadgeClass
                  )}
                >
                  {minutes} min
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTime(order.createdAt)}
              </span>
            </div>

            <Separator />

            {/* Liste des articles */}
            <div>
              <h3 className="font-black uppercase text-sm tracking-wider mb-3">Articles</h3>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div>
                      <span className="font-bold text-gray-900">{item.quantity}×</span>
                      <span className="ml-2 text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-bold text-primary">
                      {(item.unitPrice * item.quantity).toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Informations */}
            <div>
              <h3 className="font-black uppercase text-sm tracking-wider mb-3">Informations</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">
                    {isTableOrder ? "Client sur place" : "À emporter"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total articles</span>
                  <span className="font-medium">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total TTC</span>
                  <span className="font-medium text-primary">{order.total.toLocaleString()} FCFA</span>
                </div>
                {order.customer?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client</span>
                    <span className="font-medium">{order.customer.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action modal */}
            {nextAction && (
              <div className="pt-2">
                <button
                  className={cn(
                    "w-full h-12 rounded-xl text-base font-black uppercase italic text-white shadow-lg transition hover:-translate-y-0.5",
                    nextAction.bg
                  )}
                  onClick={() => {
                    handleAction()
                    setIsDetailOpen(false)
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? "..." : nextAction.label}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function getMinutesSinceCreated(
  createdAt: RestaurantOrder["createdAt"],
  now: number
) {
  const createdAtMs =
    createdAt?.toMillis?.() ??
    createdAt?.toDate?.().getTime?.() ??
    now

  return Math.max(0, Math.floor((now - createdAtMs) / 60000))
}
