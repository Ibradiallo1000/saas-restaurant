"use client"

import type { PosFinancialReportFilters } from "@/lib/finance/pos-report-filters"

export function PosFinancialFilters({ value, onChange, stations, cashiers, sessions, channels, paymentMethods }: {
  value: PosFinancialReportFilters
  onChange: (value: PosFinancialReportFilters) => void
  stations: Array<{ id: string; label: string }>
  cashiers: Array<{ id: string; label: string }>
  sessions: Array<{ id: string; label: string }>
  channels: string[]
  paymentMethods: string[]
}) {
  const field = (key: keyof PosFinancialReportFilters, label: string, options: Array<{ id: string; label: string }>) => <label className="text-xs font-semibold">{label}<select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })}><option value="all">Tous</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
  return <div className="grid w-full gap-2 md:grid-cols-5">
    {field("stationId", "Poste", stations)}
    {field("cashierId", "Caissier", cashiers)}
    {field("sessionId", "Session", sessions)}
    {field("channel", "Canal", channels.map((id) => ({ id, label: id })))}
    {field("paymentMethod", "Paiement", paymentMethods.map((id) => ({ id, label: id })))}
  </div>
}
