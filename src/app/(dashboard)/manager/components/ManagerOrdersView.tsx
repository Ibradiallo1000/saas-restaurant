"use client"

import * as React from "react"
import { AlertTriangle, PackageCheck, ReceiptText, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  OrderCard,
  OrderCardSkeleton,
  OrderItemsSummary,
  OrdersEmptyState,
  OrdersErrorState,
  OrdersLoadingState,
  OrdersStatusTabs,
  OrdersToolbar,
  OrderSummaryMetrics,
} from "@/components/orders-ui"
import { DashboardHeader, DashboardPage, DashboardSection } from "@/components/dashboard-ui"
import { ManagerPeriodFilter } from "@/components/layout/manager-period-filter"
import type { ManagerOrderCounts, ManagerOrderListItem, ManagerOrderTab } from "./manager-orders-view-model"
import { MANAGER_ORDER_TAB_LABELS } from "./manager-orders-view-model"

export interface ManagerOrdersViewProps {
  activeTab: ManagerOrderTab
  counts: ManagerOrderCounts
  error: boolean
  hasMore: boolean
  isLoading: boolean
  onActiveTabChange: (tab: ManagerOrderTab) => void
  onLoadMore: () => void
  onOpenDetails: (orderId: string) => void
  orders: ManagerOrderListItem[]
  totalResults: number
}

export function ManagerOrdersView({ activeTab, counts, error, hasMore, isLoading, onActiveTabChange, onLoadMore, onOpenDetails, orders, totalResults }: ManagerOrdersViewProps) {
  const tabs = (Object.keys(MANAGER_ORDER_TAB_LABELS) as ManagerOrderTab[]).map((id) => ({ id, label: MANAGER_ORDER_TAB_LABELS[id], count: counts[id] }))
  const metrics = [
    { id: "pending", label: "À traiter", value: counts.pending, description: "Commandes en attente.", icon: <ReceiptText />, tone: counts.pending > 0 ? "warning" as const : "neutral" as const },
    { id: "preparing", label: "En préparation", value: counts.preparing, description: "Production en cours.", icon: <Utensils />, tone: "neutral" as const },
    { id: "ready", label: "Prêtes", value: counts.ready, description: "À servir ou remettre.", icon: <PackageCheck />, tone: counts.ready > 0 ? "info" as const : "neutral" as const },
    { id: "late", label: "En retard", value: counts.late, description: counts.late > 0 ? "Intervention requise." : "Aucun retard.", icon: <AlertTriangle />, tone: counts.late > 0 ? "negative" as const : "positive" as const },
  ]

  return <DashboardPage className="pb-20 md:pb-6">
    <DashboardHeader title="Commandes" subtitle="Supervisez les commandes nécessitant une action et les commandes terminées sur la période sélectionnée." meta={<span className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-dashboard-button)] border border-[var(--dashboard-border)] px-3"><span className="size-2 rounded-full bg-[var(--data-positive)]" aria-hidden="true" />En direct</span>} actions={<ManagerPeriodFilter />} />

    <DashboardSection title="Résumé opérationnel" description="État actuel de la production et des retards.">
      <OrderSummaryMetrics items={metrics} />
    </DashboardSection>

    <DashboardSection title="Liste des commandes" description={`${MANAGER_ORDER_TAB_LABELS[activeTab]} · ${totalResults} résultat${totalResults > 1 ? "s" : ""}`}>
      <OrdersToolbar count={`${totalResults} résultat${totalResults > 1 ? "s" : ""}`} />
      <OrdersStatusTabs ariaLabel="Filtrer les commandes par état" items={tabs} value={activeTab} onValueChange={(value) => onActiveTabChange(value as ManagerOrderTab)} />

      {error ? <OrdersErrorState title="Commandes indisponibles" description="Impossible de charger les commandes opérationnelles pour le moment." /> : isLoading ? <div className="space-y-3"><OrdersLoadingState compact label="Chargement des commandes" />{Array.from({ length: 4 }, (_, index) => <OrderCardSkeleton key={index} density="comfortable" aria-hidden="true" />)}</div> : orders.length === 0 ? <OrdersEmptyState title="Aucune commande" description={`Aucune commande dans le filtre « ${MANAGER_ORDER_TAB_LABELS[activeTab]} ».`} /> : <div className="space-y-3">{orders.map((order) => <OrderCard key={order.id} reference={order.reference} title={order.title} subtitle={order.subtitle} status={order.status} payment={order.payment} channel={order.channel} age={order.age} total={order.total} itemCount={order.itemCount} destination={order.destination} priority={order.priority} density="comfortable" summary={<OrderItemsSummary items={order.items} maxVisible={2} />} onOpen={() => onOpenDetails(order.id)} />)}</div>}

      {hasMore && !error ? <div className="flex justify-center pt-2"><Button type="button" variant="outline" className="min-h-[var(--target-dashboard-min)]" onClick={onLoadMore} disabled={isLoading}>Charger plus</Button></div> : null}
    </DashboardSection>
  </DashboardPage>
}
