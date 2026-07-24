"use client"

import * as React from "react"
import { Banknote, ListFilter, ReceiptText, Wallet } from "lucide-react"
import {
  DataQualityBadge,
  FreshnessIndicator,
  ReportMetricCard,
  ReportsEmptyState,
  ReportsErrorState,
  ReportsEstimatedState,
  ReportsHeader,
  ReportsInsightList,
  ReportsPage,
  ReportsPaymentSummary,
  ReportsPeriodFilter,
  ReportsSummary,
  ReportsTable,
  ReportsTableToolbar,
  type ReportsCustomRange,
} from "@/components/reports-ui"
import type { TimeFilterType } from "@/contexts/time-filter-context"
import { cn } from "@/lib/utils"
import { OWNER_TREASURY_MOVEMENT_COLUMNS, type OwnerReportsViewModel } from "./owner-reports-view-model"

const PERIOD_OPTIONS = [
  { id: "today", label: "Aujourd’hui" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "custom", label: "Personnalisé" },
]

export interface OwnerReportsViewProps {
  model: OwnerReportsViewModel
  errors?: string[]
  period: TimeFilterType
  customRange: ReportsCustomRange
  onPeriodChange: (value: TimeFilterType) => void
  onCustomRangeChange: (range: ReportsCustomRange) => void
  directionFilter: string
  accountFilter: string
  sourceFilter: string
  accountOptions: Array<{ id: string; label: string }>
  sourceOptions: Array<{ id: string; label: string }>
  onDirectionFilterChange: (value: string) => void
  onAccountFilterChange: (value: string) => void
  onSourceFilterChange: (value: string) => void
}

