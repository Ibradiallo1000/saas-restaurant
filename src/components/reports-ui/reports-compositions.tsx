"use client"

import * as React from "react"
import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { PosSessionReport, type PosSessionReportProps } from "@/components/pos-ui"
import { cn } from "@/lib/utils"

export const ReportsSessionSummary = React.forwardRef<HTMLElement, PosSessionReportProps>((props, ref) => <PosSessionReport ref={ref} {...props} />)
ReportsSessionSummary.displayName = "ReportsSessionSummary"

export interface ReportsDomainSummaryProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; headingAs?: "h2" | "h3" }
const ReportsDomainSummary = React.forwardRef<HTMLElement, ReportsDomainSummaryProps>(({ actions, children, className, description, headingAs, title, ...props }, ref) => <DashboardWidget ref={ref} className={className} {...props}><DashboardWidgetHeader title={title} description={description} action={actions} headingAs={headingAs} /><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div></DashboardWidget>)
ReportsDomainSummary.displayName = "ReportsDomainSummary"
export const ReportsStockSummary = React.forwardRef<HTMLElement, ReportsDomainSummaryProps>(({ className, ...props }, ref) => <ReportsDomainSummary ref={ref} className={cn("bg-[var(--reports-panel)]", className)} {...props} />)
ReportsStockSummary.displayName = "ReportsStockSummary"
export const ReportsProductSummary = React.forwardRef<HTMLElement, ReportsDomainSummaryProps>(({ className, ...props }, ref) => <ReportsDomainSummary ref={ref} className={cn("bg-[var(--reports-panel)]", className)} {...props} />)
ReportsProductSummary.displayName = "ReportsProductSummary"
export const ReportsPaymentSummary = React.forwardRef<HTMLElement, ReportsDomainSummaryProps>(({ className, ...props }, ref) => <ReportsDomainSummary ref={ref} className={cn("bg-[var(--reports-panel)]", className)} {...props} />)
ReportsPaymentSummary.displayName = "ReportsPaymentSummary"
