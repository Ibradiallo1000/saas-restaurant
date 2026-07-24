import * as React from "react"
import { cn } from "@/lib/utils"

export interface DashboardTableContainerProps extends React.HTMLAttributes<HTMLDivElement> { label: string; description?: string }
export const DashboardTableContainer = React.forwardRef<HTMLDivElement, DashboardTableContainerProps>(({ children, className, description, label, ...props }, ref) => <div ref={ref} role="region" aria-label={label} aria-description={description} tabIndex={0} className={cn("max-w-full overflow-x-auto rounded-[var(--radius-dashboard-widget)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 [&_table]:w-full [&_th]:whitespace-nowrap [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[var(--dashboard-label)] [&_td]:text-sm [&_td]:text-[var(--dashboard-subtitle)]", className)} {...props}>{children}</div>)
DashboardTableContainer.displayName = "DashboardTableContainer"
