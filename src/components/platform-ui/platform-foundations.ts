import type * as React from "react"

export type PlatformDataQuality = "complete" | "partial" | "estimated" | "placeholder" | "stale" | "unavailable" | "unknown"
export type PlatformPermissionState = "editable" | "readOnly" | "denied" | "hidden" | "unavailable" | "unknown"
export type PlatformRestaurantState = "active" | "inactive" | "suspended" | "provisioning" | "error" | "unknown"
export type PlatformProvisioningState = "pending" | "provisioning" | "ready" | "failed" | "unknown"
export type PlatformPlanState = "active" | "inactive" | "archived" | "unknown"
export type PlatformSubscriptionState = "trial" | "active" | "pastDue" | "expired" | "cancelled" | "suspended" | "unknown"
export type PlatformBillingState = "paid" | "pending" | "overdue" | "failed" | "refunded" | "unknown"
export type PlatformUserState = "active" | "invited" | "disabled" | "unknown"
export type PlatformSupportState = "open" | "pending" | "resolved" | "closed" | "unknown"
export type PlatformAuditState = "success" | "warning" | "failure" | "unknown"
export type PlatformMonitoringState = "healthy" | "degraded" | "incident" | "unknown"
export type PlatformDangerLevel = "warning" | "danger" | "critical"
export type PlatformDensity = "comfortable" | "compact"
export type PlatformNavigationState = "default" | "active" | "disabled"

export interface PlatformNavigationItem {
  id: string
  label: React.ReactNode
  href?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  state?: PlatformNavigationState
  onSelect?: () => void
}

export interface PlatformTableColumn<Row> {
  id: string
  header: React.ReactNode
  cell: (row: Row) => React.ReactNode
  align?: "left" | "center" | "right"
  numeric?: boolean
  className?: string
}

export interface PlatformActionPresentation {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onSelect: () => void
}

export const PLATFORM_VIEWPORTS = [320, 360, 375, 390, 412, 430, 768, 1024, 1440] as const
export const PLATFORM_TOUCH_TARGET = 44
export const PLATFORM_CONTENT_WIDTHS = { default: "90rem", reading: "52rem", full: "100%" } as const

