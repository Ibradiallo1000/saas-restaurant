import type { ReportDataQuality } from "@/components/reports-ui"

export interface PosSessionReportModel { reference: string; employee: string; schedule: string; status: string; orders: string; payments: string; cash: string; mobileMoney: string; openedAt: string; closedAt: string; variance: string; duration: string; quality: ReportDataQuality }
export interface PosSessionHistoryModel { id: string; reference: string; schedule: string; ordersAndVariance: string; total: string; status: string }
export interface PosSessionValidationModel { id: string; reference: string; orders: string; system: string; real: string; variance: string; validated: boolean }
export interface PosSessionReportsViewModel { report: PosSessionReportModel | null; history: PosSessionHistoryModel[]; validations: PosSessionValidationModel[]; historyQuality: ReportDataQuality }
export function buildPosSessionReportsViewModel(input: PosSessionReportsViewModel) { return input }

