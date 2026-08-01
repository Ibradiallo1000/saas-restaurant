import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Banknote, ClipboardList, Clock3, Package, ReceiptText, ShieldCheck, Table2, Wallet } from "lucide-react"

import {
  DashboardAlert,
  DashboardAlertList,
  DashboardChartCard,
  ComparisonChart,
  DistributionChart,
  TrendChart,
  DashboardEmptyState,
  DashboardErrorState,
  DashboardHeader,
  DashboardLoadingState,
  DashboardPage,
  DashboardSection,
  DashboardStat,
  DashboardWidget,
  DashboardWidgetHeader,
  MetricCard,
  MetricGroup,
} from "@/components/dashboard-ui"
import { ManagerPeriodFilter } from "@/components/layout/manager-period-filter"
import { Button } from "@/components/ui/button"
import { NavigationTile, ResponsiveTileGrid } from "@/design-system/components"

export type ManagerDashboardOrderCounts = { pending: number; preparing: number; ready: number; cash_due: number; completed: number; late: number }
export type ManagerDashboardFinancialSummary = { todayDeposits: number; todayExpenses: number; balance: number; hasAbnormalNegativeBalance: boolean; anomalies: Array<{ label: string }> }
export type ManagerDashboardInventorySummary = { normalCount: number; outOfStockCount: number; lowStockCount: number; stockValue: number }
type OpenCashSession = { id: string; label: string }
type TableSummary = { total: number; occupied: number; free: number }
type RestaurantStatus = { isOpenNow: boolean; label: string; detail: string }

export interface ManagerDashboardViewProps {
  activeCashSession: boolean
  activeOperationalCount: number
  financialSummary: ManagerDashboardFinancialSummary
  inventorySummary: ManagerDashboardInventorySummary
  isLoading: boolean
  openCashSessions: OpenCashSession[]
  orderCounts: ManagerDashboardOrderCounts
  orderTrend: Array<{ label: string; value: number }>
  ordersError: boolean
  pendingCashValidationCount: number
  pendingSessionRequestCount: number
  periodLabel: string
  restaurantStatus: RestaurantStatus
  restaurantUnavailable?: boolean
  tableSummary: TableSummary
}

type Intervention = { id: string; title: string; description: string; href: string; tone: "negative" | "warning" }

