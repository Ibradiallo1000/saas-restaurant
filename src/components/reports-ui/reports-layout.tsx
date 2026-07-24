"use client"

import * as React from "react"
import { DashboardHeader, DashboardPage, type DashboardHeaderProps, type DashboardPageProps } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { ReportScopeOption } from "./reports-foundations"

export const ReportsPage = React.forwardRef<HTMLElement, DashboardPageProps>(({ className, ...props }, ref) => (
  <DashboardPage ref={ref} className={cn("reports-reduced-motion bg-[var(--reports-canvas)]", className)} {...props} />
))
ReportsPage.displayName = "ReportsPage"

export interface ReportsHeaderProps extends DashboardHeaderProps { context?: React.ReactNode }
export const ReportsHeader = React.forwardRef<HTMLElement, ReportsHeaderProps>(({ className, context, meta, ...props }, ref) => (
  <DashboardHeader ref={ref} className={className} meta={<>{meta}{context ? <div className="mt-2 flex flex-wrap items-center gap-2">{context}</div> : null}</>} {...props} />
))
ReportsHeader.displayName = "ReportsHeader"

export interface ReportsScopeSelectorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  label: string
  options: ReportScopeOption[]
  value: string
  onValueChange: (value: string) => void
}
export const ReportsScopeSelector = React.forwardRef<HTMLDivElement, ReportsScopeSelectorProps>(({ className, label, onValueChange, options, value, ...props }, ref) => (
  <div ref={ref} role="group" aria-label={label} className={cn("flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-dashboard-button)] bg-[var(--reports-muted)] p-1", className)} {...props}>
    {options.map((option) => <button key={option.id} type="button" disabled={option.disabled} aria-pressed={option.id === value} title={option.description} onClick={() => onValueChange(option.id)} className={cn("dashboard-focus-visible min-h-[var(--target-dashboard-min)] shrink-0 rounded-[var(--radius-dashboard-button)] px-3 text-sm font-semibold text-[var(--dashboard-subtitle)] disabled:opacity-50", option.id === value && "bg-[var(--reports-panel)] text-[var(--dashboard-title)] shadow-[var(--shadow-dashboard-surface)]")}>{option.label}</button>)}
  </div>
))
ReportsScopeSelector.displayName = "ReportsScopeSelector"

