import * as React from "react"
import { cn } from "@/lib/utils"
import { PlatformTable, type PlatformTableProps } from "./platform-table"
import type { PlatformProvisioningState, PlatformRestaurantState } from "./platform-foundations"

const restaurantLabels: Record<PlatformRestaurantState, string> = { active: "Actif", inactive: "Inactif", suspended: "Suspendu", provisioning: "Provisionnement", error: "Erreur", unknown: "Inconnu" }
const provisioningLabels: Record<PlatformProvisioningState, string> = { pending: "En attente", provisioning: "En cours", ready: "Prêt", failed: "Échec", unknown: "Inconnu" }

export interface PlatformStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> { state: string; label: React.ReactNode; family: "restaurant" | "subscription" | "monitoring" }
export const PlatformStatusBadge = React.forwardRef<HTMLSpanElement, PlatformStatusBadgeProps>(({ className, family, label, state, ...props }, ref) => <span ref={ref} data-family={family} data-state={state} className={cn("inline-flex min-h-6 items-center rounded-full border border-[var(--platform-state-border)] bg-[var(--platform-state-bg)] px-2 py-1 text-xs font-semibold text-[var(--platform-state-fg)]", className)} {...props}>{label}</span>)
PlatformStatusBadge.displayName = "PlatformStatusBadge"

export interface PlatformRestaurantCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; subtitle?: React.ReactNode; state: PlatformRestaurantState; meta?: React.ReactNode; actions?: React.ReactNode }
export const PlatformRestaurantCard = React.forwardRef<HTMLElement, PlatformRestaurantCardProps>(({ actions, className, meta, state, subtitle, title, ...props }, ref) => <article ref={ref} className={cn("rounded-[var(--radius-dashboard-card)] border border-[var(--platform-border)] bg-[var(--platform-panel)] p-4", className)} {...props}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-[var(--dashboard-title)]">{title}</h3>{subtitle ? <p className="mt-1 text-sm text-[var(--dashboard-muted)]">{subtitle}</p> : null}</div><PlatformStatusBadge family="restaurant" state={state} label={restaurantLabels[state]} /></div>{meta ? <div className="mt-3 text-sm text-[var(--dashboard-subtitle)]">{meta}</div> : null}{actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}</article>)
PlatformRestaurantCard.displayName = "PlatformRestaurantCard"

export const PlatformRestaurantDetail = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => <section ref={ref} className={cn("rounded-[var(--radius-dashboard-widget)] border border-[var(--platform-border)] bg-[var(--platform-panel)] p-4", className)} {...props} />)
PlatformRestaurantDetail.displayName = "PlatformRestaurantDetail"

export function PlatformRestaurantTable<Row>(props: PlatformTableProps<Row>) { return <PlatformTable {...props} /> }

export interface PlatformProvisioningStatusProps extends React.HTMLAttributes<HTMLDivElement> { state: PlatformProvisioningState; description?: React.ReactNode }
export const PlatformProvisioningStatus = React.forwardRef<HTMLDivElement, PlatformProvisioningStatusProps>(({ className, description, state, ...props }, ref) => <div ref={ref} role="status" className={cn("rounded-[var(--radius-dashboard-widget)] border border-[var(--platform-border)] bg-[var(--platform-muted)] p-3", className)} {...props}><p className="text-sm font-semibold">{provisioningLabels[state]}</p>{description ? <p className="mt-1 text-sm text-[var(--dashboard-muted)]">{description}</p> : null}</div>)
PlatformProvisioningStatus.displayName = "PlatformProvisioningStatus"