export function ManagerDashboardView({ activeOperationalCount, financialSummary, inventorySummary, isLoading, openCashSessions, orderCounts, orderTrend, ordersError, pendingCashValidationCount, pendingSessionRequestCount, periodLabel, restaurantStatus, restaurantUnavailable = false, tableSummary }: ManagerDashboardViewProps) {
  if (restaurantUnavailable) return <DashboardErrorState className="min-h-[60vh]" title="Restaurant non disponible" description="Aucun restaurant n’est associé à ce tableau de bord." />

  const interventions = buildManagerInterventions({ financialSummary, inventorySummary, orderCounts, pendingCashValidationCount, pendingSessionRequestCount })
  const hasCommandIntervention = orderCounts.late > 0 || orderCounts.cash_due > 0 || activeOperationalCount > 0

  return <DashboardPage className="px-0 py-0 pb-20 md:pb-6">
    <DashboardHeader title="Vue d’ensemble" meta={<>Période sélectionnée : <span className="font-semibold text-[var(--dashboard-subtitle)]">{periodLabel}</span> · Les données en direct gardent leur propre temporalité.</>} actions={<><ManagerPeriodFilter />{hasCommandIntervention ? <Button asChild className="min-h-10"><Link href="/manager/commandes">Ouvrir les commandes</Link></Button> : null}</>} />

    {ordersError ? <DashboardErrorState className="min-h-32" title="Commandes temporairement indisponibles" description="Les indicateurs liés aux commandes n’ont pas pu être chargés. Les autres informations restent disponibles." /> : null}

    <DashboardSection surface variant="danger" title="Alertes critiques" description="Éléments disponibles qui nécessitent une action maintenant.">
      {interventions.length === 0 ? <DashboardAlert tone="neutral" icon={<ShieldCheck />} title="Aucune intervention prioritaire" description="Aucun retard, encaissement, incident de caisse ou stock critique n’est signalé." /> : <DashboardAlertList>{interventions.map((item) => <DashboardAlert key={item.id} announce={item.tone === "negative"} tone={item.tone} icon={<AlertTriangle />} title={item.title} description={item.description} action={<Button asChild size="sm" variant="outline"><Link href={item.href}>Traiter</Link></Button>} />)}</DashboardAlertList>}
    </DashboardSection>

    <DashboardSection surface variant="activity" title="Situation immédiate" description="État opérationnel en direct ; ces valeurs ne suivent pas la période sélectionnée.">
      {isLoading ? <DashboardLoadingState label="Chargement de l’activité opérationnelle" /> : <MetricGroup density="compact" className="lg:grid-cols-4 xl:grid-cols-6">
        <ManagerMetricLink variant="activity" href="/manager/commandes" label="Commandes actives" value={activeOperationalCount} description="En attente, en préparation ou prêtes." icon={<ClipboardList />} />
        <ManagerMetricLink variant={orderCounts.late > 0 ? "danger" : "success"} href="/manager/commandes?status=late" label="Retards" value={orderCounts.late} description={orderCounts.late > 0 ? "Intervention immédiate requise." : "Aucune commande en retard."} icon={<AlertTriangle />} />
        <ManagerMetricLink variant="finance" href="/manager/caisse?filter=payments" label="À encaisser" value={orderCounts.cash_due} description={orderCounts.cash_due > 0 ? "Commandes servies restant à encaisser." : "Aucun encaissement en attente."} icon={<Wallet />} />
        <ManagerMetricLink variant="finance" href="/manager/caisse" label="Caisses ouvertes" value={openCashSessions.length} description={openCashSessions.length ? openCashSessions.map((session) => session.label).join(", ") : "Aucune caisse ouverte."} icon={<ReceiptText />} />
        <ManagerMetricLink variant={tableSummary.occupied > 0 ? "activity" : "success"} href="/manager/tables" label="Tables occupées" value={tableSummary.occupied} description={`${tableSummary.free} libre(s) sur ${tableSummary.total}.`} icon={<Table2 />} />
        <MetricCard variant={restaurantStatus.isOpenNow ? "success" : "neutral"} label="Restaurant" value={restaurantStatus.label} description={restaurantStatus.detail} icon={<Clock3 />} emphasis={restaurantStatus.isOpenNow ? "default" : "subtle"} />
      </MetricGroup>}
    </DashboardSection>

    <DashboardSection surface variant="neutral" title="Actions rapides">
      <ResponsiveTileGrid desktopColumns={5}>
        <NavigationTile variant="activity" href="/manager/commandes" title="Commandes" icon={<ClipboardList />} />
        <NavigationTile variant="finance" href="/manager/caisse" title="Caisse" icon={<Wallet />} />
        <NavigationTile variant="stock" href="/manager/stock/controls" title="Contrôler le stock" icon={<Package />} />
        <NavigationTile variant="success" href="/manager/tables" title="Tables" icon={<Table2 />} />
        <NavigationTile variant="warning" href="/manager/depenses" title="Nouvelle dépense" icon={<Banknote />} />
      </ResponsiveTileGrid>
    </DashboardSection>

    <DashboardSection surface variant="info" title="Suivi opérationnel"><div className="grid gap-3 lg:grid-cols-2">
      <ManagerOrdersWidget counts={orderCounts} activeCount={activeOperationalCount} loading={isLoading} periodLabel={periodLabel} />
      <ManagerCashWidget openCashSessions={openCashSessions} pendingCashValidationCount={pendingCashValidationCount} pendingSessionRequestCount={pendingSessionRequestCount} />
      <ManagerKitchenTablesWidget counts={orderCounts} tableSummary={tableSummary} />
      <ManagerInventoryWidget summary={inventorySummary} />
    </div></DashboardSection>

    <DashboardSection surface variant="neutral" title="Évolutions et répartitions" description="Données déjà chargées pour la période sélectionnée.">
      <div className="grid gap-3 md:grid-cols-2">
        <DashboardChartCard variant="activity" title="Évolution des commandes"><TrendChart data={orderTrend} label="Évolution des commandes" description="Commandes créées par intervalle." loading={isLoading} /></DashboardChartCard>
        <DashboardChartCard variant="activity" title="État des commandes"><DistributionChart data={[{ label: "En attente", value: orderCounts.pending }, { label: "Préparation", value: orderCounts.preparing }, { label: "Prêtes", value: orderCounts.ready }, { label: "Terminées", value: orderCounts.completed }, { label: "Retards", value: orderCounts.late }]} label="État des commandes" description="Répartition des statuts disponibles." loading={isLoading} /></DashboardChartCard>
        <DashboardChartCard variant="success" title="Encaissements et sorties"><ComparisonChart data={[{ label: "Période", value: financialSummary.todayDeposits, secondary: financialSummary.todayExpenses }]} label="Encaissements et sorties" description="Mouvements enregistrés, sans assimilation au chiffre d’affaires." /></DashboardChartCard>
        <DashboardChartCard variant="stock" title="État du stock"><DistributionChart data={[{ label: "Normaux", value: inventorySummary.normalCount }, { label: "Faibles", value: inventorySummary.lowStockCount }, { label: "Rupture", value: inventorySummary.outOfStockCount }]} label="État du stock" description="Répartition des articles suivis." /></DashboardChartCard>
      </div>
    </DashboardSection>

    <ManagerFinancialWidget financialSummary={financialSummary} />

    <DashboardSection surface variant="neutral" title="Informations secondaires"><DashboardWidget variant="neutral"><div className="grid gap-3 p-4 sm:grid-cols-2"><DashboardStat label="Période sélectionnée" value={periodLabel} /><DashboardStat label="Horaires du restaurant" value={`${restaurantStatus.label} · ${restaurantStatus.detail}`} tone={restaurantStatus.isOpenNow ? "positive" : "neutral"} /></div></DashboardWidget></DashboardSection>
  </DashboardPage>
}

