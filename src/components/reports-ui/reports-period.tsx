"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { DashboardFilters, DashboardToolbar } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { ReportPeriodOption } from "./reports-foundations"

export interface ReportsCustomRange { start: string; end: string; startInvalid?: boolean; endInvalid?: boolean }
export interface ReportsPeriodFilterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  label?: string; options: ReportPeriodOption[]; value: string; onValueChange: (value: string) => void
  customRange?: ReportsCustomRange; onCustomRangeChange?: (range: ReportsCustomRange) => void; customValue?: string
}
export const ReportsPeriodFilter = React.forwardRef<HTMLDivElement, ReportsPeriodFilterProps>(({ className, customRange, customValue = "custom", label = "Période du rapport", onCustomRangeChange, onValueChange, options, value, ...props }, ref) => {
  const startId = React.useId(); const endId = React.useId(); const custom = value === customValue && customRange && onCustomRangeChange
  return <DashboardToolbar ref={ref} aria-label={label} className={cn("bg-[var(--reports-panel)]", className)} {...props}><DashboardFilters><div role="group" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto">{options.map((option) => <button key={option.id} type="button" disabled={option.disabled} aria-pressed={value === option.id} onClick={() => onValueChange(option.id)} className={cn("dashboard-focus-visible min-h-[var(--target-dashboard-min)] shrink-0 rounded-[var(--radius-dashboard-button)] border border-[var(--reports-border)] px-3 text-sm font-semibold disabled:opacity-50", value === option.id ? "bg-[var(--reports-highlight)] text-[var(--dashboard-title)]" : "bg-[var(--reports-panel)] text-[var(--dashboard-subtitle)]")}>{option.label}</button>)}</div>{custom ? <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2"><label htmlFor={startId} className="text-xs font-medium text-[var(--dashboard-label)]">Début<input id={startId} type="date" value={customRange.start} aria-invalid={customRange.startInvalid || undefined} onChange={(event) => onCustomRangeChange({ ...customRange, start: event.target.value })} className="dashboard-focus-visible mt-1 block min-h-[var(--target-dashboard-recommended)] w-full rounded-[var(--radius-dashboard-input)] border border-[var(--reports-border)] bg-[var(--reports-panel)] px-3 text-sm" /></label><label htmlFor={endId} className="text-xs font-medium text-[var(--dashboard-label)]">Fin<input id={endId} type="date" value={customRange.end} aria-invalid={customRange.endInvalid || undefined} onChange={(event) => onCustomRangeChange({ ...customRange, end: event.target.value })} className="dashboard-focus-visible mt-1 block min-h-[var(--target-dashboard-recommended)] w-full rounded-[var(--radius-dashboard-input)] border border-[var(--reports-border)] bg-[var(--reports-panel)] px-3 text-sm" /></label></div> : null}</DashboardFilters><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-[var(--dashboard-muted)]" /></DashboardToolbar>
})
ReportsPeriodFilter.displayName = "ReportsPeriodFilter"

