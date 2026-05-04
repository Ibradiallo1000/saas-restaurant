"use client"

import * as React from "react"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"

import { useFirestore, useUser } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import type { PlatformSettings } from "@/types"

const SETTINGS_DOC_ID = "main"

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  name: "GastronomeAI",
  logoUrl: "",
  primaryColor: "#f97316",
  secondaryColor: "#f5f1e8",
  supportEmail: "",
  supportPhone: "",
  supportWhatsapp: "",
  maintenanceMode: false,
  defaultGraceDays: 7,
}

interface PlatformContextValue {
  settings: PlatformSettings
  isLoading: boolean
  updateSettings: (nextSettings: PlatformSettings) => Promise<void>
  refreshSettings: () => Promise<void>
}

const PlatformContext = React.createContext<PlatformContextValue | null>(null)
let cachedSettings: PlatformSettings | null = null
let cachedSettingsPromise: Promise<PlatformSettings> | null = null

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [settings, setSettings] = React.useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS)
  const [isLoading, setIsLoading] = React.useState(true)
  const initializedForUidRef = React.useRef<string | null | undefined>(undefined)

  const applyBranding = React.useCallback((nextSettings: PlatformSettings) => {
    const root = document.documentElement
    const primary = sanitizeHexColor(nextSettings.primaryColor) ?? DEFAULT_PLATFORM_SETTINGS.primaryColor
    const primaryRgb = hexToRgbString(primary)
    const secondary = sanitizeHexColor(nextSettings.secondaryColor) ?? DEFAULT_PLATFORM_SETTINGS.secondaryColor

    root.style.setProperty("--color-primary", primary)
    root.style.setProperty("--primary", primary)

    if (primaryRgb) {
      root.style.setProperty("--primary-rgb", primaryRgb)
      root.style.setProperty("--ring", primary)
      root.style.setProperty("--sidebar-primary", primary)
      root.style.setProperty("--sidebar-ring", primary)
    }

    root.style.setProperty("--color-secondary", secondary)
  }, [])

  const refreshSettings = React.useCallback(async () => {
    if (!db || !user) {
      setSettings(DEFAULT_PLATFORM_SETTINGS)
      applyBranding(DEFAULT_PLATFORM_SETTINGS)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const nextSettings = cachedSettings ?? (await getCachedSettings(db))

      setSettings(nextSettings)
      applyBranding(nextSettings)
    } catch (error) {
      console.error("Erreur settings:", error)
      setSettings(DEFAULT_PLATFORM_SETTINGS)
      applyBranding(DEFAULT_PLATFORM_SETTINGS)
    } finally {
      setIsLoading(false)
    }
  }, [applyBranding, db, user])

  const updateSettings = React.useCallback(
    async (nextSettings: PlatformSettings) => {
      if (!db) throw new Error("Firestore indisponible.")

      const normalizedSettings = {
        ...DEFAULT_PLATFORM_SETTINGS,
        ...nextSettings,
        defaultGraceDays: normalizeGraceDays(nextSettings.defaultGraceDays),
      }

      await setDoc(
        doc(db, COLLECTION_NAMES.PLATFORM, SETTINGS_DOC_ID),
        {
          ...normalizedSettings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      cachedSettings = normalizedSettings
      setSettings(normalizedSettings)
      applyBranding(normalizedSettings)
    },
    [applyBranding, db]
  )

  React.useEffect(() => {
    if (isUserLoading) return

    const uid = user?.uid ?? null

    if (initializedForUidRef.current === uid) return

    initializedForUidRef.current = uid

    if (!uid) {
      setSettings(DEFAULT_PLATFORM_SETTINGS)
      applyBranding(DEFAULT_PLATFORM_SETTINGS)
      setIsLoading(false)
      return
    }

    refreshSettings()
  }, [applyBranding, isUserLoading, refreshSettings, user?.uid])

  const value = React.useMemo<PlatformContextValue>(
    () => ({
      settings,
      isLoading,
      updateSettings,
      refreshSettings,
    }),
    [isLoading, refreshSettings, settings, updateSettings]
  )

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  const context = React.useContext(PlatformContext)

  if (!context) {
    throw new Error("usePlatform must be used within PlatformProvider.")
  }

  return context
}

function sanitizeHexColor(hex: string): string | null {
  const normalized = hex.trim().replace("#", "")
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized

  return /^[0-9a-fA-F]{6}$/.test(fullHex) ? `#${fullHex}` : null
}

function hexToRgbString(hex: string): string | null {
  const normalized = sanitizeHexColor(hex)

  if (!normalized) return null

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ].join(" ")
}

function normalizeGraceDays(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_PLATFORM_SETTINGS.defaultGraceDays
}

async function getCachedSettings(db: ReturnType<typeof useFirestore>): Promise<PlatformSettings> {
  if (!db) return DEFAULT_PLATFORM_SETTINGS

  if (!cachedSettingsPromise) {
    cachedSettingsPromise = getDoc(doc(db, COLLECTION_NAMES.PLATFORM, SETTINGS_DOC_ID))
      .then((snapshot) => {
        const remoteSettings = snapshot.exists() ? (snapshot.data() as Partial<PlatformSettings>) : {}

        cachedSettings = {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...remoteSettings,
        }

        return cachedSettings
      })
      .finally(() => {
        cachedSettingsPromise = null
      })
  }

  return cachedSettingsPromise
}
