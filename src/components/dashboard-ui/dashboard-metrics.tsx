import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { semanticHoverClasses, semanticIconClasses, semanticSurfaceClasses, type DashboardSemanticVariant } from "./semantic-variants"

const toneClasses = { positive: "text-[var(--data-positive)]", negative: "text-[var(--data-negative)]", neutral: "text-[var(--data-neutral)]", warning: "text-[var(--data-warning)]", info: "text-[var(--data-info)]" } as const
export type DashboardDataTone = keyof typeof toneClasses

export interface MetricDeltaProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: DashboardDataTone
  direction?: "up" | "down" | "flat"
  value: React.ReactNode
  context?: React.ReactNode
}
export const MetricDelta = React.forwardRef<HTMLSpanElement, MetricDeltaProps>(({ className, context, direction = "flat", tone = "neutral", value, ...props }, ref) => {
  const symbol = direction === "up" ? "↑" : direction === "down" ? "↓" : "→"
  return <span ref={ref} className={cn("inline-flex flex-wrap items-center gap-1 text-xs font-semibold tabular-nums", toneClasses[tone], className)} {...props}><span aria-hidden="true">{symbol}</span><span>{value}</span>{context ? <span className="font-normal text-[var(--dashboard-muted)]">{context}</span> : null}</span>
})
MetricDelta.displayName = "MetricDelta"

const metricCardVariants = cva("h-full min-w-0 overflow-hidden rounded-[var(--radius-dashboard-card)] border border-[var(--metric-border)] bg-[var(--metric-background)] shadow-[var(--shadow-dashboard-surface)] transition-[background-color,border-color,box-shadow] [transition-duration:var(--motion-dashboard-hover)] motion-reduce:transition-none", { variants: { emphasis: { default: "", strong: "border-[var(--dashboard-border)] shadow-[var(--shadow-dashboard-floating)]", subtle: "bg-[var(--dashboard-section)] shadow-none" }, interactive: { true: "hover:bg-[var(--metric-hover)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2" }, density: { compact: "p-2.5", dense: "p-3", default: "p-4", comfortable: "p-5" } }, defaultVariants: { emphasis: "default", interactive: false, density: "dense" } })

export interface MetricCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title">, VariantProps<typeof metricCardVariants> {
  variant?: DashboardSemanticVariant
  label: React.ReactNode
  value: React.ReactNode
  unit?: React.ReactNode
  description?: React.ReactNode
  delta?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  as?: "article" | "div"
}
export const MetricCard = React.forwardRef<HTMLElement, MetricCardProps>(({ action, as: Component = "article", className, delta, density, description, emphasis, icon, interactive, label, unit, value, variant = "neutral", ...props }, ref) => (
  <Component ref={ref as React.Ref<never>} className={cn(metricCardVariants({ emphasis, interactive, density }), semanticSurfaceClasses[variant], interactive && semanticHoverClasses[variant], className)} data-variant={variant} {...props}>
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2">{icon ? <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", semanticIconClasses[variant])}>{icon}</span> : null}<p className={cn("min-w-0 break-words text-[length:var(--text-dashboard-label)] font-semibold uppercase leading-[var(--leading-dashboard-label)] tracking-wide text-[var(--dashboard-label)]", !icon && "col-span-2")}>{label}</p></div>
    <div className="mt-3 flex min-w-0 max-w-full items-baseline gap-1 overflow-hidden whitespace-nowrap"><span className={cn("min-w-0 font-bold leading-[var(--leading-dashboard-metric)] tracking-tight text-[var(--dashboard-value)] tabular-nums", density === "compact" ? "text-base min-[360px]:text-lg min-[390px]:text-xl sm:text-[length:var(--text-dashboard-metric)]" : "text-lg min-[390px]:text-xl sm:text-[length:var(--text-dashboard-metric)]")}>{value}</span>{unit ? <span className="shrink-0 text-xs font-medium text-[var(--dashboard-muted)] sm:text-sm">{unit}</span> : null}</div>
    {delta ? <div className="mt-2">{delta}</div> : null}{description ? <p className="mt-2 text-[length:var(--text-dashboard-caption)] leading-[var(--leading-dashboard-caption)] text-[var(--dashboard-muted)]">{description}</p> : null}{action ? <div className="mt-3">{action}</div> : null}
  </Component>
))
MetricCard.displayName = "MetricCard"

export interface MetricGroupProps extends React.HTMLAttributes<HTMLDivElement> { density?: "compact" | "dense" | "default"; maxColumns?: 4 | 5 | 6 }
export const MetricGroup = React.forwardRef<HTMLDivElement, MetricGroupProps>(({ className, density = "dense", maxColumns = 6, ...props }, ref) => <div ref={ref} className={cn("grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))]", density === "compact" ? "gap-2" : density === "dense" ? "gap-2.5" : "gap-3 md:gap-4", "md:grid-cols-3 lg:grid-cols-4", maxColumns >= 5 && "xl:grid-cols-5", maxColumns === 6 && "2xl:grid-cols-6", className)} {...props} />)
MetricGroup.displayName = "MetricGroup"

export interface DashboardStatProps extends React.HTMLAttributes<HTMLDivElement> { label: React.ReactNode; value: React.ReactNode; tone?: DashboardDataTone }
export const DashboardStat = React.forwardRef<HTMLDivElement, DashboardStatProps>(({ className, label, tone = "neutral", value, ...props }, ref) => <div ref={ref} className={cn("min-w-0 overflow-hidden", className)} {...props}><dt className="break-words text-xs font-medium text-[var(--dashboard-label)]">{label}</dt><dd className={cn("mt-1 max-w-full overflow-hidden whitespace-nowrap text-lg font-semibold tabular-nums", toneClasses[tone])}>{value}</dd></div>)
DashboardStat.displayName = "DashboardStat"

export interface DashboardTrendProps extends React.HTMLAttributes<HTMLDivElement> { label: React.ReactNode; value: React.ReactNode; max?: number; current?: number; tone?: DashboardDataTone }
export const DashboardTrend = React.forwardRef<HTMLDivElement, DashboardTrendProps>(({ className, current = 0, label, max = 100, tone = "info", value, ...props }, ref) => { const percent = Math.max(0, Math.min(100, max > 0 ? current / max * 100 : 0)); return <div ref={ref} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1", className)} {...props}><span className="truncate text-sm text-[var(--dashboard-subtitle)]">{label}</span><span className="text-sm font-semibold tabular-nums text-[var(--dashboard-value)]">{value}</span><div className="col-span-2 h-2 overflow-hidden rounded-full bg-[var(--dashboard-section)]" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={current}><div className={cn("h-full rounded-full bg-current motion-reduce:transition-none", toneClasses[tone])} style={{ width: `${percent}%` }} /></div></div> })
DashboardTrend.displayName = "DashboardTrend"
