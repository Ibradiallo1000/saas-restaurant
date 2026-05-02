"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/contexts/theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
      onClick={toggleTheme}
      aria-label={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
