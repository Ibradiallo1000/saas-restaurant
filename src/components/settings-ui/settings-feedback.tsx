import * as React from "react"
import { CheckCircle2, LockKeyhole, Save, WifiOff } from "lucide-react"
import { DashboardAlert, DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard-ui"
export const SettingsLoadingState = DashboardLoadingState
export const SettingsEmptyState = DashboardEmptyState
export const SettingsErrorState = DashboardErrorState
type FeedbackProps = React.ComponentProps<typeof DashboardAlert>
export const SettingsSavedState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<CheckCircle2/>} tone="neutral" {...props}/>); SettingsSavedState.displayName = "SettingsSavedState"
export const SettingsSavingState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<Save/>} tone="info" {...props}/>); SettingsSavingState.displayName = "SettingsSavingState"
export const SettingsPermissionDeniedState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<LockKeyhole/>} tone="negative" {...props}/>); SettingsPermissionDeniedState.displayName = "SettingsPermissionDeniedState"
export const SettingsUnavailableState = React.forwardRef<HTMLElement, FeedbackProps>((props, ref) => <DashboardAlert ref={ref} icon={<WifiOff/>} tone="neutral" {...props}/>); SettingsUnavailableState.displayName = "SettingsUnavailableState"
