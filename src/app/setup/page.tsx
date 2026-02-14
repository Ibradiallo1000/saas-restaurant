
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore, useUser, useDoc } from "@/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Building2, Save, Loader2, ShieldCheck } from "lucide-react"

export default function SetupPage() {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  // Fetch current user profile
  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    const r = doc(db, "users", user.uid)
    return Object.assign(r, { __memo: true })
  }, [db, user])
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    country: "FR",
    currency: "EUR"
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
    const restaurantId = crypto.randomUUID()

    try {
      // 1. Create the Restaurant document
      const restaurantRef = doc(db, "restaurants", restaurantId)
      await setDoc(restaurantRef, {
        id: restaurantId,
        name: formData.name,
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        country: formData.country,
        currency: formData.currency,
        planId: "free_tier",
        active: true,
        createdAt: serverTimestamp()
      })

      // 2. Create/Update the User profile with restaurantId and role
      const userRef = doc(db, "users", user.uid)
      await setDoc(userRef, {
        id: user.uid,
        restaurantId: restaurantId,
        role: "owner",
        name: user.displayName || "Admin",
        email: user.email,
        active: true,
        createdAt: serverTimestamp()
      }, { merge: true })

      toast({
        title: "Configuration réussie",
        description: "Votre établissement a été initialisé avec succès.",
      })
      
      router.push("/")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de configuration",
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

  if (profile?.restaurantId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6" />
          <p className="font-medium text-sm">Ce compte est déjà associé à un établissement.</p>
        </div>
        <Button onClick={() => router.push("/")} variant="outline" className="w-full">
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-10 animate-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8" />
            <CardTitle className="text-2xl font-black italic uppercase">Setup Initial</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            Configurez votre premier établissement pour activer la fondation SaaS.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateRestaurant}>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du Restaurant / Hôtel</Label>
              <Input 
                id="name" 
                placeholder="Ex: Le Petit Bistro" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL personnalisée)</Label>
              <Input 
                id="slug" 
                placeholder="le-petit-bistro" 
                required 
                value={formData.slug}
                onChange={e => setFormData({...formData, slug: e.target.value})}
              />
              <p className="text-[10px] text-muted-foreground italic">
                Ceci sera utilisé pour vos QR codes (ex: app.gastronome.ai/r/votre-slug)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pays</Label>
                <Select 
                  defaultValue={formData.country} 
                  onValueChange={v => setFormData({...formData, country: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pays" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FR">France</SelectItem>
                    <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                    <SelectItem value="SN">Sénégal</SelectItem>
                    <SelectItem value="MA">Maroc</SelectItem>
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
                    <SelectValue placeholder="Devise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                    <SelectItem value="XOF">FCFA (XOF)</SelectItem>
                    <SelectItem value="MAD">Dirham (MAD)</SelectItem>
                    <SelectItem value="USD">Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-secondary/30">
            <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initialisation...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Finaliser la Configuration
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
