import type * as React from "react"

import {
  DASHBOARD_CONTRAST_RATIOS,
  DASHBOARD_CONTENT_WIDTHS,
  DASHBOARD_MOTION,
  DASHBOARD_TOUCH_TARGETS,
  DASHBOARD_VIEWPORT_PROFILES,
} from "@/components/dashboard-ui"

export type SettingsSectionState = "ready" | "loading" | "error" | "unavailable" | "readOnly"
export type SettingsSaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "blocked" | "unavailable"
export type SettingsPermissionState = "editable" | "readOnly" | "hidden" | "unavailable" | "unknown"
export type SettingsFieldStatus = "default" | "focus" | "error" | "disabled" | "readOnly"
export type SettingsDangerLevel = "caution" | "danger" | "critical"
export type SettingsMediaState = "empty" | "ready" | "loading" | "error" | "disabled"
export type SettingsScheduleDayState = "enabled" | "closed" | "error" | "disabled"
export type SettingsTeamMemberState = "active" | "invited" | "inactive" | "incomplete" | "unknown"
export type SettingsSecurityState = "available" | "attention" | "unavailable" | "unknown"
export type SettingsDensity = "comfortable" | "compact"
export type SettingsNavigationOrientation = "adaptive" | "horizontal" | "vertical"

export interface SettingsNavigationItem {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  hidden?: boolean
  href?: string
}

export interface SettingsActionPresentation {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  onSelect?: () => void
  disabled?: boolean
  loading?: boolean
  confirmationRequired?: boolean
}

export interface SettingsScheduleSlotPresentation { id: string; openTime: string; closeTime: string; error?: React.ReactNode }
export interface SettingsScheduleDayPresentation { id: string; label: React.ReactNode; enabled: boolean; openTime?: string; closeTime?: string; slots?: SettingsScheduleSlotPresentation[]; errors?: React.ReactNode; state?: SettingsScheduleDayState }
export interface SettingsServiceOptionPresentation { id: string; label: React.ReactNode; description?: React.ReactNode; enabled: boolean; disabled?: boolean; icon?: React.ReactNode }
export interface SettingsPaymentMethodPresentation { id: string; name: React.ReactNode; provider?: React.ReactNode; logo?: React.ReactNode; status?: React.ReactNode; description?: React.ReactNode; maskedIdentifier?: React.ReactNode; enabled?: boolean; onEnabledChange?: (enabled: boolean) => void; order?: React.ReactNode; disabled?: boolean; loading?: boolean; actions?: React.ReactNode }
export interface SettingsTeamMemberPresentation { id: string; name: React.ReactNode; email?: React.ReactNode; role?: React.ReactNode; status?: React.ReactNode; state?: SettingsTeamMemberState; actions?: React.ReactNode }
export interface SettingsRolePresentation { id: string; label: React.ReactNode; description?: React.ReactNode }
export interface SettingsPermissionPresentation { id: string; label: React.ReactNode; description?: React.ReactNode }

export const SETTINGS_VIEWPORT_PROFILES = DASHBOARD_VIEWPORT_PROFILES
export const SETTINGS_REQUIRED_TEST_WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440] as const
export const SETTINGS_CONTENT_WIDTHS = { ...DASHBOARD_CONTENT_WIDTHS, form: 800, navigation: 240 } as const
export const SETTINGS_TOUCH_TARGETS = { ...DASHBOARD_TOUCH_TARGETS, sensitiveAction: 44, field: 44 } as const
export const SETTINGS_CONTRAST_RATIOS = DASHBOARD_CONTRAST_RATIOS
export const SETTINGS_MOTION = { ...DASHBOARD_MOTION, section: 200, feedback: 200 } as const
export const SETTINGS_FOUNDATION_CLASSES = { focusVisible: "dashboard-focus-visible", reducedMotion: "dashboard-reduced-motion" } as const
