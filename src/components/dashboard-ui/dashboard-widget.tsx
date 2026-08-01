import * as React from "react"
import { cn } from "@/lib/utils"
import { semanticBeforeAccentClasses, semanticSurfaceClasses, type DashboardSemanticVariant } from "./semantic-variants"

type SurfaceProps = React.HTMLAttributes<HTMLElement> & { as?: "div" | "article" | "section" | "aside"; variant?: DashboardSemanticVariant; density?: "compact" | "dense" | "default" }

export const DashboardPanel = React.forwardRef<HTMLElement, SurfaceProps>(({ as: Component = "div", className, ...props }, ref) => <Component ref={ref as React.Ref<never>} className={cn("rounded-[var(--radius-dashboard-card)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4 shadow-[var(--shadow-dashboard-surface)]", className)} {...props} />)
DashboardPanel.displayName = "DashboardPanel"

export const DashboardWidget = React.forwardRef<HTMLElement, SurfaceProps>(({ as: Component = "article", className, density = "dense", variant = "neutral", ...props }, ref) => <Component ref={ref as React.Ref<never>} className={cn("relative overflow-hidden rounded-[var(--radius-dashboard-widget)] border shadow-[var(--shadow-dashboard-surface)] before:absolute before:inset-x-0 before:top-0 before:h-0.5", semanticSurfaceClasses[variant], semanticBeforeAccentClasses[variant], density === "compact" && "[&_[data-widget-content]]:p-2.5", density === "dense" && "[&_[data-widget-content]]:p-3", className)} data-density={density} data-variant={variant} {...props} />)
DashboardWidget.displayName = "DashboardWidget"

export interface DashboardWidgetHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; headingAs?: "h2" | "h3" }
export const DashboardWidgetHeader = React.forwardRef<HTMLDivElement, DashboardWidgetHeaderProps>(({ action, className, description, headingAs: Heading = "h2", title, ...props }, ref) => <div ref={ref} className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dashboard-divider)] px-4 py-3", className)} {...props}><div className="min-w-0"><Heading className="text-sm font-semibold text-[var(--dashboard-title)]">{title}</Heading>{description ? <p className="mt-0.5 text-xs leading-4 text-[var(--dashboard-muted)]">{description}</p> : null}</div>{action}</div>)
DashboardWidgetHeader.displayName = "DashboardWidgetHeader"

export const DashboardWidgetFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dashboard-divider)] px-4 py-3 text-xs text-[var(--dashboard-muted)]", className)} {...props} />)
DashboardWidgetFooter.displayName = "DashboardWidgetFooter"

export interface DashboardQuickActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon?: React.ReactNode; description?: React.ReactNode }
export const DashboardQuickAction = React.forwardRef<HTMLButtonElement, DashboardQuickActionProps>(({ children, className, description, icon, type = "button", ...props }, ref) => <button ref={ref} type={type} className={cn("flex min-h-[var(--target-dashboard-recommended)] w-full items-center gap-3 rounded-[var(--radius-dashboard-button)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] px-3 py-2 text-left text-sm font-semibold text-[var(--dashboard-title)] transition-colors [transition-duration:var(--motion-dashboard-hover)] hover:bg-[var(--metric-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none", className)} {...props}>{icon ? <span aria-hidden="true" className="shrink-0 text-[var(--data-info)] [&_svg]:size-5">{icon}</span> : null}<span className="min-w-0"><span className="block">{children}</span>{description ? <span className="mt-0.5 block text-xs font-normal text-[var(--dashboard-muted)]">{description}</span> : null}</span></button>)
DashboardQuickAction.displayName = "DashboardQuickAction"
