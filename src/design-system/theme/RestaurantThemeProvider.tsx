"use client"

import type * as React from "react"

export function RestaurantThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
