import type { ReportDataQuality, ReportInsightPresentation, ReportTableColumnPresentation } from "@/components/reports-ui"

export type OwnerTreasuryDirection = "in" | "out" | "transfer"

export interface OwnerTreasuryAccountReport {
  id: string
  name: string
  kind: string
  value: string
}

export interface OwnerTreasuryMovementReport {
  id: string
  date: string
  direction: OwnerTreasuryDirection
  directionLabel: string
  label: string
  account: string
  incoming: string
  outgoing: string
  source: string
  validatedBy: string
}

export interface OwnerReportsViewModel {
  periodLabel: string
  balance: string
  incoming: string
  outgoing: string
  transfers: string
  balanceQuality: ReportDataQuality
  movementsQuality: ReportDataQuality
  accounts: OwnerTreasuryAccountReport[]
  insights: ReportInsightPresentation[]
  movements: OwnerTreasuryMovementReport[]
}

export interface BuildOwnerReportsViewModelInput {
  periodLabel: string
  displayBalance: number
  incoming: number
  outgoing: number
  transfers: number
  balanceUsesMovementFallback: boolean
  containsExpandedLegacyMovements: boolean
  accounts: Array<{ id: string; name: string; kind: string; balance: number }>
  sessionControls: { validated: number; pending: number; discrepancies: number }
  movements: OwnerTreasuryMovementReport[]
}

export function buildOwnerReportsViewModel(input: BuildOwnerReportsViewModelInput): OwnerReportsViewModel {
  return {
    periodLabel: input.periodLabel,
    balance: formatMoney(input.displayBalance),
    incoming: formatMoney(input.incoming),
    outgoing: formatMoney(input.outgoing),
    transfers: formatMoney(input.transfers),
    balanceQuality: input.balanceUsesMovementFallback ? "estimated" : "complete",
    movementsQuality: input.containsExpandedLegacyMovements ? "estimated" : "complete",
    accounts: input.accounts.map((account) => ({ ...account, value: formatMoney(account.balance) })),
    insights: [
      { id: "validated", title: "Sessions validées", value: input.sessionControls.validated, severity: "positive", description: input.periodLabel },
      { id: "pending", title: "En attente de validation", value: input.sessionControls.pending, severity: input.sessionControls.pending > 0 ? "warning" : "info", description: input.periodLabel },
      { id: "discrepancies", title: "Écarts détectés", value: input.sessionControls.discrepancies, severity: input.sessionControls.discrepancies > 0 ? "warning" : "info", description: input.periodLabel },
    ],
    movements: input.movements,
  }
}

export const OWNER_TREASURY_MOVEMENT_COLUMNS: ReportTableColumnPresentation<OwnerTreasuryMovementReport>[] = [
  { id: "date", header: "Date", cell: (row) => row.date },
  { id: "type", header: "Type", cell: (row) => row.directionLabel },
  { id: "label", header: "Libellé", cell: (row) => row.label },
  { id: "account", header: "Compte", cell: (row) => row.account },
  { id: "incoming", header: "Entrée", cell: (row) => row.incoming, align: "right", numeric: true },
  { id: "outgoing", header: "Sortie", cell: (row) => row.outgoing, align: "right", numeric: true },
  { id: "source", header: "Source", cell: (row) => row.source },
  { id: "validatedBy", header: "Validé par", cell: (row) => row.validatedBy },
]

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "0 FCFA"
  return `${Math.round(value).toLocaleString("fr-FR")} FCFA`
}

