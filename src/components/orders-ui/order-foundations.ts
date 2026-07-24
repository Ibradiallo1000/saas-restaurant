import type * as React from "react"

export type OrderDisplayStatus = "pending" | "preparing" | "ready" | "served" | "pickedUp" | "completed" | "cancelled" | "rejected" | "unknown"
export type OrderPaymentDisplayStatus = "unpaid" | "pending" | "pendingCash" | "pendingMobile" | "pendingVerification" | "verified" | "paid" | "failed" | "unknown"
export type OrderChannelDisplay = "dineIn" | "pickup" | "delivery" | "qrTable" | "pos" | "public" | "unknown"
export type OrderFulfillmentDisplay = "notFulfilled" | "served" | "pickedUp" | "delivered" | "unknown"
export type OrderPriorityDisplay = "normal" | "warning" | "overdue" | "critical"
export type OrderDensity = "comfortable" | "compact"
export type OrderAgeVariant = "normal" | "warning" | "overdue"

export interface OrderActionPresentation {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  onSelect: () => void
  disabled?: boolean
  loading?: boolean
  dangerous?: boolean
  confirmationRequired?: boolean
}

export interface OrderStatusPresentation {
  status: OrderDisplayStatus
  label: string
  icon?: React.ReactNode
}

export interface OrderPaymentPresentation {
  status: OrderPaymentDisplayStatus
  label: string
  method?: React.ReactNode
}

export interface OrderChannelPresentation {
  channel: OrderChannelDisplay
  label: string
  icon?: React.ReactNode
}

export interface OrderAgePresentation {
  label: React.ReactNode
  time?: React.ReactNode
  variant?: OrderAgeVariant
  icon?: React.ReactNode
}

export const ORDER_REQUIRED_TEST_WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024, 1440] as const
export const ORDER_DENSITIES: readonly OrderDensity[] = ["comfortable", "compact"]
