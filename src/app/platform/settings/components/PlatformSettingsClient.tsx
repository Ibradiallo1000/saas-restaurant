"use client"

import * as React from "react"
import { Globe, Loader2, Mail, Palette, Save, Settings, Shield } from "lucide-react"

import { MediaSelector } from "@/components/platform/MediaSelector"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { usePlatform } from "@/contexts/platform-context"
import { useToast } from "@/hooks/use-toast"

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
  })

  React.useEffect(() => {
    setFormData({
      name: settings.name || "",
      logoUrl: settings.logoUrl || "",
      supportEmail: settings.supportEmail || "",
      primaryColor: settings.primaryColor || "",
      secondaryColor: settings.secondaryColor || "",
      maintenanceMode: settings.maintenanceMode || false,
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

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary p-3 text-primary-foreground">
          <Settings className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">
            Configuration SaaS
          </h1>
          <p className="font-medium text-muted-foreground">
            Personnalisez l'identité visuelle de votre plateforme {settings.name}.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-8 md:grid-cols-2">
        <Card className="overflow-hidden border-none shadow-2xl md:col-span-2">
          <CardHeader className="bg-primary p-8 text-primary-foreground">
            <CardTitle className="text-2xl font-black italic uppercase">
              Identité de marque
            </CardTitle>
            <CardDescription className="text-white/80">
              Ces paramètres alimentent la sidebar, le header et les écrans plateforme.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-8 md:grid-cols-2">
            <div className="md:col-span-2">
              <MediaSelector
                type="logo"
                label="Logo de la plateforme"
                description="Utilisé globalement dans l'interface d'administration."
                value={formData.logoUrl}
                onChange={(logoUrl) => setFormData({ ...formData, logoUrl: logoUrl ?? "" })}
                activeUrl={settings.logoUrl}
                onSetActive={(media) => handleSetPlatformLogo(media.url)}
                onDeleteActive={handleClearPlatformLogo}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> Nom de la plateforme
              </Label>
              <Input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="h-12 rounded-xl border-none bg-secondary/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email de support
              </Label>
              <Input
                value={formData.supportEmail}
                onChange={(event) => setFormData({ ...formData, supportEmail: event.target.value })}
                className="h-12 rounded-xl border-none bg-secondary/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> Couleur primaire (HEX)
              </Label>
              <div className="flex gap-2">
                <div className="h-12 w-12 rounded-xl border" style={{ backgroundColor: formData.primaryColor }} />
                <Input
                  value={formData.primaryColor}
                  onChange={(event) => setFormData({ ...formData, primaryColor: event.target.value })}
                  className="h-12 flex-1 rounded-xl border-none bg-secondary/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> Couleur secondaire (HEX)
              </Label>
              <div className="flex gap-2">
                <div className="h-12 w-12 rounded-xl border" style={{ backgroundColor: formData.secondaryColor }} />
                <Input
                  value={formData.secondaryColor}
                  onChange={(event) => setFormData({ ...formData, secondaryColor: event.target.value })}
                  className="h-12 flex-1 rounded-xl border-none bg-secondary/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
              <Shield className="h-5 w-5 text-primary" /> Sécurité & état
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
              <div className="space-y-0.5">
                <Label className="font-bold">Mode maintenance</Label>
                <p className="text-[10px] italic text-muted-foreground">
                  Désactive l'accès aux dashboards restaurants.
                </p>
              </div>
              <Switch
                checked={formData.maintenanceMode}
                onCheckedChange={(checked) => setFormData({ ...formData, maintenanceMode: checked })}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="h-12 w-full font-bold uppercase italic shadow-lg" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer les modifications
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