export function OwnerReportsView({ accountFilter, accountOptions, customRange, directionFilter, errors = [], model, onAccountFilterChange, onCustomRangeChange, onDirectionFilterChange, onPeriodChange, onSourceFilterChange, period, sourceFilter, sourceOptions }: OwnerReportsViewProps) {
  const movementsUnavailable = errors.includes("mouvements financiers")
  const sessionsUnavailable = errors.includes("sessions de caisse")
  const globalQuality = errors.length ? "unavailable" : model.balanceQuality === "estimated" || model.movementsQuality === "estimated" ? "estimated" : "complete"
  return <ReportsPage className="pb-20 md:pb-6">
    <ReportsHeader title="Rapports" subtitle="Analyse stratégique des soldes, flux financiers et contrôles de caisse réellement disponibles pour le restaurant." meta={<>Période active : <strong>{model.periodLabel}</strong> · Base temporelle locale du navigateur</>} context={<><DataQualityBadge quality={globalQuality} /><FreshnessIndicator freshness={errors.length ? "unknown" : "live"} label={errors.length ? "Fraîcheur partiellement indisponible" : "Synchronisation temps réel"} /></>} />

    <ReportsPeriodFilter options={PERIOD_OPTIONS} value={period} onValueChange={(value) => onPeriodChange(value as TimeFilterType)} customRange={customRange} onCustomRangeChange={onCustomRangeChange} />
    {errors.length ? <ReportsErrorState title="Certaines données Owner sont indisponibles" description={`Domaines concernés : ${errors.join(", ")}. Les autres sections restent affichées avec les données disponibles.`} /> : null}

    {model.balanceQuality === "estimated" ? <ReportsEstimatedState title="Solde reconstruit depuis les mouvements" description="Les comptes ne portent aucun solde non nul. La valeur affichée conserve le fallback historique de cette vue et ne constitue pas une nouvelle source de vérité." /> : null}
    {model.movementsQuality === "estimated" ? <ReportsEstimatedState title="Ventilation historique estimée" description="Certaines validations de sessions legacy sont réparties entre espèces et Mobile Money à partir du snapshot de session existant." /> : null}

    <section aria-labelledby="owner-report-kpis" className="space-y-3"><h2 id="owner-report-kpis" className="text-[length:var(--text-dashboard-section-title)] font-semibold">Indicateurs financiers</h2><ReportsSummary>
      <ReportMetricCard label="Solde total" value={model.balance.replace(" FCFA", "")} unit="FCFA" description="Solde courant des comptes, avec fallback historique si nécessaire." icon={<Wallet />} quality={model.balanceQuality} freshness="live" />
      <ReportMetricCard label="Entrées période" value={movementsUnavailable ? "—" : model.incoming.replace(" FCFA", "")} unit={movementsUnavailable ? undefined : "FCFA"} description={model.periodLabel} icon={<ReceiptText />} quality={movementsUnavailable ? "unavailable" : model.movementsQuality} freshness="live" />
      <ReportMetricCard label="Sorties période" value={movementsUnavailable ? "—" : model.outgoing.replace(" FCFA", "")} unit={movementsUnavailable ? undefined : "FCFA"} description={model.periodLabel} icon={<Banknote />} quality={movementsUnavailable ? "unavailable" : model.movementsQuality} freshness="live" />
      <ReportMetricCard label="Transferts internes" value={movementsUnavailable ? "—" : model.transfers.replace(" FCFA", "")} unit={movementsUnavailable ? undefined : "FCFA"} description={model.periodLabel} icon={<ListFilter />} quality={movementsUnavailable ? "unavailable" : model.movementsQuality} freshness="live" />
    </ReportsSummary></section>

    <div className="grid gap-[var(--dashboard-grid-gap)] lg:grid-cols-[1.4fr_.9fr]">
      <ReportsPaymentSummary title="Répartition par source" description="Soldes des comptes de trésorerie. Ces montants ne représentent pas un rapport de paiements encaissés.">{model.accounts.map((account) => <article key={account.id} className="rounded-[var(--radius-dashboard-card)] bg-[var(--reports-muted)] p-4"><p className="text-xs font-semibold uppercase text-[var(--dashboard-label)]">{account.name}</p><p className="mt-2 break-words text-xl font-bold tabular-nums text-[var(--dashboard-value)]">{account.value}</p><p className="mt-1 text-xs text-[var(--dashboard-muted)]">{account.kind}</p></article>)}</ReportsPaymentSummary>
      {sessionsUnavailable ? <ReportsErrorState title="Contrôle caisse indisponible" description="Les sessions n’ont pas pu être chargées ; aucun compteur nul n’est affiché à leur place." /> : <ReportsInsightList title="Contrôle caisse" description={`Contrôles enregistrés · ${model.periodLabel}`} items={model.insights} />}
    </div>

    <section aria-labelledby="owner-report-history" className="space-y-3"><div><h2 id="owner-report-history" className="text-[length:var(--text-dashboard-section-title)] font-semibold">Historique financier</h2><p className="text-sm text-[var(--dashboard-muted)]">Date, source, compte impacté, montant et responsable de chaque mouvement.</p></div>
      <ReportsTableToolbar count={`${model.movements.length} mouvement${model.movements.length > 1 ? "s" : ""}`} filters={<div className="grid w-full gap-2 sm:grid-cols-3"><FilterSelect label="Type" value={directionFilter} onChange={onDirectionFilterChange} options={[{ id: "all", label: "Tous" }, { id: "in", label: "Entrées" }, { id: "out", label: "Sorties" }, { id: "transfer", label: "Transferts" }]} /><FilterSelect label="Compte" value={accountFilter} onChange={onAccountFilterChange} options={[{ id: "all", label: "Tous" }, ...accountOptions]} /><FilterSelect label="Source" value={sourceFilter} onChange={onSourceFilterChange} options={[{ id: "all", label: "Toutes" }, ...sourceOptions]} /></div>} />
      <ReportsTable label="Historique financier" caption={`Mouvements de trésorerie pour ${model.periodLabel}`} columns={OWNER_TREASURY_MOVEMENT_COLUMNS} rows={model.movements} getRowKey={(row) => row.id} errorState={movementsUnavailable ? <ReportsErrorState title="Historique financier indisponible" description={`Les mouvements de ${model.periodLabel} n’ont pas pu être chargés.`} /> : undefined} emptyState={<ReportsEmptyState title={directionFilter !== "all" || accountFilter !== "all" || sourceFilter !== "all" ? "Aucun mouvement ne correspond aux filtres" : "Aucune donnée pour cette période"} description={directionFilter !== "all" || accountFilter !== "all" || sourceFilter !== "all" ? "Modifiez les filtres existants pour retrouver d’autres mouvements." : "Aucun mouvement n’est disponible pour la période sélectionnée."} />} />
    </section>
  </ReportsPage>
}

function FilterSelect({ label, onChange, options, value }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }> }) {
  const id = React.useId()
  return <label htmlFor={id} className="text-xs font-semibold text-[var(--dashboard-label)]">{label}<select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={cn("dashboard-focus-visible mt-1 min-h-[var(--target-dashboard-recommended)] w-full rounded-[var(--radius-dashboard-input)] border border-[var(--reports-border)] bg-[var(--reports-panel)] px-3 text-sm font-medium text-[var(--dashboard-title)]")}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
}
