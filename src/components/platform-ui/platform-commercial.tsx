import * as React from "react"
import { cn } from "@/lib/utils"
import { PlatformStatusBadge } from "./platform-restaurants"
import { PlatformTable, type PlatformTableProps } from "./platform-table"
import type { PlatformSubscriptionState } from "./platform-foundations"

const subscriptionLabels: Record<PlatformSubscriptionState, string> = { trial: "Essai", active: "Actif", pastDue: "Impayé", expired: "Expiré", cancelled: "Annulé", suspended: "Suspendu", unknown: "Inconnu" }
export interface PlatformPlanCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; price?: React.ReactNode; description?: React.ReactNode; features?: React.ReactNode; action?: React.ReactNode; featured?: boolean }
export const PlatformPlanCard = React.forwardRef<HTMLElement, PlatformPlanCardProps>(({ action, className, description, featured, features, price, title, ...props }, ref) => <article ref={ref} className={cn("rounded-[var(--radius-dashboard-card)] border bg-[var(--platform-panel)] p-4", featured ? "border-[var(--platform-focus)] shadow-[var(--shadow-dashboard-floating)]" : "border-[var(--platform-border)]", className)} {...props}><h3 className="font-semibold">{title}</h3>{price ? <div className="mt-2 text-2xl font-bold tabular-nums">{price}</div> : null}{description ? <p className="mt-2 text-sm text-[var(--dashboard-muted)]">{description}</p> : null}{features ? <div className="mt-4">{features}</div> : null}{action ? <div className="mt-4">{action}</div> : null}</article>)
PlatformPlanCard.displayName = "PlatformPlanCard"
export const PlatformPlanGrid = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("grid gap-[var(--dashboard-grid-gap)] md:grid-cols-2 xl:grid-cols-3", className)} {...props} />)
PlatformPlanGrid.displayName = "PlatformPlanGrid"
export interface PlatformSubscriptionStatusProps extends React.HTMLAttributes<HTMLSpanElement> { state: PlatformSubscriptionState; label?: React.ReactNode }
export const PlatformSubscriptionStatus = React.forwardRef<HTMLSpanElement, PlatformSubscriptionStatusProps>(({ label, state, ...props }, ref) => <PlatformStatusBadge ref={ref} family="subscription" state={state} label={label ?? subscriptionLabels[state]} {...props} />)
PlatformSubscriptionStatus.displayName = "PlatformSubscriptionStatus"
export function PlatformSubscriptionTable<Row>(props: PlatformTableProps<Row>) { return <PlatformTable {...props} /> }
export function PlatformBillingTable<Row>(props: PlatformTableProps<Row>) { return <PlatformTable {...props} /> }
export const PlatformBillingSummary = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => <section ref={ref} className={cn("grid gap-3 rounded-[var(--radius-dashboard-widget)] border border-[var(--platform-border)] bg-[var(--platform-panel)] p-4 sm:grid-cols-2 xl:grid-cols-4", className)} {...props} />)
PlatformBillingSummary.displayName = "PlatformBillingSummary"

