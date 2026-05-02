"use client"

import * as React from "react"
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase"
import { doc, updateDoc, serverTimestamp, collection, query } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { Settings, Users, Building2, Save, Loader2, Plus, ShieldCheck, Palette } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { StaffService } from "@/services/staff.service"
import { useRestaurant } from "@/design-system/context/RestaurantContext"

export default function RestaurantSettingsPage() {
  const db = useFirestore()
  const { restaurant, restaurantId, role } = useRestaurant()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId)
  }, [db, restaurantId])

// Staff
  const staffQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(
        db,
        COLLECTION_NAMES.RESTAURANTS,
        restaurantId,
        "staff"
      )
    )
  }, [db, restaurantId])
  const { data: staff } = useCollection(staffQuery)

  const [resData, setResData] = React.useState({ name: "", country: "", currency: "" })
  const [brandData, setBrandData] = React.useState({
    name: "",
    logoUrl: "",
    coverImage: "",
    primary: "#f97316",
    secondary: "#1f2937",
  })
  const [newStaff, setNewStaff] = React.useState({ email: "", role: "server" })

  React.useEffect(() => {
    if (restaurant) {
      setResData({
        name: restaurant.name || "",
        country: restaurant.country || "",
        currency: restaurant.currency || "",
      })
    }
  }, [restaurant])

  React.useEffect(() => {
    if (!restaurant) return

    setBrandData({
      name: restaurant.name || "",
      logoUrl: restaurant.logoUrl || "",
      coverImage: restaurant.coverImage || "",
      primary: restaurant.theme?.primary || "#f97316",
      secondary: restaurant.theme?.secondary || "#1f2937",
    })
  }, [restaurant])

  const handleUpdateRestaurant = async () => {
    if (!restaurantRef) return
    setLoading(true)
    try {
      await updateDoc(restaurantRef, { ...resData, updatedAt: serverTimestamp() })
      toast({ title: "Mis à jour", description: "Les informations de l'établissement ont été enregistrées." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder." })
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async () => {
    if (!db || !restaurantId) return
    setLoading(true)
    const staffService = new StaffService(db)
    try {
      await staffService.createStaffMember(restaurantId, newStaff.email, newStaff.role)
      toast({ title: "Membre ajouté", description: `Un email d'activation a été envoyé à ${newStaff.email}.` })
      setNewStaff({ email: "", role: "server" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateBranding = async () => {
    if (!restaurantRef) return
    setLoading(true)
    try {
      await updateDoc(restaurantRef, {
        name: brandData.name.trim(),
        logoUrl: brandData.logoUrl.trim(),
        coverImage: brandData.coverImage.trim(),
        theme: {
          primary: brandData.primary,
          secondary: brandData.secondary,
        },
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Personnalisation mise a jour", description: "L'identite visuelle du restaurant a ete enregistree." })
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder la personnalisation." })
    } finally {
      setLoading(false)
    }
  }

  if (role !== ROLES.OWNER) {
    return (
      <div className="flex items-center justify-center p-20 text-center text-muted-foreground">
        <ShieldCheck className="mr-2 h-5 w-5" /> Accès réservé au propriétaire.
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary rounded-xl text-primary-foreground shadow-lg">
          <Settings className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Configuration</h1>
          <p className="text-muted-foreground font-medium">Paramètres de l'établissement et gestion d'équipe.</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-secondary/30 p-1 rounded-2xl mb-6 shadow-sm">
          <TabsTrigger value="profile" className="rounded-xl font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">ÉTABLISSEMENT</TabsTrigger>
          <TabsTrigger value="staff" className="rounded-xl font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">ÉQUIPE & RÔLES</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-xl font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">PERSONNALISATION</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border-none shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
              <CardTitle className="text-2xl font-black italic uppercase flex items-center gap-3">
                <Building2 className="h-6 w-6 text-primary" /> Identité
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nom de l'établissement</Label>
                  <Input 
                    value={resData.name}
                    onChange={e => setResData({...resData, name: e.target.value})}
                    className="h-12 bg-secondary/30 border-none rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Devise Locale</Label>
                  <Input 
                    value={resData.currency}
                    onChange={e => setResData({...resData, currency: e.target.value})}
                    className="h-12 bg-secondary/30 border-none rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-8 pt-0">
              <Button onClick={handleUpdateRestaurant} disabled={loading} className="w-full h-14 rounded-xl font-black uppercase italic shadow-xl">
                {loading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Enregistrer les modifications</>}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="bg-secondary/20">
                <CardTitle className="text-xl font-black italic uppercase flex items-center gap-2">
                   <Users className="h-5 w-5 text-primary" /> Membres Actifs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {staff?.map((member: any) => (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {member.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{member.email}</p>
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{member.role}</p>
                        </div>
                      </div>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-[9px] uppercase">
                        {member.status || 'active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none rounded-2xl shadow-xl h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-black italic uppercase">Ajouter un Membre</CardTitle>
                <CardDescription>Il recevra un lien pour définir son mot de passe.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Professionnel</Label>
                  <Input 
                    placeholder="equipe@restaurant.com"
                    value={newStaff.email}
                    onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                    className="bg-secondary/30 border-none rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rôle / Fonction</Label>
                  <Select value={newStaff.role} onValueChange={v => setNewStaff({...newStaff, role: v})}>
                    <SelectTrigger className="bg-secondary/30 border-none rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager / Gérant</SelectItem>
                      <SelectItem value="cashier">Caissier / POS</SelectItem>
                      <SelectItem value="kitchen">Chef de Cuisine</SelectItem>
                      <SelectItem value="server">Serveur / Salle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddStaff} disabled={loading || !newStaff.email} className="w-full h-11 rounded-xl font-black uppercase italic shadow-lg">
                   {loading ? <Loader2 className="animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Recruter</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card className="border-none shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
              <CardTitle className="text-2xl font-black italic uppercase flex items-center gap-3">
                <Palette className="h-6 w-6 text-primary" /> Personnalisation
              </CardTitle>
              <CardDescription>
                Personnalisez les couleurs et la marque sans changer la structure de l'interface.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nom du restaurant</Label>
                  <Input
                    value={brandData.name}
                    onChange={(e) => setBrandData({ ...brandData, name: e.target.value })}
                    className="h-12 bg-secondary/30 border-none rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Logo URL</Label>
                  <Input
                    value={brandData.logoUrl}
                    onChange={(e) => setBrandData({ ...brandData, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="h-12 bg-secondary/30 border-none rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cover image URL</Label>
                  <Input
                    value={brandData.coverImage}
                    onChange={(e) => setBrandData({ ...brandData, coverImage: e.target.value })}
                    placeholder="https://..."
                    className="h-12 bg-secondary/30 border-none rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Couleur primaire</Label>
                    <div className="flex h-12 items-center gap-3 rounded-xl bg-secondary/30 px-3">
                      <Input
                        type="color"
                        value={brandData.primary}
                        onChange={(e) => setBrandData({ ...brandData, primary: e.target.value })}
                        className="h-8 w-10 border-none bg-transparent p-0"
                      />
                      <span className="text-sm font-black uppercase">{brandData.primary}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Couleur secondaire</Label>
                    <div className="flex h-12 items-center gap-3 rounded-xl bg-secondary/30 px-3">
                      <Input
                        type="color"
                        value={brandData.secondary}
                        onChange={(e) => setBrandData({ ...brandData, secondary: e.target.value })}
                        className="h-8 w-10 border-none bg-transparent p-0"
                      />
                      <span className="text-sm font-black uppercase">{brandData.secondary}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-secondary/30 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Logo</p>
                  {brandData.logoUrl ? (
                    <img src={brandData.logoUrl} alt="Logo restaurant" className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-[10px] font-black uppercase text-muted-foreground shadow-sm">
                      Logo
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-secondary/30 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cover</p>
                  {brandData.coverImage ? (
                    <img src={brandData.coverImage} alt="Cover restaurant" className="h-24 w-full rounded-2xl object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center rounded-2xl bg-white text-[10px] font-black uppercase text-muted-foreground shadow-sm">
                      Cover image
                    </div>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-8 pt-0">
              <Button onClick={handleUpdateBranding} disabled={loading} className="w-full h-14 rounded-xl font-black uppercase italic shadow-xl">
                {loading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Enregistrer la personnalisation</>}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
