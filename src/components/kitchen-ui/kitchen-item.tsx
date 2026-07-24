import * as React from "react"

import { cn } from "@/lib/utils"
import type { KitchenItemPresentation } from "./kitchen-foundations"

export interface KitchenNoteProps extends Omit<React.HTMLAttributes<HTMLElement>, "content"> {
  label: React.ReactNode
  content: React.ReactNode
  variant?: "neutral" | "attention" | "critical"
  icon?: React.ReactNode
}

const noteClasses = {
  neutral: "border-[var(--kitchen-border)] bg-[var(--kitchen-card-muted)] text-[var(--dashboard-subtitle)]",
  attention: "border-[color:color-mix(in_srgb,var(--kitchen-priority-warning)_45%,var(--kitchen-border))] bg-[var(--kitchen-priority-warning-bg)] text-[var(--kitchen-priority-warning-fg)]",
  critical: "border-[color:color-mix(in_srgb,var(--kitchen-priority-critical)_45%,var(--kitchen-border))] bg-[var(--kitchen-priority-critical-bg)] text-[var(--kitchen-priority-critical-fg)]",
} as const

export const KitchenNote = React.forwardRef<HTMLElement, KitchenNoteProps>(({ className, content, icon, label, variant = "neutral", ...props }, ref) => (
  <aside ref={ref} className={cn("rounded-[var(--radius-dashboard-button)] border p-3", noteClasses[variant], className)} {...props}>
    <div className="flex items-start gap-2">
      {icon ? <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-5">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-xs font-bold leading-4">{label}</p>
        <div className="mt-0.5 break-words text-[length:var(--text-kitchen-note)] font-semibold leading-[var(--leading-kitchen-note)]">{content}</div>
      </div>
    </div>
  </aside>
))
KitchenNote.displayName = "KitchenNote"

export interface KitchenItemProps extends Omit<React.HTMLAttributes<HTMLLIElement>, "children" | "id">, KitchenItemPresentation {}

export const KitchenItem = React.forwardRef<HTMLLIElement, KitchenItemProps>(({ className, completed = false, destination, linked = false, name, note, options, quantity, ...props }, ref) => (
  <li ref={ref} className={cn("grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-[var(--kitchen-divider)] py-3 last:border-b-0", completed && "text-[var(--dashboard-muted)]", className)} {...props}>
    <span className="min-w-10 text-right text-[length:var(--text-kitchen-item-quantity)] font-black leading-[var(--leading-kitchen-item-quantity)] tabular-nums" aria-label={`Quantité ${String(quantity)}`}>{quantity}<span aria-hidden="true">×</span></span>
    <div className="min-w-0">
      <div className={cn("break-words text-[length:var(--text-kitchen-item-name)] font-bold leading-[var(--leading-kitchen-item-name)]", completed && "line-through")}>{name}</div>
      {options ? <div className="mt-1 break-words text-[length:var(--text-kitchen-option)] leading-[var(--leading-kitchen-option)] text-[var(--dashboard-subtitle)]">{options}</div> : null}
      {note ? <div className="mt-2 break-words rounded-md bg-[var(--kitchen-priority-warning-bg)] px-2 py-1.5 text-[length:var(--text-kitchen-note)] font-semibold leading-[var(--leading-kitchen-note)] text-[var(--kitchen-priority-warning-fg)]"><span className="sr-only">Note : </span>{note}</div> : null}
      {destination || linked ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--dashboard-muted)]">{destination ? <span>{destination}</span> : null}{linked ? <span>Article lié</span> : null}</div> : null}
      {completed ? <span className="sr-only">Article terminé</span> : null}
    </div>
  </li>
))
KitchenItem.displayName = "KitchenItem"

export interface KitchenItemsListProps extends React.HTMLAttributes<HTMLUListElement> {
  items: KitchenItemPresentation[]
  empty?: React.ReactNode
}

export const KitchenItemsList = React.forwardRef<HTMLUListElement, KitchenItemsListProps>(({ className, empty = "Aucun article à afficher", items, ...props }, ref) => {
  if (!items.length) return <p className={cn("rounded-[var(--radius-dashboard-button)] border border-dashed border-[var(--kitchen-border)] p-4 text-sm text-[var(--dashboard-muted)]", className)}>{empty}</p>
  return <ul ref={ref} className={cn("min-w-0", className)} {...props}>{items.map((item) => <KitchenItem key={item.id} {...item} />)}</ul>
})
KitchenItemsList.displayName = "KitchenItemsList"
