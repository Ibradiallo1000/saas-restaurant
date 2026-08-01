import type * as React from "react"

export type KitchenDisplayStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled"
  | "unknown"

export type KitchenPriority = "normal" | "warning" | "overdue" | "critical"
export type KitchenDestinationDisplay = "kitchen" | "bar" | "directService" | "mixed" | "unknown"
export type KitchenDensity = "comfortable" | "wallDisplay"
export type KitchenTimerVariant = KitchenPriority
export type KitchenColumnState = KitchenDisplayStatus | "neutral"
export type KitchenConnectionDisplayState = "connected" | "reconnecting" | "disconnected" | "unknown"
export type KitchenBoardLayout = "stack" | "columns" | "adaptive"

export interface KitchenStatusPresentation {
  status: KitchenDisplayStatus
  label: React.ReactNode
  icon?: React.ReactNode
}

export interface KitchenDestinationPresentation {
  destination: KitchenDestinationDisplay
  label: React.ReactNode
  icon?: React.ReactNode
}

export interface KitchenTimerPresentation {
  label: React.ReactNode
  value: React.ReactNode
  variant?: KitchenTimerVariant
  icon?: React.ReactNode
  ariaLabel?: string
}

export interface KitchenItemPresentation {
  id: string
  quantity: React.ReactNode
  name: React.ReactNode
  imageUrl?: string | null
  options?: React.ReactNode
  note?: React.ReactNode
  destination?: React.ReactNode
  completed?: boolean
  linked?: boolean
}

export interface KitchenActionPresentation {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: "primary" | "secondary" | "outline" | "danger"
  onSelect: () => void
  disabled?: boolean
  loading?: boolean
  dangerous?: boolean
}

export interface KitchenLoadMetric {
  id: string
  label: React.ReactNode
  value: React.ReactNode
  tone?: KitchenPriority | "ready"
}

export const KITCHEN_VIEWPORT_PROFILES = {
  compact: { minWidth: 320, maxWidth: 359, gutter: 12, columns: 1, gap: 12 },
  mobile: { minWidth: 360, maxWidth: 767, gutter: 16, columns: 1, gap: 12 },
  tablet: { minWidth: 768, maxWidth: 1023, gutter: 20, columns: 2, gap: 16 },
  desktop: { minWidth: 1024, maxWidth: 1279, gutter: 24, columns: 3, gap: 16 },
  wide: { minWidth: 1280, maxWidth: null, gutter: 24, columns: 3, gap: 16 },
} as const

export const KITCHEN_REQUIRED_TEST_WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440] as const
export const KITCHEN_COLUMN_WIDTHS = { minimum: 280, comfortable: 360, maximum: 440 } as const
export const KITCHEN_TOUCH_TARGETS = { minimum: 44, tactile: 48, wallDisplay: 52 } as const
export const KITCHEN_MOTION = { focus: 120, state: 200, cardEntry: 200, overlay: 250, fullScreen: 250 } as const
