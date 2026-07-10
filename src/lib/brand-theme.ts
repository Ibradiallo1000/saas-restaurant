export const DEFAULT_BRAND_PRIMARY = "#10B981"
export const DEFAULT_BRAND_SECONDARY = "#FFFFFF"

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
