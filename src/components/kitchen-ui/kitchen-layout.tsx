import * as React from "react"

import { cn } from "@/lib/utils"
import type { KitchenConnectionDisplayState, KitchenLoadMetric } from "./kitchen-foundations"

export interface KitchenPageProps extends React.HTMLAttributes<HTMLElement> {
  header?: React.ReactNode
  fullScreen?: boolean
  withGutters?: boolean
}

export const KitchenPage = React.forwardRef<HTMLElement, KitchenPageProps>(
  ({ children, className, fullScreen = false, header, withGutters = true, ...props }, ref) => (
    <main
      ref={ref}
      className={cn(
        "dashboard-reduced-motion flex min-h-[100dvh] w-full min-w-0 flex-col overflow-x-hidden bg-[var(--kitchen-canvas)] font-[var(--font-dashboard)] text-[var(--dashboard-title)]",
        fullScreen && "h-[100dvh] overflow-hidden",
        className
      )}
      data-kitchen-fullscreen={fullScreen || undefined}
      {...props}
    >
      {header}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1",
          withGutters && "pb-[calc(var(--kitchen-gutter-y)_+_var(--safe-bottom,0px))] pl-[calc(var(--kitchen-gutter-x)_+_var(--safe-left,0px))] pr-[calc(var(--kitchen-gutter-x)_+_var(--safe-right,0px))] pt-[var(--kitchen-gutter-y)]",
          fullScreen && "overflow-hidden"
        )}
      >
        {children}
      </div>
    </main>
  )
)
KitchenPage.displayName = "KitchenPage"

export interface KitchenHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  load?: React.ReactNode
  connection?: React.ReactNode
  lastSync?: React.ReactNode
  actions?: React.ReactNode
  fullScreenAction?: React.ReactNode
  filters?: React.ReactNode
  headingAs?: "h1" | "h2"
}

export const KitchenHeader = React.forwardRef<HTMLElement, KitchenHeaderProps>(
  ({ actions, className, connection, description, filters, fullScreenAction, headingAs: Heading = "h1", lastSync, load, title, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "shrink-0 border-b border-[var(--kitchen-divider)] bg-[var(--kitchen-card)] pb-3 pl-[calc(var(--kitchen-gutter-x)_+_var(--safe-left,0px))] pr-[calc(var(--kitchen-gutter-x)_+_var(--safe-right,0px))] pt-[calc(var(--safe-top,0px)_+_0.75rem)] shadow-[var(--shadow-dashboard-surface)]",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Heading className="break-words text-[length:var(--text-kitchen-page-title)] font-bold leading-[var(--leading-kitchen-page-title)] tracking-tight text-[var(--dashboard-title)]">{title}</Heading>
          {description ? <p className="mt-1 max-w-3xl break-words text-sm leading-5 text-[var(--dashboard-subtitle)]">{description}</p> : null}
          {connection || lastSync ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-kitchen-caption)] leading-[var(--leading-kitchen-caption)] text-[var(--dashboard-muted)]">{connection}{lastSync}</div> : null}
        </div>
        {load || actions || fullScreenAction ? <div className="flex min-w-0 flex-wrap items-center gap-2 [&_button]:min-h-11 [&_button]:min-w-11 lg:justify-end">{load}{actions}{fullScreenAction}</div> : null}
      </div>
      {filters ? <div className="mt-3 min-w-0">{filters}</div> : null}
    </header>
  )
)
KitchenHeader.displayName = "KitchenHeader"

const loadToneClasses: Record<NonNullable<KitchenLoadMetric["tone"]>, string> = {
  normal: "text-[var(--dashboard-subtitle)]",
  warning: "text-[var(--kitchen-priority-warning)]",
  overdue: "text-[var(--kitchen-priority-overdue)]",
  critical: "text-[var(--kitchen-priority-critical)]",
  ready: "text-[var(--kitchen-status-ready-fg)]",
}

export interface KitchenLoadSummaryProps extends React.HTMLAttributes<HTMLDListElement> {
  items: KitchenLoadMetric[]
  label?: string
}

export const KitchenLoadSummary = React.forwardRef<HTMLDListElement, KitchenLoadSummaryProps>(
  ({ className, items, label = "Charge cuisine", ...props }, ref) => (
    <dl ref={ref} aria-label={label} className={cn("flex max-w-full flex-wrap items-center gap-1.5", className)} {...props}>
      {items.map((item) => (
        <div key={item.id} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-dashboard-button)] border border-[var(--kitchen-border)] bg-[var(--kitchen-card-muted)] px-3">
          <dt className="text-xs font-medium text-[var(--dashboard-muted)]">{item.label}</dt>
          <dd className={cn("text-base font-bold tabular-nums", item.tone ? loadToneClasses[item.tone] : "text-[var(--dashboard-value)]")}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
)
KitchenLoadSummary.displayName = "KitchenLoadSummary"

export const KITCHEN_CONNECTION_LABELS: Record<KitchenConnectionDisplayState, string> = {
  connected: "Connecté",
  reconnecting: "Reconnexion",
  disconnected: "Déconnecté",
  unknown: "Connexion inconnue",
}
