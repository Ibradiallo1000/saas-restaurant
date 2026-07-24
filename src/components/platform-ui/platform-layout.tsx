import * as React from "react"
import { DashboardHeader, DashboardPage, DashboardSection, type DashboardHeaderProps, type DashboardPageProps, type DashboardSectionProps } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"

export const PlatformPage = React.forwardRef<HTMLElement, DashboardPageProps>(({ className, ...props }, ref) => <DashboardPage ref={ref} className={cn("bg-[var(--platform-canvas)] [&_button]:min-h-11 [&_input]:min-h-11 [&_select]:min-h-11 motion-reduce:[&_.animate-spin]:animate-none motion-reduce:[&_.animate-pulse]:animate-none", className)} {...props} />)
PlatformPage.displayName = "PlatformPage"

export const PlatformHeader = React.forwardRef<HTMLElement, DashboardHeaderProps>(({ className, ...props }, ref) => <DashboardHeader ref={ref} className={className} {...props} />)
PlatformHeader.displayName = "PlatformHeader"

export const PlatformSection = React.forwardRef<HTMLElement, DashboardSectionProps>(({ className, surface, ...props }, ref) => <DashboardSection ref={ref} surface={surface} className={cn(surface && "border-[var(--platform-border)] bg-[var(--platform-panel)]", className)} {...props} />)
PlatformSection.displayName = "PlatformSection"
