import * as React from "react"
import { cn } from "@/lib/utils"
import { semanticBeforeAccentClasses, semanticSurfaceClasses, type DashboardSemanticVariant } from "./semantic-variants"

export interface DashboardChartProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  description: string
  table?: React.ReactNode
  tableLabel?: string
}
export const DashboardChart = React.forwardRef<HTMLDivElement, DashboardChartProps>(({ children, className, description, label, table, tableLabel = "Afficher les données du graphique", ...props }, ref) => <div ref={ref} role="img" aria-label={`${label}. ${description}`} className={cn("min-h-64 w-full rounded-[var(--radius-dashboard-chart)] text-xs text-[var(--dashboard-muted)] [&_.recharts-surface]:outline-none", className)} {...props}>{children}{table ? <details className="mt-3 text-sm"><summary className="min-h-10 cursor-pointer py-2 font-semibold text-[var(--dashboard-subtitle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">{tableLabel}</summary><div role="group" aria-label={`Données : ${label}`} className="mt-2">{table}</div></details> : null}</div>)
DashboardChart.displayName = "DashboardChart"

export interface DashboardChartCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; description?: React.ReactNode; legend?: React.ReactNode; action?: React.ReactNode; variant?: DashboardSemanticVariant }
export const DashboardChartCard = React.forwardRef<HTMLElement, DashboardChartCardProps>(({ action, children, className, description, legend, title, variant = "neutral", ...props }, ref) => <article ref={ref} data-variant={variant} className={cn("relative overflow-hidden rounded-[var(--radius-dashboard-widget)] border shadow-[var(--shadow-dashboard-surface)] before:absolute before:inset-x-0 before:top-0 before:h-0.5", semanticSurfaceClasses[variant], semanticBeforeAccentClasses[variant], className)} {...props}><header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dashboard-divider)] px-4 py-3"><div><h2 className="text-sm font-semibold text-[var(--dashboard-title)]">{title}</h2>{description ? <p className="mt-0.5 text-xs text-[var(--dashboard-muted)]">{description}</p> : null}</div>{action}</header>{legend ? <div className="px-4 pt-3">{legend}</div> : null}<div className="p-4">{children}</div></article>)
DashboardChartCard.displayName = "DashboardChartCard"
