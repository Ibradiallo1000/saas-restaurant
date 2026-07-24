import * as React from "react"
import { cn } from "@/lib/utils"
import type { OrderAgeVariant, OrderChannelDisplay, OrderDisplayStatus, OrderPaymentDisplayStatus } from "./order-foundations"

const statusClasses: Record<OrderDisplayStatus, string> = {
  pending: "bg-[var(--order-status-pending-bg)] text-[var(--order-status-pending-fg)]",
  preparing: "bg-[var(--order-status-preparing-bg)] text-[var(--order-status-preparing-fg)]",
  ready: "bg-[var(--order-status-ready-bg)] text-[var(--order-status-ready-fg)]",
  served: "bg-[var(--order-status-served-bg)] text-[var(--order-status-served-fg)]",
  pickedUp: "bg-[var(--order-status-served-bg)] text-[var(--order-status-served-fg)]",
  completed: "bg-[var(--order-status-completed-bg)] text-[var(--order-status-completed-fg)]",
  cancelled: "bg-[var(--order-status-cancelled-bg)] text-[var(--order-status-cancelled-fg)]",
  rejected: "bg-[var(--order-status-cancelled-bg)] text-[var(--order-status-cancelled-fg)]",
  unknown: "bg-[var(--order-status-neutral-bg)] text-[var(--order-status-neutral-fg)]",
}

const paymentClasses: Record<OrderPaymentDisplayStatus, string> = {
  unpaid: "bg-[var(--order-payment-unpaid-bg)] text-[var(--order-payment-unpaid-fg)]",
  pending: "bg-[var(--order-payment-pending-bg)] text-[var(--order-payment-pending-fg)]",
  pendingCash: "bg-[var(--order-payment-pending-bg)] text-[var(--order-payment-pending-fg)]",
  pendingMobile: "bg-[var(--order-payment-pending-bg)] text-[var(--order-payment-pending-fg)]",
  pendingVerification: "bg-[var(--order-payment-pending-bg)] text-[var(--order-payment-pending-fg)]",
  verified: "bg-[var(--order-payment-paid-bg)] text-[var(--order-payment-paid-fg)]",
  paid: "bg-[var(--order-payment-paid-bg)] text-[var(--order-payment-paid-fg)]",
  failed: "bg-[var(--order-payment-failed-bg)] text-[var(--order-payment-failed-fg)]",
  unknown: "bg-[var(--order-status-neutral-bg)] text-[var(--order-status-neutral-fg)]",
}

type BadgeBaseProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & { label: React.ReactNode; icon?: React.ReactNode; size?: "compact" | "standard" }
const BadgeBase = React.forwardRef<HTMLSpanElement, BadgeBaseProps>(({ className, icon, label, size = "standard", ...props }, ref) => <span ref={ref} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold leading-tight", size === "compact" ? "min-h-6 px-2 py-1 text-xs" : "min-h-8 px-2.5 py-1.5 text-sm", className)} {...props}>{icon ? <span aria-hidden="true" className="shrink-0 [&_svg]:size-4">{icon}</span> : null}<span className="min-w-0 break-words text-left">{label}</span></span>)
BadgeBase.displayName = "OrderBadgeBase"

export interface OrderStatusBadgeProps extends BadgeBaseProps { status: OrderDisplayStatus }
export const OrderStatusBadge = React.forwardRef<HTMLSpanElement, OrderStatusBadgeProps>(({ className, status, ...props }, ref) => <BadgeBase ref={ref} className={cn(statusClasses[status], className)} {...props} />)
OrderStatusBadge.displayName = "OrderStatusBadge"

export interface OrderPaymentBadgeProps extends Omit<BadgeBaseProps, "icon"> { status: OrderPaymentDisplayStatus; method?: React.ReactNode }
export const OrderPaymentBadge = React.forwardRef<HTMLSpanElement, OrderPaymentBadgeProps>(({ className, label, method, status, ...props }, ref) => <BadgeBase ref={ref} label={<>{label}{method ? <span className="font-normal opacity-80">· {method}</span> : null}</>} className={cn(paymentClasses[status], className)} {...props} />)
OrderPaymentBadge.displayName = "OrderPaymentBadge"

const channelClasses: Record<OrderChannelDisplay, string> = { dineIn: "", pickup: "", delivery: "", qrTable: "", pos: "", public: "", unknown: "" }
export interface OrderChannelBadgeProps extends BadgeBaseProps { channel: OrderChannelDisplay }
export const OrderChannelBadge = React.forwardRef<HTMLSpanElement, OrderChannelBadgeProps>(({ channel, className, ...props }, ref) => <BadgeBase ref={ref} className={cn("border border-[var(--order-border)] bg-[var(--order-surface-muted)] text-[var(--dashboard-subtitle)]", channelClasses[channel], className)} {...props} />)
OrderChannelBadge.displayName = "OrderChannelBadge"

const ageClasses: Record<OrderAgeVariant, string> = { normal: "text-[var(--dashboard-muted)]", warning: "text-[var(--order-priority-warning)]", overdue: "text-[var(--order-priority-overdue)]" }
export interface OrderAgeIndicatorProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> { label: React.ReactNode; time?: React.ReactNode; variant?: OrderAgeVariant; icon?: React.ReactNode }
export const OrderAgeIndicator = React.forwardRef<HTMLSpanElement, OrderAgeIndicatorProps>(({ className, icon, label, time, variant = "normal", ...props }, ref) => <span ref={ref} className={cn("inline-flex min-h-6 items-center gap-1.5 text-xs font-semibold tabular-nums", ageClasses[variant], className)} {...props}>{icon ? <span aria-hidden="true" className="[&_svg]:size-4">{icon}</span> : null}<span>{label}</span>{time ? <time>{time}</time> : null}</span>)
OrderAgeIndicator.displayName = "OrderAgeIndicator"
