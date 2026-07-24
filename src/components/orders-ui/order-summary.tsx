import * as React from "react"
import { MetricCard, MetricGroup, type DashboardDataTone } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"

export interface OrderSummaryMetric { id: string; label: React.ReactNode; value: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode; tone?: DashboardDataTone; action?: React.ReactNode }
export interface OrderSummaryMetricsProps extends React.HTMLAttributes<HTMLDivElement> { items: OrderSummaryMetric[] }
const metricToneClasses: Record<DashboardDataTone, string> = { positive: "border-[var(--data-positive)]", negative: "border-[var(--data-negative)]", neutral: "border-[var(--data-neutral)]", warning: "border-[var(--data-warning)]", info: "border-[var(--data-info)]" }
export const OrderSummaryMetrics = React.forwardRef<HTMLDivElement, OrderSummaryMetricsProps>(({ className, items, ...props }, ref) => <MetricGroup ref={ref} className={cn("xl:grid-cols-4", className)} {...props}>{items.map((item) => <MetricCard key={item.id} label={item.label} value={item.value} description={item.description} icon={item.icon} action={item.action} className={item.tone ? metricToneClasses[item.tone] : undefined} />)}</MetricGroup>)
OrderSummaryMetrics.displayName = "OrderSummaryMetrics"
