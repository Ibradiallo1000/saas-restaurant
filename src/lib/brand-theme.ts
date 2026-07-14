export const BRAND_PRIMARY_STORAGE_KEY = "oordera:brand-primary"
export const DEFAULT_BRAND_PRIMARY = "#f97316"
export const DEFAULT_BRAND_SECONDARY = "#FFFFFF"
export const ACTION_FOREGROUND_DARK = "#0b0f14"
export const ACTION_FOREGROUND_LIGHT = "#ffffff"
export const ACCESSIBLE_FOCUS_RING = "#ea580c"

const LEGACY_BRAND_STORAGE_KEYS = [
  "oordera-brand-primary",
  "oordera:primary-color",
  "oordera:primaryColor",
  "oordera:theme-primary",
  "oordera:brandColor",
]

export function sanitizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null

  const normalized = value.trim().replace("#", "")
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized

  return /^[0-9a-fA-F]{6}$/.test(fullHex) ? `#${fullHex}` : null
}

export function getBrandPrimary(value: unknown) {
  return sanitizeHexColor(value) ?? DEFAULT_BRAND_PRIMARY
}

export function getBrandSecondary(value: unknown) {
  return sanitizeHexColor(value) ?? DEFAULT_BRAND_SECONDARY
}

export function hexToRgbString(value: unknown): string {
  const hex = getBrandPrimary(value)

  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ].join(" ")
}

function hexToRgbTuple(value: unknown): [number, number, number] {
  const hex = getBrandPrimary(value)
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

function relativeLuminance(value: unknown): number {
  const channels = hexToRgbTuple(value).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function getContrastRatio(background: unknown, foreground: unknown): number {
  const backgroundLuminance = relativeLuminance(background)
  const foregroundLuminance = relativeLuminance(foreground)
  const lighter = Math.max(backgroundLuminance, foregroundLuminance)
  const darker = Math.min(backgroundLuminance, foregroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getAccessibleActionForeground(value: unknown): string {
  const primary = getBrandPrimary(value)
  const darkContrast = getContrastRatio(primary, ACTION_FOREGROUND_DARK)
  const lightContrast = getContrastRatio(primary, ACTION_FOREGROUND_LIGHT)
  return darkContrast >= lightContrast ? ACTION_FOREGROUND_DARK : ACTION_FOREGROUND_LIGHT
}

function mixHexColors(background: unknown, foreground: unknown, foregroundWeight: number): string {
  const backgroundRgb = hexToRgbTuple(background)
  const foregroundRgb = hexToRgbTuple(foreground)
  const weight = Math.min(1, Math.max(0, foregroundWeight))
  const channels = backgroundRgb.map((channel, index) =>
    Math.round(channel * (1 - weight) + foregroundRgb[index] * weight)
  )

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

export function hexToHslString(value: unknown): string {
  const hex = getBrandPrimary(value)
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0)
    } else if (max === g) {
      h = (b - r) / d + 2
    } else {
      h = (r - g) / d + 4
    }

    h /= 6
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function readCachedBrandPrimary(): string | null {
  if (typeof window === "undefined") return null

  try {
    return sanitizeHexColor(window.localStorage.getItem(BRAND_PRIMARY_STORAGE_KEY))
  } catch {
    return null
  }
}

export function cacheBrandPrimary(value: unknown) {
  if (typeof window === "undefined") return

  const color = getBrandPrimary(value)

  try {
    window.localStorage.setItem(BRAND_PRIMARY_STORAGE_KEY, color)
    LEGACY_BRAND_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // localStorage can be unavailable in private browsing contexts.
  }
}

export function applyBrandTheme(value: unknown, options: { persist?: boolean } = {}) {
  if (typeof document === "undefined") return getBrandPrimary(value)

  const primary = getBrandPrimary(value)
  const primaryRgb = hexToRgbString(primary)
  const actionForeground = getAccessibleActionForeground(primary)
  const actionForegroundRgb = hexToRgbString(actionForeground)
  const actionHover = mixHexColors(primary, actionForeground, 0.08)
  const actionActive = mixHexColors(primary, actionForeground, 0.14)
  const root = document.documentElement

  root.style.setProperty("--brand-primary", primary)
  root.style.setProperty("--brand-primary-rgb", primaryRgb)
  root.style.setProperty("--brand-primary-soft", `rgb(${primaryRgb} / 0.10)`)
  root.style.setProperty("--action-primary-bg", primary)
  root.style.setProperty("--action-primary-fg", actionForeground)
  root.style.setProperty("--action-primary-fg-rgb", actionForegroundRgb)
  root.style.setProperty("--action-primary-hover", actionHover)
  root.style.setProperty("--action-primary-active", actionActive)
  root.style.setProperty("--focus-ring", ACCESSIBLE_FOCUS_RING)

  // Transitional aliases: keep every existing consumer working during migration.
  root.style.setProperty("--color-primary", "var(--action-primary-bg)")
  root.style.setProperty("--primary", "var(--action-primary-bg)")
  root.style.setProperty("--primary-rgb", primaryRgb)
  root.style.setProperty("--primary-foreground", "var(--action-primary-fg)")
  root.style.setProperty("--primary-foreground-rgb", actionForegroundRgb)
  root.style.setProperty("--ring", "var(--focus-ring)")
  root.style.setProperty("--sidebar-primary", "var(--action-primary-bg)")
  root.style.setProperty("--sidebar-primary-foreground", "var(--action-primary-fg)")
  root.style.setProperty("--sidebar-ring", "var(--focus-ring)")
  root.style.setProperty("--chart-1", hexToHslString(primary))
  root.style.setProperty("--public-card-border", `rgb(${primaryRgb} / 0.14)`)
  root.style.setProperty("--public-pattern-color", `rgb(${primaryRgb})`)
  root.dataset.themeReady = "true"

  updateThemeColorMeta(primary)

  if (options.persist) {
    cacheBrandPrimary(primary)
  }

  return primary
}

export function updateThemeColorMeta(color: unknown) {
  if (typeof document === "undefined") return

  const primary = getBrandPrimary(color)
  const selectors = [
    'meta[name="theme-color"]',
    'meta[name="msapplication-TileColor"]',
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  ]

  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLMetaElement>(selector).forEach((element) => {
      element.setAttribute("content", primary)
    })
  })
}
