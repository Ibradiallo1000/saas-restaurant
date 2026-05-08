"use client"

import * as React from "react"

import { useRestaurant } from "@/design-system/context/RestaurantContext"

const DEFAULT_PRIMARY = "#f97316"
const DEFAULT_SECONDARY = "#122f24"

export function RestaurantThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { restaurant } = useRestaurant()

  React.useEffect(() => {
    const primary = sanitizeHexColor(restaurant?.theme?.primary) ?? DEFAULT_PRIMARY
    const secondary =
      sanitizeHexColor(restaurant?.theme?.secondary) ?? DEFAULT_SECONDARY
    const root = document.documentElement

    root.style.setProperty("--color-primary", primary)
    root.style.setProperty("--color-secondary", secondary)
    root.style.setProperty("--primary", primary)
    root.style.setProperty("--primary-rgb", hexToRgbString(primary))
    root.style.setProperty("--ring", primary)
    root.style.setProperty("--chart-1", hexToHsl(primary))
    root.style.setProperty("--chart-2", hexToHsl(secondary))
  }, [restaurant?.theme?.primary, restaurant?.theme?.secondary])

  return <>{children}</>
}

function sanitizeHexColor(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null
}

function hexToHsl(hex: string) {
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

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(
    l * 100
  )}%`
}

function hexToRgbString(hex: string) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ].join(" ")
}
