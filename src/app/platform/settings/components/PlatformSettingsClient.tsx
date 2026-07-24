"use client"

import * as React from "react"
import { usePlatform } from "@/contexts/platform-context"
import { useToast } from "@/hooks/use-toast"
import { PlatformLoadingState, PlatformPage } from "@/components/platform-ui"
import { PlatformSettingsView } from "./PlatformSettingsView"

export default function PlatformSettingsPage() {
  const { toast } = useToast()
  const { settings, isLoading, updateSettings } = usePlatform()
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    name: "",
    logoUrl: "",
    supportEmail: "",
    primaryColor: "",
    secondaryColor: "",
    maintenanceMode: false,
    marketplaceHero: settings.marketplaceHero,
    publicFooter: settings.publicFooter,
  })

  React.useEffect(() => {
    setFormData({
      name: settings.name || "",
      logoUrl: settings.logoUrl || "",
      supportEmail: settings.supportEmail || "",
      primaryColor: settings.primaryColor || "",
      secondaryColor: settings.secondaryColor || "",
      maintenanceMode: settings.maintenanceMode || false,
      marketplaceHero: settings.marketplaceHero,
      publicFooter: settings.publicFooter,
    })
  }, [settings])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)

    try {
      await updateSettings({
        ...settings,
        ...formData,
      })
      toast({
        title: "Configuration mise à jour",
        description: "Le branding de la plateforme a été actualisé.",
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSetPlatformLogo = async (logoUrl: string) => {
    const nextSettings = {
      ...settings,
      ...formData,
      logoUrl,
    }

    setFormData((current) => ({ ...current, logoUrl }))
    await updateSettings(nextSettings)
  }

  const handleClearPlatformLogo = async () => {
    const nextSettings = {
      ...settings,
      ...formData,
      logoUrl: "",
    }

    setFormData((current) => ({ ...current, logoUrl: "" }))
    await updateSettings(nextSettings)
  }

  const handleSetMarketplaceHeroCover = async (coverImageUrl: string) => {
    const marketplaceHero = {
      ...formData.marketplaceHero,
      coverImageUrl,
    }
    const nextSettings = {
      ...settings,
      ...formData,
      marketplaceHero,
    }

    setFormData((current) => ({ ...current, marketplaceHero }))
    await updateSettings(nextSettings)
  }

  const handleClearMarketplaceHeroCover = async () => {
    const marketplaceHero = {
      ...formData.marketplaceHero,
      coverImageUrl: "",
    }
    const nextSettings = {
      ...settings,
      ...formData,
      marketplaceHero,
    }

    setFormData((current) => ({ ...current, marketplaceHero }))
    await updateSettings(nextSettings)
  }

  if (isLoading) {
    return <PlatformPage width="reading"><PlatformLoadingState label="Chargement des paramètres plateforme" /></PlatformPage>
  }

  return <PlatformSettingsView value={formData} activeLogoUrl={settings.logoUrl} activeMarketplaceHeroCoverUrl={settings.marketplaceHero.coverImageUrl} platformName={settings.name} saving={loading} onSubmit={handleSave} onChange={setFormData} onSetLogo={(media) => handleSetPlatformLogo(media.url)} onClearActiveLogo={handleClearPlatformLogo} onSetMarketplaceHeroCover={(media) => handleSetMarketplaceHeroCover(media.url)} onClearMarketplaceHeroCover={handleClearMarketplaceHeroCover} />
}
