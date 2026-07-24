import * as React from "react"
import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState, type DashboardLoadingStateProps } from "@/components/dashboard-ui"

export const PlatformEmptyState = DashboardEmptyState
export const PlatformErrorState = DashboardErrorState
export const PlatformLoadingState = React.forwardRef<HTMLDivElement, DashboardLoadingStateProps>((props, ref) => <DashboardLoadingState ref={ref} {...props} />)
PlatformLoadingState.displayName = "PlatformLoadingState"
export const PlatformUnavailableState = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof DashboardEmptyState>>((props, ref) => <DashboardEmptyState ref={ref} {...props} />)
PlatformUnavailableState.displayName = "PlatformUnavailableState"
export const PlatformPermissionDeniedState = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof DashboardErrorState>>((props, ref) => <DashboardErrorState ref={ref} {...props} />)
PlatformPermissionDeniedState.displayName = "PlatformPermissionDeniedState"

