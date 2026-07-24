import type * as React from "react"
import {
  DASHBOARD_CHART_COLORS,
  DASHBOARD_CONTENT_WIDTHS,
  DASHBOARD_CONTRAST_RATIOS,
  DASHBOARD_MOTION,
  DASHBOARD_REQUIRED_TEST_WIDTHS,
  DASHBOARD_TOUCH_TARGETS,
  DASHBOARD_VIEWPORT_PROFILES,
} from "@/components/dashboard-ui"

export type ReportDataQuality = "complete" | "partial" | "estimated" | "stale" | "unavailable" | "unknown"
export type ReportDataFreshness = "live" | "recent" | "delayed" | "historical" | "unknown"
export type ReportComparison = "positive" | "negative" | "neutral" | "unavailable"
export type ReportMetricState = "ready" | "loading" | "empty" | "error" | "unavailable"
export type ReportPeriodPreset = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom"
export type ReportChartType = "line" | "bar" | "area" | "donut" | "pie" | "composed" | "other"
export type ReportInsightSeverity = "info" | "positive" | "warning" | "critical"
export type ReportScope = "restaurant" | "location" | "team" | "channel" | "product" | "custom"
export type ReportDensity = "comfortable" | "compact"
export type ReportSortDirection = "ascending" | "descending" | "none"

export interface ReportPeriodOption { id: ReportPeriodPreset | string; label: string; disabled?: boolean }
export interface ReportScopeOption { id: string; label: string; description?: string; disabled?: boolean }
export interface ReportSeriesPresentation { id: string; label: React.ReactNode; color?: string; value?: React.ReactNode; description?: React.ReactNode }
export interface ReportInsightPresentation { id: string; title: React.ReactNode; description?: React.ReactNode; severity?: ReportInsightSeverity; value?: React.ReactNode; action?: React.ReactNode }
export interface ReportExportPresentation { id: string; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean; onSelect: () => void }
export interface ReportTableColumnPresentation<Row> {
  id: string
  header: React.ReactNode
  cell: (row: Row) => React.ReactNode
  align?: "left" | "center" | "right"
  sortable?: boolean
  numeric?: boolean
  className?: string
}
export interface ReportSortPresentation { columnId: string; direction: ReportSortDirection }

export const REPORTS_VIEWPORT_PROFILES = DASHBOARD_VIEWPORT_PROFILES
export const REPORTS_REQUIRED_TEST_WIDTHS = DASHBOARD_REQUIRED_TEST_WIDTHS
export const REPORTS_CONTENT_WIDTHS = DASHBOARD_CONTENT_WIDTHS
export const REPORTS_TOUCH_TARGETS = DASHBOARD_TOUCH_TARGETS
export const REPORTS_CONTRAST_RATIOS = DASHBOARD_CONTRAST_RATIOS
export const REPORTS_MOTION = DASHBOARD_MOTION
export const REPORTS_CHART_COLORS = DASHBOARD_CHART_COLORS

