export const DASHBOARD_VIEWPORT_PROFILES = {
  compact: { minWidth: 320, maxWidth: 359, gutter: 12, columns: 1, gap: 8 },
  mobile: { minWidth: 360, maxWidth: 767, gutter: 16, columns: 1, gap: 12 },
  tablet: { minWidth: 768, maxWidth: 1023, gutter: 24, columns: 2, gap: 16 },
  desktop: { minWidth: 1024, maxWidth: 1439, gutter: 32, columns: 4, gap: 16 },
  wide: { minWidth: 1440, maxWidth: null, gutter: 32, columns: 4, gap: 16 },
} as const

export const DASHBOARD_REQUIRED_TEST_WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024, 1440] as const
export const DASHBOARD_CONTENT_WIDTHS = { default: 1440, reading: 960, dialog: 640, drawer: 480 } as const
export const DASHBOARD_TOUCH_TARGETS = { absoluteMinimum: 40, recommended: 44 } as const
export const DASHBOARD_CONTRAST_RATIOS = { normalText: 4.5, largeText: 3, graphic: 3, focus: 3 } as const
export const DASHBOARD_MOTION = { hover: 150, focus: 120, loading: 1200, chart: 300, drawer: 250, dialog: 200 } as const
export const DASHBOARD_CHART_COLORS = [
  "var(--dashboard-chart-1)", "var(--dashboard-chart-2)", "var(--dashboard-chart-3)",
  "var(--dashboard-chart-4)", "var(--dashboard-chart-5)", "var(--dashboard-chart-6)",
] as const
export const DASHBOARD_FOUNDATION_CLASSES = {
  focusVisible: "dashboard-focus-visible",
  tabularNumbers: "dashboard-tabular-nums",
  reducedMotion: "dashboard-reduced-motion",
} as const
