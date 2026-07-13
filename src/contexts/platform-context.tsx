"use client"

import * as React from "react"
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"

import { useFirestore } from "@/firebase"
import {
  applyBrandTheme,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  getBrandPrimary,
  getBrandSecondary,
  sanitizeHexColor,
} from "@/lib/brand-theme"
import { COLLECTION_NAMES } from "@/lib/constants"
import type { PlatformSettings } from "@/types"

const SETTINGS_DOC_ID = "default"

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  name: "Plateforme",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: DEFAULT_BRAND_PRIMARY,
  secondaryColor: DEFAULT_BRAND_SECONDARY,
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

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const [settings, setSettings] = React.useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS)
  const [isLoading, setIsLoading] = React.useState(true)

  const applyBranding = React.useCallback((nextSettings: PlatformSettings) => {
    const primary = getBrandPrimary(nextSettings.primaryColor)
    const secondary = getBrandSecondary(nextSettings.secondaryColor)
    const root = document.documentElement

    applyBrandTheme(primary, { persist: true })
    root.style.setProperty("--color-secondary", secondary)
  }, [])

  const refreshSettings = React.useCallback(async () => {
    if (!db) {
      setSettings(DEFAULT_PLATFORM_SETTINGS)
      applyBranding(DEFAULT_PLATFORM_SETTINGS)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const snapshot = await getDoc(doc(db, COLLECTION_NAMES.PLATFORM_SETTINGS, SETTINGS_DOC_ID))
      const nextSettings = normalizePlatformSettings(
        snapshot.exists() ? (snapshot.data() as Partial<PlatformSettings>) : {}
      )
      setSettings(nextSettings)
      applyBranding(nextSettings)
    } catch (error) {
      console.error("Erreur settings:", error)
      setSettings(DEFAULT_PLATFORM_SETTINGS)
      applyBranding(DEFAULT_PLATFORM_SETTINGS)
    } finally {
      setIsLoading(false)
    }
  }, [applyBranding, db])

  const updateSettings = React.useCallback(
    async (nextSettings: PlatformSettings) => {
      if (!db) throw new Error("Firestore indisponible.")

      const normalizedSettings = normalizePlatformSettings(nextSettings)

      await setDoc(
        doc(db, COLLECTION_NAMES.PLATFORM_SETTINGS, SETTINGS_DOC_ID),
        {
          ...normalizedSettings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      setSettings(normalizedSettings)
      applyBranding(normalizedSettings)
    },
    [applyBranding, db]
  )

  React.useEffect(() => {
    if (!db) {
      setSettings(DEFAULT_PLATFORM_SETTINGS)
      applyBranding(DEFAULT_PLATFORM_SETTINGS)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const unsubscribe = onSnapshot(
      doc(db, COLLECTION_NAMES.PLATFORM_SETTINGS, SETTINGS_DOC_ID),
      (snapshot) => {
        const nextSettings = normalizePlatformSettings(
          snapshot.exists() ? (snapshot.data() as Partial<PlatformSettings>) : {}
        )
        setSettings(nextSettings)
        applyBranding(nextSettings)
        setIsLoading(false)
      },
      (error) => {
        console.error("Erreur settings:", error)
        setSettings(DEFAULT_PLATFORM_SETTINGS)
        applyBranding(DEFAULT_PLATFORM_SETTINGS)
        setIsLoading(false)
      }
    )

    return unsubscribe
  }, [applyBranding, db])

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

function normalizeGraceDays(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_PLATFORM_SETTINGS.defaultGraceDays
}

function normalizePlatformSettings(settings: Partial<PlatformSettings>): PlatformSettings {
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...settings,
    name: settings.name?.trim() || DEFAULT_PLATFORM_SETTINGS.name,
    logoUrl: settings.logoUrl || "",
    faviconUrl: settings.faviconUrl || "",
    primaryColor: sanitizeHexColor(settings.primaryColor || "") ?? DEFAULT_BRAND_PRIMARY,
    secondaryColor: sanitizeHexColor(settings.secondaryColor || "") ?? DEFAULT_BRAND_SECONDARY,
    defaultGraceDays: normalizeGraceDays(settings.defaultGraceDays ?? DEFAULT_PLATFORM_SETTINGS.defaultGraceDays),
  }
}
