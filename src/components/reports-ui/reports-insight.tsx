"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { ReportInsightPresentation, ReportInsightSeverity } from "./reports-foundations"

const tones: Record<ReportInsightSeverity, string> = { info: "text-[var(--data-info)]", positive: "text-[var(--data-positive)]", warning: "text-[var(--data-warning)]", critical: "text-[var(--data-negative)]" }
const icons = { info: Info, positive: CircleCheck, warning: TriangleAlert, critical: CircleAlert }
export interface ReportsInsightListProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title?: React.ReactNode; description?: React.ReactNode; items: ReportInsightPresentation[]; headingAs?: "h2" | "h3" }
export const ReportsInsightList = React.forwardRef<HTMLElement, ReportsInsightListProps>(({ className, description, headingAs, items, title = "Points clés", ...props }, ref) => <DashboardWidget ref={ref} className={className} {...props}><DashboardWidgetHeader title={title} description={description} headingAs={headingAs} /><ul className="divide-y divide-[var(--reports-divider)]">{items.map((item) => { const severity = item.severity ?? "info"; const Icon = icons[severity]; return <li key={item.id} className="flex gap-3 p-4"><Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", tones[severity])} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold text-[var(--dashboard-title)]">{item.title}</h3>{item.value ? <span className="font-semibold tabular-nums text-[var(--dashboard-value)]">{item.value}</span> : null}</div>{item.description ? <p className="mt-1 text-sm text-[var(--dashboard-muted)]">{item.description}</p> : null}{item.action ? <div className="mt-2">{item.action}</div> : null}</div></li>})}</ul></DashboardWidget>)
ReportsInsightList.displayName = "ReportsInsightList"
