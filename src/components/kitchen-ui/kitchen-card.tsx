import * as React from "react"

import { cn } from "@/lib/utils"
import type { KitchenDensity, KitchenDestinationPresentation, KitchenItemPresentation, KitchenPriority, KitchenStatusPresentation, KitchenTimerPresentation } from "./kitchen-foundations"
import { KitchenItemsList } from "./kitchen-item"
import { KitchenDestinationBadge, KitchenStatusBadge, KitchenTimer } from "./kitchen-status"

const priorityClasses: Record<KitchenPriority, string> = {
  normal: "",
  warning: "border-[var(--kitchen-priority-warning)]",
  overdue: "border-[var(--kitchen-priority-overdue)]",
  critical: "border-[var(--kitchen-priority-critical)]",
}

export interface KitchenOrderCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  reference: React.ReactNode
  context?: React.ReactNode
  status: KitchenStatusPresentation
  timer?: KitchenTimerPresentation
  destination?: KitchenDestinationPresentation
  priority?: KitchenPriority
  items: KitchenItemPresentation[]
  notes?: React.ReactNode
  actions?: React.ReactNode
  selected?: boolean
  disabled?: boolean
  loading?: boolean
  density?: KitchenDensity
  onOpen?: () => void
  headerExtra?: React.ReactNode
  footer?: React.ReactNode
}

export const KitchenOrderCard = React.forwardRef<HTMLElement, KitchenOrderCardProps>(({ actions, className, context, density = "comfortable", destination, disabled = false, footer, headerExtra, items, loading = false, notes, onOpen, priority = "normal", reference, selected = false, status, timer, ...props }, ref) => (
  <article ref={ref} aria-busy={loading || undefined} aria-disabled={disabled || undefined} className={cn("min-w-0 rounded-[var(--radius-kitchen-card)] border bg-[var(--kitchen-card)] p-[var(--kitchen-card-padding)] text-[var(--dashboard-title)] shadow-[var(--shadow-dashboard-surface)] transition-[border-color,background-color,box-shadow] [transition-duration:var(--motion-kitchen-state)] motion-reduce:transition-none", priorityClasses[priority], selected && "ring-2 ring-[var(--kitchen-focus)] ring-offset-2", disabled && "opacity-60", density === "wallDisplay" && "[--kitchen-card-padding:var(--kitchen-card-padding-wall)]", className)} {...props}>
    <header className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[length:var(--text-kitchen-reference)] font-black leading-[var(--leading-kitchen-reference)] tracking-tight tabular-nums">{reference}</div>
          {context ? <div className="mt-1 break-words text-[length:var(--text-kitchen-context)] font-semibold leading-[var(--leading-kitchen-context)] text-[var(--dashboard-subtitle)]">{context}</div> : null}
        </div>
        <KitchenStatusBadge {...status} size={density === "wallDisplay" ? "standard" : "compact"} />
      </div>
      {timer || destination || headerExtra ? <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">{timer ? <KitchenTimer {...timer} /> : <span />}{destination ? <KitchenDestinationBadge {...destination} size="compact" /> : null}{headerExtra}</div> : null}
    </header>
    <KitchenItemsList items={items} className="mt-3 border-y border-[var(--kitchen-divider)]" />
    {notes ? <div className="mt-3 space-y-2">{notes}</div> : null}
    {onOpen ? <button type="button" onClick={onOpen} disabled={disabled || loading} className="dashboard-focus-visible mt-3 min-h-11 w-full rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] px-3 text-sm font-semibold text-[var(--dashboard-subtitle)] hover:bg-[var(--kitchen-card-muted)] disabled:cursor-not-allowed">Ouvrir le détail de la commande <span className="sr-only">{reference}</span></button> : null}
    {actions ? <div className="mt-3">{actions}</div> : null}
    {footer ? <footer className="mt-3 border-t border-[var(--kitchen-divider)] pt-3">{footer}</footer> : null}
  </article>
))
KitchenOrderCard.displayName = "KitchenOrderCard"

export interface KitchenOrderCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> { density?: KitchenDensity }
export const KitchenOrderCardSkeleton = React.forwardRef<HTMLDivElement, KitchenOrderCardSkeletonProps>(({ className, density = "comfortable", ...props }, ref) => (
  <div ref={ref} aria-hidden="true" className={cn("rounded-[var(--radius-kitchen-card)] border border-[var(--kitchen-border)] bg-[var(--kitchen-card)] p-[var(--kitchen-card-padding)] shadow-[var(--shadow-dashboard-surface)]", density === "wallDisplay" && "[--kitchen-card-padding:var(--kitchen-card-padding-wall)]", className)} {...props}>
    <div className="flex justify-between gap-3"><div className="h-7 w-28 animate-pulse rounded bg-[var(--kitchen-card-muted)] motion-reduce:animate-none" /><div className="h-8 w-24 animate-pulse rounded-full bg-[var(--kitchen-card-muted)] motion-reduce:animate-none" /></div>
    <div className="mt-3 h-6 w-20 animate-pulse rounded bg-[var(--kitchen-card-muted)] motion-reduce:animate-none" />
    <div className="mt-4 space-y-3 border-y border-[var(--kitchen-divider)] py-3">{[0, 1, 2].map((item) => <div key={item} className="flex gap-3"><div className="h-7 w-10 animate-pulse rounded bg-[var(--kitchen-card-muted)] motion-reduce:animate-none" /><div className="h-7 flex-1 animate-pulse rounded bg-[var(--kitchen-card-muted)] motion-reduce:animate-none" /></div>)}</div>
    <div className="mt-3 h-12 w-full animate-pulse rounded-[var(--radius-dashboard-button)] bg-[var(--kitchen-card-muted)] motion-reduce:animate-none" />
  </div>
))
KitchenOrderCardSkeleton.displayName = "KitchenOrderCardSkeleton"
