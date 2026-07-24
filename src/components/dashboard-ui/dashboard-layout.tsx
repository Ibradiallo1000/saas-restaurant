import * as React from "react"
import { cn } from "@/lib/utils"

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
  ({ actions, className, eyebrow, headingAs: Heading = "h1", meta, subtitle, title, ...props }, ref) => (
    <header ref={ref} className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)} {...props}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[length:var(--text-dashboard-label)] font-bold uppercase leading-[var(--leading-dashboard-label)] tracking-wide text-[var(--dashboard-label)]">{eyebrow}</div> : null}
        <Heading className="text-[length:var(--text-dashboard-page-title)] font-bold leading-[var(--leading-dashboard-page-title)] tracking-tight text-[var(--dashboard-title)]">{title}</Heading>
        {subtitle ? <p className="mt-1 max-w-3xl text-[length:var(--text-dashboard-description)] leading-[var(--leading-dashboard-description)] text-[var(--dashboard-subtitle)]">{subtitle}</p> : null}
        {meta ? <div className="mt-2 text-[length:var(--text-dashboard-caption)] leading-[var(--leading-dashboard-caption)] text-[var(--dashboard-muted)]">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
)
DashboardHeader.displayName = "DashboardHeader"

export interface DashboardSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  headingAs?: "h2" | "h3"
  surface?: boolean
}

export const DashboardSection = React.forwardRef<HTMLElement, DashboardSectionProps>(
  ({ action, children, className, description, headingAs: Heading = "h2", surface = false, title, ...props }, ref) => (
    <section ref={ref} className={cn("space-y-3", surface && "rounded-[var(--radius-dashboard-card)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4 shadow-[var(--shadow-dashboard-surface)]", className)} {...props}>
      {title || description || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <Heading className="text-[length:var(--text-dashboard-section-title)] font-semibold leading-[var(--leading-dashboard-section-title)] text-[var(--dashboard-title)]">{title}</Heading> : null}
            {description ? <p className="mt-0.5 text-[length:var(--text-dashboard-description)] leading-[var(--leading-dashboard-description)] text-[var(--dashboard-muted)]">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
)
DashboardSection.displayName = "DashboardSection"

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
