
"use client"

/**
 * @fileOverview Page d'initialisation de l'établissement.
 * STRICTEMENT réservée aux SuperAdmins de la plateforme.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc, useFirebase } from "@/firebase"
import { doc, getDoc } from "firebase/firestore"
import { RestaurantService } from "@/services/restaurant.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Building2, Save, Loader2, ShieldAlert } from "lucide-react"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"

export default function SetupPage() {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  
  // Vérification si l'utilisateur est un SuperAdmin de la plateforme
  const platformUserRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  
  const { data: platformProfile, isLoading: isPlatformLoading } = useDoc(platformUserRef)

  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    country: "CI",
    currency: "XOF",
    ownerEmail: "", // L'email de l'Owner qui recevra l'accès
  })

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !db || !platformProfile) return

    setLoading(true)
    const restaurantService = new RestaurantService(db)

    try {
      // Le SuperAdmin crée le restaurant et définit l'email de l'Owner
      await restaurantService.createRestaurantForOwner(formData.ownerEmail, formData)

      toast({
        title: "Succès",
        description: `L'établissement ${formData.name} a été créé et rattaché à ${formData.ownerEmail}.`,
      })
      
      setFormData({ name: "", slug: "", country: "CI", currency: "XOF", ownerEmail: "" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  if (isUserLoading || isPlatformLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Si l'utilisateur n'est pas SuperAdmin, on bloque l'accès
  if (!platformProfile || platformProfile.role !== ROLES.SUPER_ADMIN) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6 animate-in fade-in duration-500">
        <div className="p-10 bg-destructive/10 text-destructive rounded-3xl border border-destructive/20 flex flex-col items-center gap-6">
          <ShieldAlert className="h-16 w-16" />
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase italic">Accès Refusé</h1>
            <p className="text-sm opacity-80">
              Seuls les administrateurs de la plateforme GastronomeAI peuvent créer de nouveaux établissements.
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full">
            Retour au Dashboard
          </Button>
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
            <CardTitle className="text-2xl font-black italic uppercase">Créer un Restaurant</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80 text-xs">
            Espace SuperAdmin : Provisionnez une nouvelle instance SaaS.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateRestaurant}>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email du Propriétaire (Owner)</Label>
              <Input 
                id="ownerEmail" 
                type="email"
                placeholder="email@proprietaire.com" 
                required 
                value={formData.ownerEmail}
                onChange={e => setFormData({...formData, ownerEmail: e.target.value})}
              />
              <p className="text-[10px] text-muted-foreground italic">
                Cet utilisateur sera promu Owner lors de sa première connexion.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'Établissement</Label>
              <Input 
                id="name" 
                placeholder="Ex: Le Palmier Royal" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
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
                <Label>Pays</Label>
                <Select 
                  defaultValue={formData.country} 
                  onValueChange={v => setFormData({...formData, country: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                    <SelectItem value="SN">Sénégal</SelectItem>
                    <SelectItem value="BJ">Bénin</SelectItem>
                    <SelectItem value="CM">Cameroun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-secondary/30">
            <Button type="submit" className="w-full h-12 font-bold uppercase italic" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Générer l'instance
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
