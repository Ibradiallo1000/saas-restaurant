import * as React from "react"
import { SettingsForm } from "@/components/settings-ui"
import { cn } from "@/lib/utils"
import { PlatformTable, type PlatformTableProps } from "./platform-table"
import type { PlatformMonitoringState } from "./platform-foundations"

export const PlatformMediaLibrary = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)} {...props} />)
PlatformMediaLibrary.displayName = "PlatformMediaLibrary"
export interface PlatformMediaCardProps extends React.HTMLAttributes<HTMLElement> { preview: React.ReactNode; name: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode }
export const PlatformMediaCard = React.forwardRef<HTMLElement, PlatformMediaCardProps>(({ actions, className, meta, name, preview, ...props }, ref) => <article ref={ref} className={cn("overflow-hidden rounded-[var(--radius-dashboard-card)] border border-[var(--platform-border)] bg-[var(--platform-panel)]", className)} {...props}><div className="aspect-square bg-[var(--platform-muted)]">{preview}</div><div className="p-3"><h3 className="truncate text-sm font-semibold">{name}</h3>{meta ? <div className="mt-1 text-xs text-[var(--dashboard-muted)]">{meta}</div> : null}{actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}</div></article>)
PlatformMediaCard.displayName = "PlatformMediaCard"
export const PlatformSettingsForm = SettingsForm
export function PlatformUserTable<Row>(props: PlatformTableProps<Row>) { return <PlatformTable {...props} /> }
export function PlatformSupportTable<Row>(props: PlatformTableProps<Row>) { return <PlatformTable {...props} /> }
export function PlatformAuditLog<Row>(props: PlatformTableProps<Row>) { return <PlatformTable {...props} /> }

const monitoringLabels: Record<PlatformMonitoringState, string> = { healthy: "Opérationnel", degraded: "Dégradé", incident: "Incident", unknown: "Inconnu" }
export interface PlatformMonitoringPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; state: PlatformMonitoringState; description?: React.ReactNode; details?: React.ReactNode }
export const PlatformMonitoringPanel = React.forwardRef<HTMLElement, PlatformMonitoringPanelProps>(({ className, description, details, state, title, ...props }, ref) => <article ref={ref} data-family="monitoring" data-state={state} className={cn("rounded-[var(--radius-dashboard-widget)] border border-[var(--platform-state-border)] bg-[var(--platform-state-bg)] p-4", className)} {...props}><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><span className="text-sm font-semibold text-[var(--platform-state-fg)]">{monitoringLabels[state]}</span></div>{description ? <p className="mt-2 text-sm text-[var(--dashboard-muted)]">{description}</p> : null}{details ? <div className="mt-3">{details}</div> : null}</article>)
PlatformMonitoringPanel.displayName = "PlatformMonitoringPanel"

