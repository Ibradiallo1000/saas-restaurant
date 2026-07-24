import * as React from "react"
import { Banknote, CheckCircle2, CircleX, LockKeyhole, Loader2 } from "lucide-react"
import { DashboardAlert, DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard-ui"
export const PosLoadingState = DashboardLoadingState
export const PosEmptyState = DashboardEmptyState
export const PosErrorState = DashboardErrorState
type FeedbackProps = Omit<React.ComponentProps<typeof DashboardAlert>, "icon" | "tone">
export function PosSessionRequiredState(props: FeedbackProps) { return <DashboardAlert icon={<LockKeyhole />} tone="warning" {...props}/> }
export function PosPaymentProcessingState(props: FeedbackProps) { return <DashboardAlert icon={<Loader2 className="animate-spin motion-reduce:animate-none"/>} tone="info" {...props}/> }
export function PosPaymentSuccessState(props: FeedbackProps) { return <DashboardAlert icon={<CheckCircle2/>} tone="neutral" {...props}/> }
export function PosPaymentFailureState(props: FeedbackProps) { return <DashboardAlert icon={<CircleX/>} tone="negative" announce {...props}/> }
export function PosCashState(props: FeedbackProps) { return <DashboardAlert icon={<Banknote/>} tone="neutral" {...props}/> }

