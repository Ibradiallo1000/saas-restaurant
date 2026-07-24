import * as React from "react"
import { AlertCircle, Inbox, Loader2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

const alertTones = { neutral: "border-[var(--dashboard-border)] text-[var(--dashboard-subtitle)]", warning: "border-[color:color-mix(in_srgb,var(--data-warning)_35%,var(--dashboard-border))] text-[var(--data-warning)]", negative: "border-[color:color-mix(in_srgb,var(--data-negative)_35%,var(--dashboard-border))] text-[var(--data-negative)]", info: "border-[color:color-mix(in_srgb,var(--data-info)_35%,var(--dashboard-border))] text-[var(--data-info)]" } as const
export type DashboardAlertTone = keyof typeof alertTones

export interface DashboardAlertProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; tone?: DashboardAlertTone; announce?: boolean }
export const DashboardAlert = React.forwardRef<HTMLElement, DashboardAlertProps>(({ action, announce = false, className, description, icon, title, tone = "neutral", ...props }, ref) => <article ref={ref} role={announce ? "alert" : undefined} className={cn("flex items-start gap-3 rounded-[var(--radius-dashboard-widget)] border bg-[var(--dashboard-surface)] p-3", alertTones[tone], className)} {...props}><span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-5">{icon ?? <TriangleAlert />}</span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[var(--dashboard-title)]">{title}</h3>{description ? <p className="mt-0.5 text-sm leading-5 text-[var(--dashboard-muted)]">{description}</p> : null}</div>{action}</article>)
DashboardAlert.displayName = "DashboardAlert"

export const DashboardAlertList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("grid gap-2", className)} {...props} />)
DashboardAlertList.displayName = "DashboardAlertList"

type StateProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }
const StateShell = React.forwardRef<HTMLDivElement, StateProps>(({ action, className, description, icon, title, ...props }, ref) => <div ref={ref} className={cn("flex min-h-40 flex-col items-center justify-center rounded-[var(--radius-dashboard-widget)] border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-6 text-center", className)} {...props}><span aria-hidden="true" className="mb-3 text-[var(--dashboard-muted)] [&_svg]:size-6">{icon}</span><h3 className="text-sm font-semibold text-[var(--dashboard-title)]">{title}</h3>{description ? <p className="mt-1 max-w-md text-sm leading-5 text-[var(--dashboard-muted)]">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>)
StateShell.displayName = "DashboardStateShell"

export const DashboardEmptyState = React.forwardRef<HTMLDivElement, StateProps>((props, ref) => <StateShell ref={ref} icon={<Inbox />} {...props} />)
DashboardEmptyState.displayName = "DashboardEmptyState"
export const DashboardErrorState = React.forwardRef<HTMLDivElement, StateProps>((props, ref) => <StateShell ref={ref} role="alert" icon={<AlertCircle />} {...props} />)
DashboardErrorState.displayName = "DashboardErrorState"

export interface DashboardLoadingStateProps extends React.HTMLAttributes<HTMLDivElement> { label?: string; compact?: boolean }
export const DashboardLoadingState = React.forwardRef<HTMLDivElement, DashboardLoadingStateProps>(({ className, compact = false, label = "Chargement des données", ...props }, ref) => <div ref={ref} role="status" aria-live="polite" className={cn("flex items-center justify-center gap-2 rounded-[var(--radius-dashboard-widget)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] text-sm text-[var(--dashboard-muted)]", compact ? "min-h-12 p-3" : "min-h-40 p-6", className)} {...props}><Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /><span>{label}</span></div>)
DashboardLoadingState.displayName = "DashboardLoadingState"
