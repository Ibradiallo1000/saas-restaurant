"use client"

import * as React from "react"

export type ThemeMode = "light" | "dark"

const THEME_STORAGE_KEY = "saas-theme"

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light"

    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return storedTheme === "dark" ? "dark" : "light"
  })

  const setTheme = React.useCallback((nextTheme: ThemeMode) => {
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    setThemeState(nextTheme)
  }, [])

  React.useLayoutEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    setTheme(storedTheme === "dark" ? "dark" : "light")
  }, [setTheme])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [setTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.")
  }

  return context
}
