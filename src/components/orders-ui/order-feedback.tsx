import * as React from "react"
import { CloudOff, Clock3 } from "lucide-react"
import { DashboardAlert, DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard-ui"

export const OrdersLoadingState = DashboardLoadingState
export const OrdersEmptyState = DashboardEmptyState
export const OrdersErrorState = DashboardErrorState

export type OrdersConnectionStateProps = Omit<React.ComponentProps<typeof DashboardAlert>, "tone" | "icon">
export function OrdersOfflineState(props: OrdersConnectionStateProps) { return <DashboardAlert tone="warning" icon={<CloudOff />} {...props} /> }
export function OrdersStaleState(props: OrdersConnectionStateProps) { return <DashboardAlert tone="warning" icon={<Clock3 />} {...props} /> }
