import * as React from "react"

import { cn } from "@/lib/utils"
import type { KitchenDestinationDisplay, KitchenDisplayStatus, KitchenTimerVariant } from "./kitchen-foundations"

const statusClasses: Record<KitchenDisplayStatus, string> = {
  pending: "bg-[var(--kitchen-status-pending-bg)] text-[var(--kitchen-status-pending-fg)]",
  preparing: "bg-[var(--kitchen-status-preparing-bg)] text-[var(--kitchen-status-preparing-fg)]",
  ready: "bg-[var(--kitchen-status-ready-bg)] text-[var(--kitchen-status-ready-fg)]",
  served: "bg-[var(--kitchen-status-served-bg)] text-[var(--kitchen-status-served-fg)]",
  completed: "bg-[var(--kitchen-status-completed-bg)] text-[var(--kitchen-status-completed-fg)]",
  cancelled: "bg-[var(--kitchen-status-cancelled-bg)] text-[var(--kitchen-status-cancelled-fg)]",
  unknown: "bg-[var(--kitchen-status-neutral-bg)] text-[var(--kitchen-status-neutral-fg)]",
}

const destinationClasses: Record<KitchenDestinationDisplay, string> = {
  kitchen: "border-[var(--kitchen-destination-kitchen)] text-[var(--kitchen-destination-kitchen)]",
  bar: "border-[var(--kitchen-destination-bar)] text-[var(--kitchen-destination-bar)]",
  directService: "border-[var(--kitchen-destination-direct)] text-[var(--kitchen-destination-direct)]",
  mixed: "border-[var(--kitchen-destination-mixed)] text-[var(--kitchen-destination-mixed)]",
  unknown: "border-[var(--kitchen-border)] text-[var(--dashboard-muted)]",
}

type BadgeBaseProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  label: React.ReactNode
  icon?: React.ReactNode
  size?: "compact" | "standard"
}

const BadgeBase = React.forwardRef<HTMLSpanElement, BadgeBaseProps>(({ className, icon, label, size = "standard", ...props }, ref) => (
  <span ref={ref} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold leading-tight", size === "compact" ? "min-h-7 px-2.5 py-1 text-xs" : "min-h-9 px-3 py-1.5 text-sm", className)} {...props}>
    {icon ? <span aria-hidden="true" className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
    <span className="min-w-0 break-words">{label}</span>
  </span>
))
BadgeBase.displayName = "KitchenBadgeBase"

export interface KitchenStatusBadgeProps extends BadgeBaseProps { status: KitchenDisplayStatus }
export const KitchenStatusBadge = React.forwardRef<HTMLSpanElement, KitchenStatusBadgeProps>(({ className, status, ...props }, ref) => <BadgeBase ref={ref} className={cn(statusClasses[status], className)} {...props} />)
KitchenStatusBadge.displayName = "KitchenStatusBadge"

export interface KitchenDestinationBadgeProps extends BadgeBaseProps { destination: KitchenDestinationDisplay }
export const KitchenDestinationBadge = React.forwardRef<HTMLSpanElement, KitchenDestinationBadgeProps>(({ className, destination, ...props }, ref) => <BadgeBase ref={ref} className={cn("border bg-[var(--kitchen-card)]", destinationClasses[destination], className)} {...props} />)
KitchenDestinationBadge.displayName = "KitchenDestinationBadge"

const timerClasses: Record<KitchenTimerVariant, string> = {
  normal: "text-[var(--dashboard-subtitle)]",
  warning: "text-[var(--kitchen-priority-warning)]",
  overdue: "text-[var(--kitchen-priority-overdue)]",
  critical: "text-[var(--kitchen-priority-critical)]",
}

export interface KitchenTimerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  label: React.ReactNode
  value: React.ReactNode
  variant?: KitchenTimerVariant
  icon?: React.ReactNode
  ariaLabel?: string
}

export const KitchenTimer = React.forwardRef<HTMLSpanElement, KitchenTimerProps>(({ ariaLabel, className, icon, label, value, variant = "normal", ...props }, ref) => (
  <span ref={ref} aria-label={ariaLabel} className={cn("inline-flex min-h-8 flex-wrap items-center gap-1.5 text-[length:var(--text-kitchen-timer)] font-bold leading-[var(--leading-kitchen-timer)] tabular-nums", timerClasses[variant], className)} {...props}>
    {icon ? <span aria-hidden="true" className="shrink-0 [&_svg]:size-5">{icon}</span> : null}
    <span className="font-medium">{label}</span>
    <span>{value}</span>
  </span>
))
KitchenTimer.displayName = "KitchenTimer"

