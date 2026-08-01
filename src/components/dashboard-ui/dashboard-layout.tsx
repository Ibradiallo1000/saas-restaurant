import * as React from "react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/design-system/components"
import { semanticAccentClasses, semanticSurfaceClasses, type DashboardSemanticVariant } from "./semantic-variants"

type ElementTag = "div" | "main" | "section" | "header" | "aside" | "nav"

export interface DashboardPageProps extends React.HTMLAttributes<HTMLElement> {
  as?: ElementTag
  width?: "default" | "reading" | "full"
}

export const DashboardPage = React.forwardRef<HTMLElement, DashboardPageProps>(
  ({ as: Component = "main", width = "default", className, ...props }, ref) => (
    <Component
      ref={ref as React.Ref<never>}
      className={cn(
        "mx-auto w-full space-y-[var(--dashboard-section-gap)] bg-[var(--dashboard-canvas)] px-[var(--dashboard-gutter-x)] py-4 font-[var(--font-dashboard)] text-[var(--dashboard-title)] md:py-6",
        width === "default" && "max-w-[var(--dashboard-content-max)]",
        width === "reading" && "max-w-[var(--dashboard-reading-max)]",
        className
      )}
      {...props}
    />
  )
)
DashboardPage.displayName = "DashboardPage"

export interface DashboardHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
  headingAs?: "h1" | "h2"
}

export const DashboardHeader = React.forwardRef<HTMLElement, DashboardHeaderProps>(
  ({ actions, className, eyebrow, headingAs = "h1", meta, subtitle, title, ...props }, ref) => (
    <PageHeader
      ref={ref}
      className={className}
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      meta={meta}
      action={actions}
      headingAs={headingAs}
      {...props}
    />
  )
)
DashboardHeader.displayName = "DashboardHeader"

export interface DashboardSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  headingAs?: "h2" | "h3"
  surface?: boolean
  density?: "compact" | "dense" | "default"
  variant?: DashboardSemanticVariant
}

export const DashboardSection = React.forwardRef<HTMLElement, DashboardSectionProps>(
  ({ action, children, className, density = "dense", description, headingAs: Heading = "h2", surface = true, title, variant, ...props }, ref) => {
    const resolvedVariant = variant ?? resolveDashboardSectionVariant(title)
    return (
    <section ref={ref} data-variant={surface ? resolvedVariant : undefined} className={cn(density === "compact" ? "space-y-1.5" : density === "dense" ? "space-y-2" : "space-y-3", surface && "rounded-[var(--radius-dashboard-card)] border shadow-[var(--shadow-dashboard-surface)]", surface && semanticSurfaceClasses[resolvedVariant], surface && (density === "compact" ? "p-2.5" : density === "dense" ? "p-3" : "p-4"), className)} {...props}>
      {title || description || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <Heading className="flex items-center gap-2 text-[length:var(--text-dashboard-section-title)] font-semibold leading-[var(--leading-dashboard-section-title)] text-[var(--dashboard-title)]">{surface ? <span aria-hidden="true" className={cn("size-2 rounded-full", semanticAccentClasses[resolvedVariant])} /> : null}{title}</Heading> : null}
            {description ? <p className="mt-0.5 text-[length:var(--text-dashboard-description)] leading-[var(--leading-dashboard-description)] text-[var(--dashboard-muted)]">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )}
)
DashboardSection.displayName = "DashboardSection"

function resolveDashboardSectionVariant(title: React.ReactNode): DashboardSemanticVariant {
  const label = typeof title === "string" ? title.toLocaleLowerCase("fr") : ""
  if (label.includes("alerte") || label.includes("retard") || label.includes("anomalie")) return "danger"
  if (label.includes("caisse") || label.includes("paiement")) return "finance"
  if (label.includes("stock") || label.includes("approvisionnement")) return "stock"
  if (label.includes("finance") || label.includes("trésor") || label.includes("conforme")) return "success"
  if (label.includes("table") || label.includes("opérationnel")) return "info"
  if (label.includes("analyse") || label.includes("secondaire") || label.includes("contexte")) return "neutral"
  if (label.includes("activité") || label.includes("commande") || label.includes("période")) return "activity"
  return "neutral"
}

export const DashboardToolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="toolbar" className={cn("flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-dashboard-widget)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-3", className)} {...props} />
)
DashboardToolbar.displayName = "DashboardToolbar"

export const DashboardFilters = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-2 [&_button]:min-h-[var(--target-dashboard-min)] [&_input]:min-h-[var(--target-dashboard-min)] [&_select]:min-h-[var(--target-dashboard-min)]", className)} {...props} />
)
DashboardFilters.displayName = "DashboardFilters"

export const DashboardDivider = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => <hr ref={ref} className={cn("border-0 border-t border-[var(--dashboard-divider)]", className)} {...props} />
)
DashboardDivider.displayName = "DashboardDivider"
