import * as React from "react"
import { Cloud, CloudOff, Clock3, Loader2, RefreshCw } from "lucide-react"

import { DashboardAlert, DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { KitchenConnectionDisplayState } from "./kitchen-foundations"

export const KitchenLoadingState = DashboardLoadingState
export const KitchenEmptyState = DashboardEmptyState
export const KitchenErrorState = DashboardErrorState

const connectionPresentation = {
  connected: { icon: Cloud, tone: "info" as const },
  reconnecting: { icon: RefreshCw, tone: "warning" as const },
  disconnected: { icon: CloudOff, tone: "negative" as const },
  unknown: { icon: Cloud, tone: "neutral" as const },
}

export interface KitchenConnectionStateProps extends Omit<React.ComponentProps<typeof DashboardAlert>, "tone" | "icon"> { state: KitchenConnectionDisplayState }
export function KitchenConnectionState({ className, state, ...props }: KitchenConnectionStateProps) {
  const presentation = connectionPresentation[state]
  const Icon = presentation.icon
  return <DashboardAlert className={cn("min-w-0", className)} tone={presentation.tone} icon={<Icon />} {...props} />
}

export type KitchenStaleStateProps = Omit<React.ComponentProps<typeof DashboardAlert>, "tone" | "icon">
export function KitchenStaleState(props: KitchenStaleStateProps) { return <DashboardAlert tone="warning" icon={<Clock3 />} {...props} /> }

export interface KitchenInlineLoadingProps extends React.HTMLAttributes<HTMLSpanElement> { label?: string }
export const KitchenInlineLoading = React.forwardRef<HTMLSpanElement, KitchenInlineLoadingProps>(({ className, label = "Action en cours", ...props }, ref) => <span ref={ref} role="status" className={cn("inline-flex items-center gap-2 text-sm text-[var(--dashboard-muted)]", className)} {...props}><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{label}</span>)
KitchenInlineLoading.displayName = "KitchenInlineLoading"

