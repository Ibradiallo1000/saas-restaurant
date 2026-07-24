import * as React from "react"

import { cn } from "@/lib/utils"
import type { KitchenBoardLayout, KitchenColumnState } from "./kitchen-foundations"

const layoutClasses: Record<KitchenBoardLayout, string> = {
  stack: "grid-cols-1",
  columns: "grid-flow-col auto-cols-[minmax(var(--kitchen-column-min),var(--kitchen-column-comfortable))] overflow-x-auto",
  adaptive: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
}

export interface KitchenBoardProps extends React.HTMLAttributes<HTMLDivElement> { layout?: KitchenBoardLayout }
export const KitchenBoard = React.forwardRef<HTMLDivElement, KitchenBoardProps>(({ className, layout = "adaptive", ...props }, ref) => <div ref={ref} className={cn("grid min-h-0 min-w-0 gap-[var(--kitchen-column-gap)]", layoutClasses[layout], className)} {...props} />)
KitchenBoard.displayName = "KitchenBoard"

const columnVariantClasses: Record<KitchenColumnState, string> = {
  pending: "border-[var(--kitchen-status-pending-border)]",
  preparing: "border-[var(--kitchen-status-preparing-border)]",
  ready: "border-[var(--kitchen-status-ready-border)]",
  served: "border-[var(--kitchen-status-served-border)]",
  completed: "border-[var(--kitchen-status-completed-border)]",
  cancelled: "border-[var(--kitchen-status-cancelled-border)]",
  unknown: "border-[var(--kitchen-border)]",
  neutral: "border-[var(--kitchen-border)]",
}

export interface KitchenColumnProps extends Omit<React.HTMLAttributes<HTMLElement>, "title" | "id"> {
  id: string
  title: React.ReactNode
  count: React.ReactNode
  description?: React.ReactNode
  variant?: KitchenColumnState
  emptyState?: React.ReactNode
  loading?: React.ReactNode
  headingAs?: "h2" | "h3"
}

export const KitchenColumn = React.forwardRef<HTMLElement, KitchenColumnProps>(({ children, className, count, description, emptyState, headingAs: Heading = "h2", id, loading, title, variant = "neutral", ...props }, ref) => {
  const headingId = `${id}-title`
  return <section ref={ref} aria-labelledby={headingId} className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-kitchen-column)] border bg-[var(--kitchen-column)]", columnVariantClasses[variant], className)} {...props}>
    <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-[var(--kitchen-divider)] bg-[var(--kitchen-column)] p-[var(--kitchen-column-padding)]">
      <div className="min-w-0"><Heading id={headingId} className="break-words text-[length:var(--text-kitchen-column-title)] font-bold leading-[var(--leading-kitchen-column-title)]">{title}</Heading>{description ? <p className="mt-1 break-words text-xs leading-4 text-[var(--dashboard-muted)]">{description}</p> : null}</div>
      <span aria-label={`${String(count)} commandes`} className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-[var(--kitchen-card-emphasis)] px-2 text-[length:var(--text-kitchen-column-count)] font-black leading-[var(--leading-kitchen-column-count)] tabular-nums">{count}</span>
    </header>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-[var(--kitchen-column-padding)]">{loading ?? (React.Children.count(children) ? <div className="grid min-w-0 gap-[var(--kitchen-card-gap)]">{children}</div> : emptyState)}</div>
  </section>
})
KitchenColumn.displayName = "KitchenColumn"

