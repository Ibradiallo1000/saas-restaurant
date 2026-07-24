import type * as React from "react"

export type PosSessionDisplayStatus = "closed" | "opening" | "active" | "paused" | "closing" | "pendingValidation" | "validated" | "error" | "unknown"
export type PosPaymentDisplayMethod = "cash" | "mobileMoney" | "unknown"
export type PosPaymentDisplayStatus = "pending" | "paid" | "failed" | "unknown"
export type PosProductAvailability = "available" | "limited" | "unavailable" | "unknown"
export type PosTransactionState = "idle" | "loading" | "success" | "failure"
export type PosClosingVarianceState = "balanced" | "positive" | "negative" | "warning" | "unknown"
export type PosDensity = "comfortable" | "compact" | "touch"
export type PosLayoutMode = "stack" | "split" | "adaptive"
export interface PosActionPresentation { id: string; label: React.ReactNode; disabled?: boolean; loading?: boolean }
export interface PosCartLinePresentation { id: string; name: React.ReactNode; description?: React.ReactNode; quantity: React.ReactNode; options?: React.ReactNode; unitPrice?: React.ReactNode; lineTotal: React.ReactNode }
export interface PosCategoryPresentation { id: string; label: string; imageUrl?: string | null; iconKey?: string | null; count?: number; disabled?: boolean }
export interface PosMobileProviderPresentation { id: string; label: string; description?: React.ReactNode; logo?: React.ReactNode; disabled?: boolean }

export const POS_VIEWPORT_PROFILES = {
  compact: { minWidth: 320, maxWidth: 430, layout: "stack", gutter: 12 },
  tablet: { minWidth: 768, maxWidth: 1023, layout: "split", gutter: 16 },
  desktop: { minWidth: 1024, maxWidth: 1439, layout: "split", gutter: 20 },
  wide: { minWidth: 1440, maxWidth: null, layout: "split", gutter: 24 },
} as const
export const POS_REQUIRED_TEST_WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440] as const
export const POS_TOUCH_TARGETS = { minimum: 44, transactional: 48, primary: 56, input: 48 } as const
export const POS_MOTION = { selection: 150, cart: 150, quantity: 150, overlay: 250, loading: 200 } as const
export const POS_FOUNDATION_CLASSES = { focusVisible: "dashboard-focus-visible", tabularNumbers: "dashboard-tabular-nums", reducedMotion: "dashboard-reduced-motion" } as const