function ManagerMetricLink({ description, href, icon, label, unit, value, variant = "neutral" }: { description: string; href: string; icon: React.ReactNode; label: string; unit?: string; value: React.ReactNode; variant?: React.ComponentProps<typeof MetricCard>["variant"] }) {
  return <Link href={href} className="rounded-[var(--radius-dashboard-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"><MetricCard variant={variant} interactive className="h-full" label={label} value={value} unit={unit} description={description} icon={icon} /></Link>
}

function ManagerOrdersWidget({ activeCount, counts, loading, periodLabel }: { activeCount: number; counts: ManagerDashboardOrderCounts; loading: boolean; periodLabel: string }) {
  return <DashboardWidget variant="activity"><DashboardWidgetHeader title="Commandes et activité" action={<Button asChild size="sm" variant="outline"><Link href="/manager/commandes">Gérer les commandes</Link></Button>} />{loading ? <div className="p-4"><DashboardLoadingState compact label="Chargement des commandes" /></div> : <div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="Actives maintenant" value={activeCount} tone={activeCount > 0 ? "info" : "neutral"} /><DashboardStat label="En attente" value={counts.pending} tone={counts.pending > 0 ? "warning" : "neutral"} /><DashboardStat label="En préparation" value={counts.preparing} /><DashboardStat label="Prêtes" value={counts.ready} tone={counts.ready > 0 ? "info" : "neutral"} /><DashboardStat label="Retards" value={counts.late} tone={counts.late > 0 ? "negative" : "positive"} /><DashboardStat label={`Terminées · ${periodLabel}`} value={counts.completed} /></div>}</DashboardWidget>
}

