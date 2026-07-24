import * as React from "react"

import { DashboardHeader } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"

export interface SettingsPageProps extends React.HTMLAttributes<HTMLElement> {
  header?: React.ReactNode
  navigation?: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: "default" | "reading" | "full"
  withGutters?: boolean
}

export const SettingsPage = React.forwardRef<HTMLElement, SettingsPageProps>(({ children, className, footer, header, maxWidth = "default", navigation, withGutters = true, ...props }, ref) => (
  <main ref={ref} className={cn("dashboard-reduced-motion min-h-full min-w-0 bg-[var(--settings-canvas)] font-[var(--font-dashboard)] text-[var(--dashboard-title)]", withGutters && "px-[var(--dashboard-gutter-x)] py-4 md:py-6", className)} {...props}>
    <div className={cn("mx-auto w-full", maxWidth === "default" && "max-w-[var(--dashboard-content-max)]", maxWidth === "reading" && "max-w-[var(--dashboard-reading-max)]")}>
      {header}
      <div className={cn("mt-5 grid min-w-0 gap-[var(--settings-content-gap)]", navigation && "lg:grid-cols-[var(--settings-navigation-width)_minmax(0,1fr)]")}>
        {navigation ? <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">{navigation}</aside> : null}
        <div className="min-w-0 space-y-[var(--dashboard-section-gap)]">{children}</div>
      </div>
      {footer ? <footer className="mt-6 pb-[max(1rem,var(--safe-bottom,0px))]">{footer}</footer> : null}
    </div>
  </main>
))
SettingsPage.displayName = "SettingsPage"

export interface SettingsHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> { title: React.ReactNode; description?: React.ReactNode; status?: React.ReactNode; scope?: React.ReactNode; actions?: React.ReactNode; help?: React.ReactNode; breadcrumbs?: React.ReactNode }
export const SettingsHeader = React.forwardRef<HTMLElement, SettingsHeaderProps>(({ actions, breadcrumbs, className, description, help, scope, status, title, ...props }, ref) => <div className={cn("space-y-3", className)}>{breadcrumbs}<DashboardHeader ref={ref} title={title} subtitle={description} eyebrow={scope} actions={<>{status}{help}{actions}</>} {...props}/></div>)
SettingsHeader.displayName = "SettingsHeader"
