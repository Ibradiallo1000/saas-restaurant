"use client"

import * as React from "react"
import { DashboardChart, DashboardChartCard, type DashboardChartCardProps } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { ReportChartType, ReportSeriesPresentation } from "./reports-foundations"

export interface ReportsChartLegendProps extends React.HTMLAttributes<HTMLUListElement> { items: ReportSeriesPresentation[]; label?: string }
export const ReportsChartLegend = React.forwardRef<HTMLUListElement, ReportsChartLegendProps>(({ className, items, label = "Légende du graphique", ...props }, ref) => <ul ref={ref} aria-label={label} className={cn("flex flex-wrap gap-x-4 gap-y-2 text-xs", className)} {...props}>{items.map((item) => <li key={item.id} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} /><span className="text-[var(--dashboard-subtitle)]">{item.label}</span>{item.value ? <span className="font-semibold tabular-nums text-[var(--dashboard-value)]">{item.value}</span> : null}</li>)}</ul>)
ReportsChartLegend.displayName = "ReportsChartLegend"

export interface ReportsChartSummaryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> { title?: React.ReactNode }
export const ReportsChartSummary = React.forwardRef<HTMLDivElement, ReportsChartSummaryProps>(({ children, className, title = "Résumé du graphique", ...props }, ref) => <div ref={ref} className={cn("rounded-[var(--radius-dashboard-chart)] bg-[var(--reports-muted)] p-3 text-sm text-[var(--dashboard-subtitle)]", className)} {...props}><h3 className="font-semibold text-[var(--dashboard-title)]">{title}</h3><div className="mt-1">{children}</div></div>)
ReportsChartSummary.displayName = "ReportsChartSummary"

export interface ReportsChartCardProps extends DashboardChartCardProps { chartLabel: string; chartDescription: string; chartType?: ReportChartType; chart: React.ReactNode; table?: React.ReactNode; summary?: React.ReactNode; state?: React.ReactNode }
export const ReportsChartCard = React.forwardRef<HTMLElement, ReportsChartCardProps>(({ chart, chartDescription, chartLabel, chartType = "other", className, state, summary, table, ...props }, ref) => <DashboardChartCard ref={ref} data-chart-type={chartType} className={cn("bg-[var(--reports-chart)]", className)} {...props}>{state ?? <><DashboardChart label={chartLabel} description={chartDescription} table={table}>{chart}</DashboardChart>{summary ? <div className="mt-3">{summary}</div> : null}</>}</DashboardChartCard>)
ReportsChartCard.displayName = "ReportsChartCard"
