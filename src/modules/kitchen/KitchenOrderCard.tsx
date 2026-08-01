"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

import {
  KitchenActionBar,
  KitchenNote,
  KitchenOrderCard as KitchenOrderCardPrimitive,
  KitchenStatusBadge,
} from "@/components/kitchen-ui"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { executePreparationIssue } from "@/modules/preparation/preparation-issue-client"
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
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [issueOpen, setIssueOpen] = React.useState(false)
  const [issueItemId, setIssueItemId] = React.useState("")
  const [reason, setReason] = React.useState("PRODUCT_UNAVAILABLE")
  const [comment, setComment] = React.useState("")
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
      toast({
        title: "Mise à jour refusée",
        description: error instanceof Error
          ? error.message
          : "Impossible de synchroniser la commande avec la cuisine.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }, [isUpdating, model.reference, nextStatus, onUpdateStatus, order.id, toast])

  const orderItems = (order.items || []) as any[]
  const activeIssue = orderItems.find((item) => item.preparationIssue)?.preparationIssue
  const reportIssue = async (type: "REPORT" | "RESOLVE") => {
    if (!user || !restaurantId) return
    setIsUpdating(true)
    try {
      await executePreparationIssue({ user, restaurantId, type, orderId: (order as any).__canonicalOrderId || order.id, orderItemId: type === "RESOLVE" ? activeIssue.orderItemId : issueItemId, reason, comment })
      setIssueOpen(false); setComment("")
      toast({ title: type === "REPORT" ? "Problème signalé" : "Signalement résolu" })
    } catch (error) {
      toast({ variant: "destructive", title: "Action refusée", description: error instanceof Error ? error.message : "Erreur" })
    } finally { setIsUpdating(false) }
  }

  const notes = (
    <>
      {model.note ? <KitchenNote label="Observation client" content={model.note} variant="attention" /> : null}
      {activeIssue ? <KitchenNote label="Problème signalé" content={`${activeIssue.reason}${activeIssue.comment ? ` — ${activeIssue.comment}` : ""}`} variant="attention" /> : null}
      {model.isRecentActivity ? <KitchenNote label="Activité récente" content={model.isNewOrder ? "Nouvelle commande" : "Article ajouté à la commande"} variant="neutral" /> : null}
    </>
  )

  const actions = (
    <KitchenActionBar
      primary={nextStatus ? {
        id: nextStatus,
        label: model.isPaymentLocked
          ? "En attente de validation du paiement"
          : actionLabels[nextStatus] || nextStatus,
        onSelect: handleAction,
        loading: isUpdating,
        disabled: isUpdating || model.isPaymentLocked,
      } : undefined}
      secondary={[{
        id: "issue",
        label: activeIssue ? "Résoudre le problème" : "Signaler un problème",
        icon: <AlertTriangle />,
        variant: activeIssue ? "outline" : "danger",
        onSelect: () => activeIssue
          ? void reportIssue("RESOLVE")
          : (setIssueItemId(String(orderItems[0]?.orderItemId || orderItems[0]?.id || "")), setIssueOpen(true)),
      }]}
      density="comfortable"
    />
  )

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
              <div className="space-y-2">{model.items.map((item) => <div key={item.id} className="rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] bg-[var(--kitchen-card-muted)] p-3"><div className="flex gap-3"><span className="text-lg font-black tabular-nums">{item.quantity}×</span><div className="size-12 shrink-0 overflow-hidden rounded-[var(--radius-dashboard-input)] bg-[var(--kitchen-card)]">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" className="size-full object-cover" /> : null}</div><div className="min-w-0"><p className="break-words font-bold">{item.name}</p>{item.options ? <p className="mt-1 break-words text-sm text-[var(--dashboard-subtitle)]">{item.options}</p> : null}{item.note ? <KitchenNote className="mt-2" label="Note article" content={item.note} variant="attention" /> : null}</div></div></div>)}</div>
            </div>
            {notes}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Signaler un problème</DialogTitle><DialogDescription>La ligne reste active et n’est pas annulée.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Ligne</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={issueItemId} onChange={(event) => setIssueItemId(event.target.value)}>{orderItems.map((item) => <option key={item.orderItemId || item.id} value={item.orderItemId || item.id}>{item.quantity}× {item.name}</option>)}</select></div>
            <div><Label>Motif</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={reason} onChange={(event) => setReason(event.target.value)}><option value="PRODUCT_UNAVAILABLE">Produit indisponible</option><option value="MISSING_INGREDIENT">Ingrédient manquant</option><option value="ORDER_ERROR">Erreur dans la commande</option><option value="EQUIPMENT_UNAVAILABLE">Matériel indisponible</option><option value="OTHER">Autre</option></select></div>
            <div><Label>Commentaire</Label><Input value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} /></div>
            <Button disabled={isUpdating || !issueItemId || (reason === "OTHER" && !comment.trim())} onClick={() => void reportIssue("REPORT")}>Envoyer l’alerte</Button>
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