function ManagerCashWidget({ openCashSessions, pendingCashValidationCount, pendingSessionRequestCount }: { openCashSessions: OpenCashSession[]; pendingCashValidationCount: number; pendingSessionRequestCount: number }) {
  return <DashboardWidget variant="finance"><DashboardWidgetHeader title="Caisses" description="Sessions et décisions en attente." action={<Button asChild size="sm" variant="outline"><Link href="/manager/caisse">Gérer les caisses</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="Caisses ouvertes" value={openCashSessions.length} tone={openCashSessions.length ? "positive" : "neutral"} /><DashboardStat label="Demandes d’ouverture" value={pendingSessionRequestCount} tone={pendingSessionRequestCount > 0 ? "warning" : "neutral"} /><DashboardStat label="Caisses à valider" value={pendingCashValidationCount} tone={pendingCashValidationCount > 0 ? "warning" : "neutral"} /><div className="sm:col-span-2"><p className="text-xs font-medium text-[var(--dashboard-label)]">Utilisateurs en caisse</p><p className="mt-1 text-sm font-semibold">{openCashSessions.length ? openCashSessions.map((session) => session.label).join(" · ") : "Aucune session ouverte"}</p></div></div></DashboardWidget>
}

function ManagerKitchenTablesWidget({ counts, tableSummary }: { counts: ManagerDashboardOrderCounts; tableSummary: TableSummary }) {
  return <DashboardWidget variant="info"><DashboardWidgetHeader title="Cuisine et tables" description="Résumé issu des commandes et tables actuellement chargées." action={<Button asChild size="sm" variant="outline"><Link href="/manager/tables">Voir les tables</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="À préparer" value={counts.pending} tone={counts.pending > 0 ? "warning" : "neutral"} /><DashboardStat label="En préparation" value={counts.preparing} /><DashboardStat label="Prêtes" value={counts.ready} tone={counts.ready > 0 ? "info" : "neutral"} /><DashboardStat label="Tables libres / occupées" value={`${tableSummary.free} / ${tableSummary.occupied}`} /></div></DashboardWidget>
}

function ManagerFinancialWidget({ financialSummary }: { financialSummary: ManagerDashboardFinancialSummary }) {
  return <DashboardSection surface variant="success" title="Résumé financier" description="Mouvements financiers du jour ; ils ne sont pas présentés comme du chiffre d’affaires."><DashboardWidget variant="success"><DashboardWidgetHeader title="Mouvements du jour" action={<Button asChild size="sm" variant="outline"><Link href="/manager/tresorerie">Voir la trésorerie</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-3"><DashboardStat label="Entrées enregistrées" value={`${financialSummary.todayDeposits.toLocaleString("fr-FR")} FCFA`} /><DashboardStat label="Dépenses enregistrées" value={`${financialSummary.todayExpenses.toLocaleString("fr-FR")} FCFA`} /><DashboardStat label="Solde disponible" value={`${financialSummary.balance.toLocaleString("fr-FR")} FCFA`} tone={financialSummary.balance < 0 ? "negative" : "neutral"} />{financialSummary.anomalies.length > 0 ? <DashboardAlert className="sm:col-span-3" tone="negative" title="Anomalie de caisse" description={financialSummary.anomalies[0]?.label} action={<Button asChild size="sm" variant="outline"><Link href="/manager/caisse">Vérifier</Link></Button>} /> : null}</div></DashboardWidget></DashboardSection>
}

function ManagerInventoryWidget({ summary }: { summary: ManagerDashboardInventorySummary }) {
  const hasInventorySignal = summary.outOfStockCount > 0 || summary.lowStockCount > 0
  return <DashboardWidget variant="stock"><DashboardWidgetHeader title={hasInventorySignal ? "Stock à surveiller" : "Stock sans alerte prioritaire"} description={hasInventorySignal ? "Des articles nécessitent une vérification." : "Aucune rupture ou alerte de stock faible n’est détectée."} action={<Button asChild size="sm" variant="outline"><Link href="/manager/stock">Voir le stock</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-3"><DashboardStat label="Ruptures" value={summary.outOfStockCount} tone={summary.outOfStockCount > 0 ? "negative" : "positive"} /><DashboardStat label="Stock faible" value={summary.lowStockCount} tone={summary.lowStockCount > 0 ? "warning" : "positive"} /><DashboardStat label="Valeur estimée" value={`${summary.stockValue.toLocaleString("fr-FR")} FCFA`} /></div>{!hasInventorySignal && summary.stockValue === 0 ? <div className="px-4 pb-4"><DashboardEmptyState className="min-h-28" title="Aucune valeur de stock disponible" description="La valeur apparaîtra après les premiers approvisionnements." /></div> : null}</DashboardWidget>
}

function buildManagerInterventions({ financialSummary, inventorySummary, orderCounts, pendingCashValidationCount, pendingSessionRequestCount }: { financialSummary: ManagerDashboardFinancialSummary; inventorySummary: ManagerDashboardInventorySummary; orderCounts: ManagerDashboardOrderCounts; pendingCashValidationCount: number; pendingSessionRequestCount: number }): Intervention[] {
  const items: Intervention[] = []
  if (orderCounts.late > 0) items.push({ id: "late-orders", title: "Commandes en retard", description: `${orderCounts.late} commande(s) nécessitent une intervention.`, href: "/manager/commandes?status=late", tone: "negative" })
  if (orderCounts.cash_due > 0) items.push({ id: "cash-due", title: "Encaissements en attente", description: `${orderCounts.cash_due} commande(s) servies restent à encaisser.`, href: "/manager/caisse?filter=payments", tone: "warning" })
  if (inventorySummary.outOfStockCount > 0) items.push({ id: "out-of-stock", title: "Ruptures de stock", description: `${inventorySummary.outOfStockCount} article(s) sont signalés en rupture.`, href: "/manager/stock", tone: "negative" })
  if (pendingCashValidationCount > 0) items.push({ id: "cash-validation", title: "Caisses à valider", description: `${pendingCashValidationCount} validation(s) de caisse sont en attente.`, href: "/manager/caisse", tone: "warning" })
  if (pendingSessionRequestCount > 0) items.push({ id: "session-requests", title: "Demandes d’ouverture de caisse", description: `${pendingSessionRequestCount} demande(s) sont en attente.`, href: "/manager/caisse", tone: "warning" })
  if (financialSummary.hasAbnormalNegativeBalance) items.push({ id: "cash-anomaly", title: "Anomalie de caisse", description: financialSummary.anomalies[0]?.label || "Le solde de caisse doit être vérifié.", href: "/manager/caisse", tone: "negative" })
  if (inventorySummary.lowStockCount > 0 && inventorySummary.outOfStockCount === 0) items.push({ id: "low-stock", title: "Stock faible", description: `${inventorySummary.lowStockCount} article(s) sont à surveiller.`, href: "/manager/stock", tone: "warning" })
  return items
}
