"use client"

import * as React from "react"

import {
  KitchenActionBar,
  KitchenNote,
  KitchenOrderCard as KitchenOrderCardPrimitive,
  KitchenStatusBadge,
} from "@/components/kitchen-ui"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { nextOrderStatus, type OrderOperationStatus } from "@/lib/order-lifecycle"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import {
  actionLabels,
  createKitchenCardViewModel,
  getKitchenCardSignature,
  getKitchenOrderTypeValue,
} from "./kitchen-view-model"

type KitchenOrderCardProps = {
  order: RestaurantOrder
  onUpdateStatus: (orderId: string, status: OrderOperationStatus) => Promise<void>
  nowMs?: number
  isNew?: boolean
}

function KitchenOrderCardComponent({ isNew = false, nowMs, onUpdateStatus, order }: KitchenOrderCardProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const effectiveNowMs = nowMs ?? Date.now()
  const model = React.useMemo(() => createKitchenCardViewModel(order, effectiveNowMs), [effectiveNowMs, order])
  const proposedNextStatus = nextOrderStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus, getKitchenOrderTypeValue(order))
  const nextStatus =
    proposedNextStatus === "preparing" || proposedNextStatus === "ready"
      ? proposedNextStatus
      : null
  const handleAction = React.useCallback(async () => {
    if (!nextStatus || isUpdating) return
    setIsUpdating(true)
    try {
      await onUpdateStatus(order.id, nextStatus)
      toast({ title: "Statut mis à jour", description: `${model.reference} → ${actionLabels[nextStatus] || nextStatus}` })
    } catch (error) {
      console.error(error)
      toast({ title: "Mise à jour refusée", description: "Impossible de synchroniser la commande avec la cuisine.", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }, [isUpdating, model.reference, nextStatus, onUpdateStatus, order.id, toast])

  const notes = (
    <>
      {model.note ? <KitchenNote label="Note client" content={model.note} variant="attention" /> : null}
      {model.isRecentActivity ? <KitchenNote label="Activité récente" content={model.isNewOrder ? "Nouvelle commande" : "Article ajouté à la commande"} variant="neutral" /> : null}
    </>
  )

  const actions = nextStatus ? (
    <KitchenActionBar
      primary={{ id: nextStatus, label: actionLabels[nextStatus] || nextStatus, onSelect: handleAction, loading: isUpdating, disabled: isUpdating }}
      density="comfortable"
    />
  ) : undefined

  return (
    <>
      <KitchenOrderCardPrimitive
        reference={model.reference}
        context={<div className="space-y-0.5">{model.contextLines.map((line) => <div key={line}>{line}</div>)}</div>}
        status={model.status}
        timer={model.timer}
        destination={model.destination}
        priority={model.priority}
        items={model.items.slice(0, 5)}
        notes={notes}
        actions={actions}
        loading={isUpdating}
        disabled={false}
        onOpen={() => setIsDetailOpen(true)}
        className={isNew ? "animate-in fade-in [animation-duration:var(--motion-kitchen-card-entry)] motion-reduce:animate-none" : undefined}
        footer={<span className="text-sm font-semibold text-[var(--dashboard-muted)]">{model.totalItems} produit{model.totalItems !== 1 ? "s" : ""} Cuisine</span>}
      />

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[calc(100dvh_-_var(--safe-top,0px)_-_var(--safe-bottom,0px))] max-w-lg overflow-x-hidden overflow-y-auto border-[var(--kitchen-border)] bg-[var(--kitchen-card)] text-[var(--dashboard-title)]">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center justify-between gap-3 text-xl font-black">
              <span>{model.reference}</span>
              <KitchenStatusBadge {...model.status} />
            </DialogTitle>
            <DialogDescription>Détails opérationnels de la commande, produits, statut Cuisine et informations client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] bg-[var(--kitchen-card-muted)] p-3">
              {model.contextLines.map((line) => <p key={line} className="break-words text-sm font-semibold">{line}</p>)}
              <p className="mt-2 text-sm text-[var(--dashboard-muted)]">Temps écoulé : <strong className="text-[var(--dashboard-title)]">{model.timer.value}</strong></p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Produits Cuisine</h3>
              <div className="space-y-2">{model.items.map((item) => <div key={item.id} className="rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] bg-[var(--kitchen-card-muted)] p-3"><div className="flex gap-3"><span className="text-lg font-black tabular-nums">{item.quantity}×</span><div className="min-w-0"><p className="break-words font-bold">{item.name}</p>{item.options ? <p className="mt-1 break-words text-sm text-[var(--dashboard-subtitle)]">{item.options}</p> : null}{item.note ? <KitchenNote className="mt-2" label="Note article" content={item.note} variant="attention" /> : null}</div></div></div>)}</div>
            </div>
            {notes}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const KitchenOrderCard = React.memo(
  KitchenOrderCardComponent,
  (previous, next) => previous.isNew === next.isNew && previous.nowMs === next.nowMs && previous.onUpdateStatus === next.onUpdateStatus && getKitchenCardSignature(previous.order) === getKitchenCardSignature(next.order)
)
