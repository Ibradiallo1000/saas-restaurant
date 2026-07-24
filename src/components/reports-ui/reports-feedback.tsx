"use client"

import * as React from "react"
import { BarChart3, Clock3, Sigma, WifiOff } from "lucide-react"
import { DashboardAlert, DashboardEmptyState, DashboardErrorState, DashboardLoadingState, type DashboardAlertProps } from "@/components/dashboard-ui"

export const ReportsLoadingState = DashboardLoadingState
export const ReportsEmptyState = DashboardEmptyState
export const ReportsErrorState = DashboardErrorState
type FeedbackProps = Omit<DashboardAlertProps, "icon" | "tone">
export const ReportsPartialState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<BarChart3 />} tone="warning" {...props} />)
ReportsPartialState.displayName = "ReportsPartialState"
export const ReportsEstimatedState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<Sigma />} tone="info" {...props} />)
ReportsEstimatedState.displayName = "ReportsEstimatedState"
export const ReportsStaleState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<Clock3 />} tone="warning" {...props} />)
ReportsStaleState.displayName = "ReportsStaleState"
export const ReportsUnavailableState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<WifiOff />} tone="neutral" {...props} />)
ReportsUnavailableState.displayName = "ReportsUnavailableState"

