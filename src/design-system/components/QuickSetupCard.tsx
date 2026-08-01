"use client"

import { Building2, CakeSlice, Sandwich, SlidersHorizontal, Wine, type LucideIcon } from "lucide-react"
import type { ButtonHTMLAttributes, HTMLAttributes } from "react"

import { cn } from "@/lib/utils"
import {
  semanticHoverClasses,
  semanticIconClasses,
  semanticSurfaceClasses,
  type DashboardSemanticVariant,
} from "@/components/dashboard-ui/semantic-variants"

type QuickSetupCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  title: string
  description: string
  icon: LucideIcon
  variant?: DashboardSemanticVariant
  selected?: boolean
}

export function QuickSetupCard({ title, description, icon: Icon, variant = "neutral", selected = false, className, ...props }: QuickSetupCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "group grid min-h-28 min-w-0 grid-rows-[auto_auto_1fr] items-start overflow-hidden rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow,transform]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]",
        semanticSurfaceClasses[variant],
        semanticHoverClasses[variant],
        selected && "border-primary ring-2 ring-primary/35 shadow-sm",
        className
      )}
      {...props}
    >
      <span className={cn("mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", semanticIconClasses[variant])} aria-hidden="true">
        <Icon />
      </span>
      <span className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-tight">{title}</span>
      <span className="mt-1 line-clamp-2 min-w-0 break-words text-xs leading-snug text-muted-foreground">{description}</span>
    </button>
  )
}

export function QuickSetupGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "quick-setup-grid",
        className
      )}
      {...props}
    />
  )
}

export function getQuickSetupVisual(id: string): { icon: LucideIcon; variant: DashboardSemanticVariant } {
  if (id === "simple") return { icon: Building2, variant: "activity" }
  if (id === "bar") return { icon: Wine, variant: "finance" }
  if (id === "fast") return { icon: Sandwich, variant: "stock" }
  if (id === "pastry") return { icon: CakeSlice, variant: "danger" }
  return { icon: SlidersHorizontal, variant: "neutral" }
}
