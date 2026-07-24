"use client"

import { AlertTriangle, CreditCard, Package, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlatformBillingTable, PlatformDataQualityBadge, PlatformEmptyState, PlatformErrorState, PlatformHeader, PlatformLoadingState, PlatformMetricCard, PlatformMetricGrid, PlatformPage, PlatformPlanCard, PlatformPlanGrid, PlatformSection, PlatformSubscriptionStatus } from "@/components/platform-ui"
import type { PlatformBillingPlanPresentation, PlatformSubscriptionPresentation } from "./platform-billing-view-model"

export interface PlatformBillingViewProps { subscriptions: PlatformSubscriptionPresentation[]; plans: PlatformBillingPlanPresentation[]; stats: { mrr: number; alerts: number; count: number }; loading: boolean; error: boolean; onManagePlans: () => void }
export function PlatformBillingView({ error, loading, onManagePlans, plans, stats, subscriptions }: PlatformBillingViewProps) {
  const unresolvedPlans = subscriptions.filter((subscription) => subscription.planQuality !== "complete").length
  const columns = [
    { id: "restaurant", header: "Restaurant", cell: (item: PlatformSubscriptionPresentation) => <div><p className="font-semibold">{item.restaurantName}</p>{item.restaurantId ? <p className="break-all text-xs text-[var(--dashboard-muted)]">{item.restaurantId}</p> : null}<PlatformDataQualityBadge quality={item.restaurantQuality} /></div> },
    { id: "plan", header: "Plan", cell: (item: PlatformSubscriptionPresentation) => <div><p>{item.planName}</p>{item.planId ? <p className="break-all text-xs text-[var(--dashboard-muted)]">Clé : {item.planId}</p> : null}<PlatformDataQualityBadge quality={item.planQuality} /></div> },
    { id: "price", header: "Prix associé", numeric: true, cell: (item: PlatformSubscriptionPresentation) => <div><p>{item.price}</p><PlatformDataQualityBadge quality={item.priceQuality} /></div> },
    { id: "end", header: "Échéance", cell: (item: PlatformSubscriptionPresentation) => <div><p>{item.endDate}</p><PlatformDataQualityBadge quality={item.endDateQuality} /></div> },
    { id: "status", header: "Statut", cell: (item: PlatformSubscriptionPresentation) => <PlatformSubscriptionStatus state={item.status} label={item.statusLabel} /> },
  ]
  return <PlatformPage>
    <PlatformHeader title="Abonnements et données de facturation" subtitle="Vue des plans et abonnements chargés. Cette surface ne constitue pas un moteur complet de facturation SaaS." actions={<Button className="min-h-11" onClick={onManagePlans}><Package aria-hidden="true" className="mr-2 size-4" />Gérer les plans</Button>} />
    {error ? <PlatformErrorState title="Données Billing indisponibles" description="Impossible de charger les plans ou les abonnements. Les valeurs partielles ne sont pas présentées comme complètes." /> : null}
    <PlatformMetricGrid>
      <PlatformMetricCard icon={<TrendingUp />} label="MRR calculé sur la fenêtre" value={`${stats.mrr.toLocaleString()} XOF`} description={`Calcul existant sur les abonnements actifs chargés et les plans résolus. ${unresolvedPlans} liaison${unresolvedPlans === 1 ? "" : "s"} plan non résolue${unresolvedPlans === 1 ? "" : "s"}.`} quality="partial" />
      <PlatformMetricCard icon={<AlertTriangle />} label="Échéances sous 7 jours" value={stats.alerts} description="Abonnements actifs parmi les 50 documents chargés." quality="partial" />
      <PlatformMetricCard icon={<CreditCard />} label="Abonnements actifs chargés" value={stats.count} description="Ce nombre n’est pas un total serveur global." quality="partial" />
    </PlatformMetricGrid>
    <PlatformSection title="Journal des abonnements" description={<span className="inline-flex flex-wrap items-center gap-2">50 abonnements maximum, triés par échéance décroissante <PlatformDataQualityBadge quality="partial" /></span>}>
      {loading ? <PlatformLoadingState label="Chargement des abonnements et des plans" /> : <PlatformBillingTable label="Abonnements SaaS chargés" caption="Abonnements chargés et correspondances actuellement résolues" rows={subscriptions} columns={columns} getRowKey={(item) => item.id} emptyState={<PlatformEmptyState title="Aucun abonnement chargé" description="Aucun abonnement ne figure dans la fenêtre actuelle." />} />}
    </PlatformSection>
    <PlatformSection title="Plans chargés" description={<span className="inline-flex flex-wrap items-center gap-2">20 plans maximum, sans tri imposé par la requête actuelle <PlatformDataQualityBadge quality="partial" /></span>}>
      {loading ? <PlatformLoadingState label="Chargement des plans" /> : plans.length === 0 ? <PlatformEmptyState title="Aucun plan chargé" description="Aucun plan ne figure dans la fenêtre actuelle." /> : <PlatformPlanGrid>{plans.map((plan) => <PlatformPlanCard key={plan.id} title={plan.name} price={plan.price} description={[plan.code ? `Code : ${plan.code}` : "Code non renseigné", plan.activeLabel].join(" · ")} features={plan.features.length ? <ul className="space-y-1 text-sm text-[var(--dashboard-subtitle)]">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : <p className="text-sm text-[var(--dashboard-muted)]">Fonctionnalités indisponibles.</p>} action={<PlatformDataQualityBadge quality={plan.quality} />} />)}</PlatformPlanGrid>}
    </PlatformSection>
  </PlatformPage>
}
