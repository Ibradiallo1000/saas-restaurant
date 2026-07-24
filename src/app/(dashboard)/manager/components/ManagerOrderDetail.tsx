"use client"

import {
  OrderAgeIndicator,
  OrderChannelBadge,
  OrderDetailSheet,
  OrderInfoGrid,
  OrderItemsList,
  OrderPaymentBadge,
  OrderStatusBadge,
  OrderTimeline,
} from "@/components/orders-ui"
import { DashboardPanel, DashboardSection } from "@/components/dashboard-ui"
import type { ManagerOrderDetailViewModel } from "./manager-order-detail-view-model"

export interface ManagerOrderDetailProps {
  detail: ManagerOrderDetailViewModel | null
  onOpenChange: (open: boolean) => void
}

export function ManagerOrderDetail({ detail, onOpenChange }: ManagerOrderDetailProps) {
  return <OrderDetailSheet
    open={Boolean(detail)}
    onOpenChange={onOpenChange}
    title={detail ? `Commande ${detail.reference}` : "Commande"}
    description={detail?.description ?? "Détail de supervision opérationnelle."}
    status={detail ? <OrderStatusBadge {...detail.status} /> : undefined}
    summary={detail ? <div className="flex flex-wrap items-center gap-2"><OrderChannelBadge {...detail.channel} size="compact" /><OrderAgeIndicator {...detail.age} /><OrderPaymentBadge {...detail.payment} size="compact" /></div> : undefined}
  >
    {detail ? <div className="space-y-6">
      <DashboardSection title="Informations générales" headingAs="h2">
        <OrderInfoGrid items={detail.info} />
      </DashboardSection>

      <DashboardSection title="Articles" description={`${detail.items.length} ligne${detail.items.length > 1 ? "s" : ""}`} headingAs="h2">
        <OrderItemsList items={detail.items} />
        <DashboardPanel className="mt-3 flex items-center justify-between gap-3 p-4">
          <span className="text-sm font-semibold text-[var(--dashboard-label)]">Total</span>
          <strong className="break-words text-xl tabular-nums text-[var(--dashboard-value)]">{detail.total}</strong>
        </DashboardPanel>
      </DashboardSection>

      {detail.timeline.length ? <DashboardSection title="Historique disponible" description="Événements enregistrés sur la commande." headingAs="h2"><OrderTimeline items={detail.timeline} currentId={detail.currentTimelineId} /></DashboardSection> : null}

      <DashboardSection title="Paiement" headingAs="h2">
        <DashboardPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
          <OrderPaymentBadge {...detail.payment} />
          <strong className="break-words text-lg tabular-nums text-[var(--dashboard-value)]">{detail.total}</strong>
        </DashboardPanel>
      </DashboardSection>
    </div> : null}
  </OrderDetailSheet>
}
