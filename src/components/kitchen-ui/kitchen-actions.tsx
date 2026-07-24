import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { KitchenActionPresentation, KitchenDensity } from "./kitchen-foundations"

const actionVariantClasses: Record<NonNullable<KitchenActionPresentation["variant"]>, string> = {
  primary: "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)]",
  secondary: "bg-[var(--kitchen-card-muted)] text-[var(--dashboard-title)] hover:bg-[var(--dashboard-section)]",
  outline: "border border-[var(--kitchen-border)] bg-transparent text-[var(--dashboard-title)] hover:bg-[var(--kitchen-card-muted)]",
  danger: "bg-[var(--danger)] text-white hover:opacity-90",
}

export interface KitchenActionButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof Button>, "variant"> {
  loading?: boolean
  density?: KitchenDensity
  visualVariant?: KitchenActionPresentation["variant"]
}

export const KitchenActionButton = React.forwardRef<React.ElementRef<typeof Button>, KitchenActionButtonProps>(({ children, className, density = "comfortable", disabled, loading = false, visualVariant = "primary", ...props }, ref) => (
  <Button ref={ref} type="button" disabled={disabled || loading} aria-busy={loading || undefined} className={cn("dashboard-focus-visible min-w-0 whitespace-normal rounded-[var(--radius-dashboard-button)] px-4 text-[length:var(--text-kitchen-action)] font-bold leading-[var(--leading-kitchen-action)] transition-colors [transition-duration:var(--motion-kitchen-state)] motion-reduce:transition-none", density === "wallDisplay" ? "min-h-[var(--target-kitchen-wall)]" : "min-h-[var(--target-kitchen-tactile)]", actionVariantClasses[visualVariant ?? "primary"], className)} {...props}>
    {loading ? <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin motion-reduce:animate-none" /> : null}
    {children}
  </Button>
))
KitchenActionButton.displayName = "KitchenActionButton"

export interface KitchenActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  primary?: KitchenActionPresentation
  secondary?: KitchenActionPresentation[]
  density?: KitchenDensity
  label?: string
}

export const KitchenActionBar = React.forwardRef<HTMLDivElement, KitchenActionBarProps>(({ className, density = "comfortable", label = "Actions de la commande", primary, secondary = [], ...props }, ref) => (
  <div ref={ref} role="group" aria-label={label} className={cn("grid min-w-0 gap-2", secondary.length ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1", className)} {...props}>
    {primary ? <KitchenActionButton density={density} visualVariant={primary.dangerous ? "danger" : primary.variant} disabled={primary.disabled} loading={primary.loading} onClick={primary.onSelect}>{primary.icon ? <span aria-hidden="true" className="mr-2 shrink-0 [&_svg]:size-5">{primary.icon}</span> : null}{primary.label}</KitchenActionButton> : null}
    {secondary.length ? <div className="flex min-w-0 flex-wrap gap-2">{secondary.map((action) => <KitchenActionButton key={action.id} density={density} visualVariant={action.dangerous ? "danger" : action.variant ?? "outline"} disabled={action.disabled} loading={action.loading} onClick={action.onSelect} className="flex-1 sm:flex-none">{action.icon ? <span aria-hidden="true" className="mr-2 shrink-0 [&_svg]:size-5">{action.icon}</span> : null}{action.label}</KitchenActionButton>)}</div> : null}
  </div>
))
KitchenActionBar.displayName = "KitchenActionBar"
