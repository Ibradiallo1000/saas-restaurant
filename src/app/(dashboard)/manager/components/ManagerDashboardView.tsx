import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ClipboardList, PackageCheck, ReceiptText, ShieldCheck, Wallet } from "lucide-react"

import {
  DashboardAlert,
  DashboardAlertList,
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
import { Button } from "@/components/ui/button"

export type ManagerDashboardOrderCounts = {
  pending: number
  preparing: number
  ready: number
  cash_due: number
  completed: number
  late: number
}

export type ManagerDashboardFinancialSummary = {
  todayDeposits: number
  todayExpenses: number
  balance: number
  hasAbnormalNegativeBalance: boolean
  anomalies: Array<{ label: string }>
}

export type ManagerDashboardInventorySummary = {
  outOfStockCount: number
  lowStockCount: number
  stockValue: number
}

export interface ManagerDashboardViewProps {
  activeCashSession: boolean
  activeOperationalCount: number
  financialSummary: ManagerDashboardFinancialSummary
  inventorySummary: ManagerDashboardInventorySummary
  isLoading: boolean
  orderCounts: ManagerDashboardOrderCounts
  ordersError: boolean
  pendingCashValidationCount: number
  pendingSessionRequestCount: number
  periodLabel: string
  restaurantUnavailable?: boolean
}

type Intervention = {
  id: string
  title: string
  description: string
  href: string
  tone: "negative" | "warning"
}

export function ManagerDashboardView({
  activeCashSession,
  activeOperationalCount,
  financialSummary,
  inventorySummary,
  isLoading,
  orderCounts,
  ordersError,
  pendingCashValidationCount,
  pendingSessionRequestCount,
  periodLabel,
  restaurantUnavailable = false,
}: ManagerDashboardViewProps) {
  if (restaurantUnavailable) {
    return <DashboardErrorState className="min-h-[60vh]" title="Restaurant non disponible" description="Aucun restaurant n’est associé à ce tableau de bord." />
  }

  const interventions = buildManagerInterventions({
    inventorySummary,
    orderCounts,
    pendingCashValidationCount,
    pendingSessionRequestCount,
    financialSummary,
  })
  const hasCommandIntervention = orderCounts.late > 0 || orderCounts.cash_due > 0 || activeOperationalCount > 0

  return (
    <DashboardPage className="px-0 py-0 pb-20 md:pb-6">
      <DashboardHeader
        title="Tableau de bord"
        subtitle="Surveillez les opérations et traitez les interventions prioritaires du restaurant."
        meta={<>Période sélectionnée : <span className="font-semibold text-[var(--dashboard-subtitle)]">{periodLabel}</span> · Les indicateurs « Maintenant » et « Aujourd’hui » gardent leur propre temporalité.</>}
        actions={hasCommandIntervention ? <Button asChild className="min-h-10"><Link href="/manager/commandes">Ouvrir les commandes</Link></Button> : undefined}
      />

      {ordersError ? (
        <DashboardErrorState
          className="min-h-32"
          title="Commandes temporairement indisponibles"
          description="Les indicateurs liés aux commandes n’ont pas pu être chargés. Les autres informations restent disponibles."
        />
      ) : null}

      <DashboardSection title="Interventions prioritaires" description="Éléments disponibles qui nécessitent une action maintenant.">
        {interventions.length === 0 ? (
          <DashboardAlert tone="neutral" icon={<ShieldCheck />} title="Aucune intervention prioritaire" description="Aucun retard, encaissement, incident de caisse ou stock critique n’est signalé." />
        ) : (
          <DashboardAlertList>
            {interventions.map((item) => (
              <DashboardAlert
                key={item.id}
                announce={item.tone === "negative"}
                tone={item.tone}
                icon={<AlertTriangle />}
                title={item.title}
                description={item.description}
                action={<Button asChild size="sm" variant="outline"><Link href={item.href}>Traiter</Link></Button>}
              />
            ))}
          </DashboardAlertList>
        )}
      </DashboardSection>

      <DashboardSection title="Maintenant" description="État opérationnel en direct ; ces valeurs ne suivent pas la période sélectionnée.">
        {isLoading ? <DashboardLoadingState label="Chargement de l’activité opérationnelle" /> : (
          <MetricGroup>
            <ManagerMetricLink href="/manager/commandes" label="Commandes actives" value={activeOperationalCount} description="En attente, en préparation ou prêtes." icon={<ClipboardList />} />
            <ManagerMetricLink href="/manager/commandes?status=late" label="Retards" value={orderCounts.late} description={orderCounts.late > 0 ? "Intervention immédiate requise." : "Aucune commande en retard."} icon={<AlertTriangle />} />
            <ManagerMetricLink href="/manager/caisse?filter=payments" label="À encaisser" value={orderCounts.cash_due} description={orderCounts.cash_due > 0 ? "Commandes servies restant à encaisser." : "Aucun encaissement en attente."} icon={<Wallet />} />
            <ManagerMetricLink href="/manager/tresorerie" label="Solde de caisse" value={financialSummary.balance.toLocaleString("fr-FR")} unit="FCFA" description={activeCashSession ? "Périmètre de la session de caisse ouverte." : "Périmètre global, aucune session ouverte détectée."} icon={<ReceiptText />} />
          </MetricGroup>
        )}
      </DashboardSection>

      <div className="grid gap-[var(--dashboard-section-gap)] 2xl:grid-cols-2">
        <ManagerOrdersWidget counts={orderCounts} activeCount={activeOperationalCount} loading={isLoading} periodLabel={periodLabel} />
        <ManagerCashWidget activeCashSession={activeCashSession} financialSummary={financialSummary} pendingCashValidationCount={pendingCashValidationCount} pendingSessionRequestCount={pendingSessionRequestCount} />
      </div>

      <ManagerInventoryWidget summary={inventorySummary} />
    </DashboardPage>
  )
}

function ManagerMetricLink({ description, href, icon, label, unit, value }: { description: string; href: string; icon: React.ReactNode; label: string; unit?: string; value: React.ReactNode }) {
  return <Link href={href} className="rounded-[var(--radius-dashboard-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"><MetricCard interactive className="h-full" label={label} value={value} unit={unit} description={description} icon={icon} /></Link>
}

function ManagerOrdersWidget({ activeCount, counts, loading, periodLabel }: { activeCount: number; counts: ManagerDashboardOrderCounts; loading: boolean; periodLabel: string }) {
  return <DashboardWidget><DashboardWidgetHeader title="Commandes et activité" description="Maintenant, sauf les commandes terminées qui suivent la période sélectionnée." action={<Button asChild size="sm" variant="outline"><Link href="/manager/commandes">Gérer les commandes</Link></Button>} />{loading ? <div className="p-4"><DashboardLoadingState compact label="Chargement des commandes" /></div> : <div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="Actives maintenant" value={activeCount} tone={activeCount > 0 ? "info" : "neutral"} /><DashboardStat label="En attente" value={counts.pending} tone={counts.pending > 0 ? "warning" : "neutral"} /><DashboardStat label="En préparation" value={counts.preparing} /><DashboardStat label="Prêtes" value={counts.ready} tone={counts.ready > 0 ? "info" : "neutral"} /><DashboardStat label="Retards" value={counts.late} tone={counts.late > 0 ? "negative" : "positive"} /><DashboardStat label={`Terminées · ${periodLabel}`} value={counts.completed} /></div>}</DashboardWidget>
}

function ManagerCashWidget({ activeCashSession, financialSummary, pendingCashValidationCount, pendingSessionRequestCount }: { activeCashSession: boolean; financialSummary: ManagerDashboardFinancialSummary; pendingCashValidationCount: number; pendingSessionRequestCount: number }) {
  return <DashboardWidget><DashboardWidgetHeader title="Caisse et encaissements" description="Montants du jour et état de la session de caisse." action={<Button asChild size="sm" variant="outline"><Link href="/manager/caisse">Ouvrir la caisse</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-2"><DashboardStat label="Encaissé aujourd’hui" value={`${financialSummary.todayDeposits.toLocaleString("fr-FR")} FCFA`} /><DashboardStat label="Dépenses aujourd’hui" value={`${financialSummary.todayExpenses.toLocaleString("fr-FR")} FCFA`} /><DashboardStat label="Solde de caisse" value={`${financialSummary.balance.toLocaleString("fr-FR")} FCFA`} tone={financialSummary.balance < 0 ? "negative" : "neutral"} /><DashboardStat label="État de session" value={activeCashSession ? "Ouverte" : "Aucune session ouverte"} tone={activeCashSession ? "positive" : "neutral"} /><DashboardStat label="Demandes d’ouverture" value={pendingSessionRequestCount} tone={pendingSessionRequestCount > 0 ? "warning" : "neutral"} /><DashboardStat label="Caisses à valider" value={pendingCashValidationCount} tone={pendingCashValidationCount > 0 ? "warning" : "neutral"} />{financialSummary.anomalies.length > 0 ? <DashboardAlert className="sm:col-span-2" tone="negative" title="Anomalie de caisse" description={financialSummary.anomalies[0]?.label} action={<Button asChild size="sm" variant="outline"><Link href="/manager/caisse">Vérifier</Link></Button>} /> : null}</div></DashboardWidget>
}

function ManagerInventoryWidget({ summary }: { summary: ManagerDashboardInventorySummary }) {
  const hasInventorySignal = summary.outOfStockCount > 0 || summary.lowStockCount > 0
  return <DashboardSection title="Stock" description="Résumé actionnable ; le détail reste dans l’inventaire."><DashboardWidget><DashboardWidgetHeader title={hasInventorySignal ? "Stock à surveiller" : "Stock sans alerte prioritaire"} description={hasInventorySignal ? "Des produits nécessitent une vérification." : "Aucune rupture ou alerte de stock faible n’est détectée."} action={<Button asChild size="sm" variant="outline"><Link href="/manager/inventory">Voir l’inventaire</Link></Button>} /><div className="grid gap-4 p-4 sm:grid-cols-3"><DashboardStat label="Ruptures" value={summary.outOfStockCount} tone={summary.outOfStockCount > 0 ? "negative" : "positive"} /><DashboardStat label="Stock faible" value={summary.lowStockCount} tone={summary.lowStockCount > 0 ? "warning" : "positive"} /><DashboardStat label="Valeur estimée" value={`${summary.stockValue.toLocaleString("fr-FR")} FCFA`} /></div>{!hasInventorySignal && summary.stockValue === 0 ? <div className="px-4 pb-4"><DashboardEmptyState className="min-h-28" title="Aucune valeur de stock disponible" description="La valeur apparaîtra lorsque les stocks et coûts seront renseignés." /></div> : null}</DashboardWidget></DashboardSection>
}

function buildManagerInterventions({ financialSummary, inventorySummary, orderCounts, pendingCashValidationCount, pendingSessionRequestCount }: { financialSummary: ManagerDashboardFinancialSummary; inventorySummary: ManagerDashboardInventorySummary; orderCounts: ManagerDashboardOrderCounts; pendingCashValidationCount: number; pendingSessionRequestCount: number }): Intervention[] {
  const items: Intervention[] = []
  if (orderCounts.late > 0) items.push({ id: "late-orders", title: "Commandes en retard", description: `${orderCounts.late} commande(s) nécessitent une intervention.`, href: "/manager/commandes?status=late", tone: "negative" })
  if (orderCounts.cash_due > 0) items.push({ id: "cash-due", title: "Encaissements en attente", description: `${orderCounts.cash_due} commande(s) servies restent à encaisser.`, href: "/manager/caisse?filter=payments", tone: "warning" })
  if (inventorySummary.outOfStockCount > 0) items.push({ id: "out-of-stock", title: "Ruptures de stock", description: `${inventorySummary.outOfStockCount} produit(s) sont signalés en rupture.`, href: "/manager/inventory", tone: "negative" })
  if (pendingCashValidationCount > 0) items.push({ id: "cash-validation", title: "Caisses à valider", description: `${pendingCashValidationCount} validation(s) de caisse sont en attente.`, href: "/manager/caisse", tone: "warning" })
  if (pendingSessionRequestCount > 0) items.push({ id: "session-requests", title: "Demandes d’ouverture de caisse", description: `${pendingSessionRequestCount} demande(s) sont en attente.`, href: "/manager/caisse", tone: "warning" })
  if (financialSummary.hasAbnormalNegativeBalance) items.push({ id: "cash-anomaly", title: "Anomalie de caisse", description: financialSummary.anomalies[0]?.label || "Le solde de caisse doit être vérifié.", href: "/manager/caisse", tone: "negative" })
  if (inventorySummary.lowStockCount > 0 && inventorySummary.outOfStockCount === 0) items.push({ id: "low-stock", title: "Stock faible", description: `${inventorySummary.lowStockCount} produit(s) sont à surveiller.`, href: "/manager/inventory", tone: "warning" })
  return items
}
