"use client"

import * as React from "react"
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, updateDoc, serverTimestamp, collection, query, where } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { Settings, Users, Building2, Save, Loader2, Plus, Trash2, Mail, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { StaffService } from "@/services/staff.service"

export default function RestaurantSettingsPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  // Profil & Restaurant
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
  }, [db, profile])
  const { data: restaurant } = useDoc(restaurantRef)

  // Staff
  const staffQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return query(collection(db, COLLECTION_NAMES.USERS), where("restaurantId", "==", profile.restaurantId))
  }, [db, profile])
  const { data: staff } = useCollection(staffQuery)

  const [resData, setResData] = React.useState({ name: "", country: "", currency: "" })
  const [newStaff, setNewStaff] = React.useState({ email: "", role: "server" })

  React.useEffect(() => {
    if (restaurant) setResData({ name: restaurant.name, country: restaurant.country, currency: restaurant.currency })
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
    if (!db || !profile?.restaurantId) return
    setLoading(true)
    const staffService = new StaffService(db)
    try {
      await staffService.createStaffMember(profile.restaurantId, newStaff.email, newStaff.role)
      toast({ title: "Membre ajouté", description: `Un email d'activation a été envoyé à ${newStaff.email}.` })
      setNewStaff({ email: "", role: "server" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (profile?.role !== ROLES.OWNER) {
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
        <TabsList className="bg-secondary/30 p-1 rounded-xl mb-6">
          <TabsTrigger value="profile" className="rounded-lg font-bold">ÉTABLISSEMENT</TabsTrigger>
          <TabsTrigger value="staff" className="rounded-lg font-bold">ÉQUIPE & RÔLES</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border-none shadow-2xl overflow-hidden rounded-3xl">
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
              <Button onClick={handleUpdateRestaurant} disabled={loading} className="w-full h-14 font-black uppercase italic shadow-xl">
                {loading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Enregistrer les modifications</>}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl overflow-hidden">
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

            <Card className="border-none shadow-xl h-fit">
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
                <Button onClick={handleAddStaff} disabled={loading || !newStaff.email} className="w-full font-bold uppercase italic">
                   {loading ? <Loader2 className="animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Recruter</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
