import type { ReportDataQuality, ReportTableColumnPresentation } from "@/components/reports-ui"

export interface ManagerTreasuryAccountReport { id: string; name: string; kind: string; value: string }
export interface ManagerTreasuryMovementReport { id: string; date: string; type: string; label: string; account: string; incoming: string; outgoing: string; source: string; user: string }
export interface ManagerReportsViewModel {
  periodLabel: string
  balance: string
  deposits: string
  expenses: string
  balanceQuality: ReportDataQuality
  movementQuality: ReportDataQuality
  accounts: ManagerTreasuryAccountReport[]
  movements: ManagerTreasuryMovementReport[]
}
export interface BuildManagerReportsInput {
  periodLabel: string; balance: number; deposits: number; expenses: number
  balanceUsesFallback: boolean; movementsUseFallback: boolean; containsLegacyExpansion: boolean
  accounts: Array<{ id: string; name: string; kind: string; balance: number }>
  movements: ManagerTreasuryMovementReport[]
}
export function buildManagerReportsViewModel(input: BuildManagerReportsInput): ManagerReportsViewModel {
  return { periodLabel: input.periodLabel, balance: money(input.balance), deposits: money(input.deposits), expenses: money(input.expenses), balanceQuality: input.balanceUsesFallback ? "estimated" : "complete", movementQuality: input.movementsUseFallback || input.containsLegacyExpansion ? "estimated" : "complete", accounts: input.accounts.map((account) => ({ ...account, value: money(account.balance) })), movements: input.movements }
}
export const MANAGER_MOVEMENT_COLUMNS: ReportTableColumnPresentation<ManagerTreasuryMovementReport>[] = [
  { id: "date", header: "Date", cell: (row) => row.date }, { id: "type", header: "Type", cell: (row) => row.type },
  { id: "label", header: "Libellé", cell: (row) => row.label }, { id: "account", header: "Compte", cell: (row) => row.account },
  { id: "incoming", header: "Entrée", cell: (row) => row.incoming, align: "right", numeric: true }, { id: "outgoing", header: "Sortie", cell: (row) => row.outgoing, align: "right", numeric: true },
  { id: "source", header: "Source", cell: (row) => row.source }, { id: "user", header: "Utilisateur", cell: (row) => row.user },
]
function money(value: number) { return `${Math.round(Number.isFinite(value) ? value : 0).toLocaleString("fr-FR")} FCFA` }

