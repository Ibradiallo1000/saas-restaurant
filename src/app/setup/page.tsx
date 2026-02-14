"use client"

/**
 * @fileOverview Page d'initialisation de l'établissement.
 * Supporte désormais la création de plusieurs restaurants pour un même Owner.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc, useFirebase } from "@/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { RestaurantService } from "@/services/restaurant.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Building2, Save, Loader2, PlusCircle, CheckCircle2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"

export default function SetupPage() {
  const { t } = useTranslation()
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    country: "CI",
    currency: "XOF"
  })

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !db) return

    setLoading(true)
    const restaurantService = new RestaurantService(db)

    try {
      const newRestaurantId = await restaurantService.createRestaurant(user.uid, user.email || '', formData)
      
      // Si c'est le premier restaurant, on l'active tout de suite pour l'utilisateur
      if (!profile?.restaurantId) {
        await updateDoc(doc(db, COLLECTION_NAMES.USERS, user.uid), {
          restaurantId: newRestaurantId
        })
      }

      toast({
        title: t.common.success,
        description: "Établissement créé avec succès.",
      })
      
      router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.common.error,
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Si l'utilisateur est déjà Owner et qu'on ne force pas le formulaire
  if (profile?.role === ROLES.OWNER && !showForm) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-in fade-in duration-500">
        <div className="space-y-2">
          <h1 className="text-4xl font-black italic uppercase text-primary">Gestion Multi-Établissement</h1>
          <p className="text-muted-foreground">Vous êtes déjà propriétaire. Souhaitez-vous ajouter un nouvel établissement ?</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-none shadow-xl bg-card hover:ring-2 ring-primary transition-all cursor-pointer flex flex-col items-center justify-center gap-4" onClick={() => router.push("/dashboard")}>
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <div className="text-center">
              <p className="font-bold">Accéder au Dashboard</p>
              <p className="text-xs text-muted-foreground">Gérer mon restaurant actuel</p>
            </div>
          </Card>
          
          <Card className="p-6 border-2 border-dashed border-muted hover:border-primary transition-all cursor-pointer flex flex-col items-center justify-center gap-4" onClick={() => setShowForm(true)}>
            <PlusCircle className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-bold">Créer un autre restaurant</p>
              <p className="text-xs text-muted-foreground">Ajouter une nouvelle instance SaaS</p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-10 animate-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8" />
            <CardTitle className="text-2xl font-black italic uppercase">Nouvel Établissement</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            Initialisez une nouvelle unité commerciale GastronomeAI.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateRestaurant}>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du Restaurant / Hôtel</Label>
              <Input 
                id="name" 
                placeholder="Ex: Le Palmier Royal" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t.setup.slug}</Label>
              <Input 
                id="slug" 
                placeholder="le-palmier-royal" 
                required 
                value={formData.slug}
                onChange={e => setFormData({...formData, slug: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.setup.country}</Label>
                <Select 
                  defaultValue={formData.country} 
                  onValueChange={v => setFormData({...formData, country: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BJ">Bénin</SelectItem>
                    <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                    <SelectItem value="SN">Sénégal</SelectItem>
                    <SelectItem value="CM">Cameroun</SelectItem>
                    <SelectItem value="TG">Togo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.setup.currency}</Label>
                <Select 
                  defaultValue={formData.currency} 
                  onValueChange={v => setFormData({...formData, currency: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XOF">FCFA (XOF)</SelectItem>
                    <SelectItem value="XAF">FCFA (XAF)</SelectItem>
                    <SelectItem value="GHS">Cedi (GHS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-secondary/30 flex gap-2">
            {profile?.role === ROLES.OWNER && (
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            )}
            <Button type="submit" className="flex-1 h-12 font-bold" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t.setup.submit}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}