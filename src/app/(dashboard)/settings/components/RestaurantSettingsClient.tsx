"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useFirestore, useMemoFirebase, useCollectionOnce } from "@/firebase"
import { doc, updateDoc, serverTimestamp, collection, query, limit } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { Settings, Users, Building2, Save, Loader2, Plus, ShieldCheck, Palette, ImageIcon, Copy, Mail, MessageCircle, RefreshCw, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import ImagePickerModal from "@/components/ImagePickerModal"
import PaymentsSettingsLazy from "../payments/components/PaymentsSettingsLazy"

type SettingsTab = "profile" | "staff" | "payments" | "branding"
type BrandingImageTarget = "logo" | "cover"

export default function RestaurantSettingsPage() {
  const searchParams = useSearchParams()
  const db = useFirestore()
  const { restaurant, restaurantId, role } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("profile")
  const [imagePickerTarget, setImagePickerTarget] = React.useState<BrandingImageTarget | null>(null)

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
      ),
      limit(20)
    )
  }, [activeTab, db, restaurantId])
  const { data: staff, refetch: refetchStaff } = useCollectionOnce(staffQuery)

  const [resData, setResData] = React.useState({ name: "", country: "", currency: "" })
  const [brandData, setBrandData] = React.useState({
    name: "",
    logoUrl: "",
    coverImage: "",
    primary: "#f97316",
    secondary: "#1f2937",
  })
  const [newStaff, setNewStaff] = React.useState({
    nomComplet: "",
    telephone: "",
    email: "",
    role: "server",
  })
  const [editingStaffId, setEditingStaffId] = React.useState<string | null>(null)
  const [editingStaff, setEditingStaff] = React.useState({
    nomComplet: "",
    telephone: "",
    role: "server",
  })
  const [lastInviteLink, setLastInviteLink] = React.useState("")
  const [lastInviteEmail, setLastInviteEmail] = React.useState("")

  React.useEffect(() => {
    const tabParam = searchParams?.get("tab")
    if (tabParam === "paiements" || tabParam === "payments") {
      setActiveTab("payments")
    }
  }, [searchParams])

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
    try {
      const { StaffService } = await import("@/services/staff.service")
      const staffService = new StaffService(db)
      await staffService.createStaffMember(restaurantId, newStaff.email, newStaff.role, {
        nomComplet: newStaff.nomComplet,
        telephone: newStaff.telephone,
      })
      toast({ title: "Membre ajouté", description: `Un email d'activation a été envoyé à ${newStaff.email}.` })
      setNewStaff({ nomComplet: "", telephone: "", email: "", role: "server" })
      refetchStaff()
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

  const handleInviteStaff = async () => {
    if (!restaurantId || !user) return
    setLoading(true)
    try {
      const inviteLink = await requestStaffInvite(newStaff.email, newStaff.role)
      setLastInviteLink(inviteLink)
      setLastInviteEmail(newStaff.email)
      toast({ title: "Invitation generee", description: `Lien d'activation pret pour ${newStaff.email}.` })
      setNewStaff({ nomComplet: "", telephone: "", email: "", role: "server" })
      refetchStaff()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const startStaffCompletion = (member: any) => {
    setEditingStaffId(member.id)
    setEditingStaff({
      nomComplet: member.nomComplet || "",
      telephone: member.telephone || "",
      role: member.role || "server",
    })
  }

  const cancelStaffCompletion = () => {
    setEditingStaffId(null)
    setEditingStaff({ nomComplet: "", telephone: "", role: "server" })
  }

  const saveStaffCompletion = async () => {
    if (!db || !restaurantId || !editingStaffId) return

    if (!editingStaff.nomComplet.trim() || !editingStaff.telephone.trim() || !editingStaff.role) {
      toast({
        variant: "destructive",
        title: "Profil incomplet",
        description: "Nom, téléphone et rôle sont obligatoires.",
      })
      return
    }

    setLoading(true)
    try {
      await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "staff", editingStaffId), {
        nomComplet: editingStaff.nomComplet.trim(),
        telephone: editingStaff.telephone.trim(),
        role: editingStaff.role,
        actif: true,
        active: true,
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Profil staff complété" })
      cancelStaffCompletion()
      refetchStaff()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le staff.",
      })
    } finally {
      setLoading(false)
    }
  }

  const requestStaffInvite = async (
    email: string,
    staffRole: string,
    staffProfile = {
      nomComplet: newStaff.nomComplet,
      telephone: newStaff.telephone,
    }
  ) => {
    if (!restaurantId || !user) throw new Error("Utilisateur non connecte")

    const token = await user.getIdToken()
    const response = await fetch(`/api/restaurants/${restaurantId}/staff/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email,
        role: staffRole,
        nomComplet: staffProfile.nomComplet,
        telephone: staffProfile.telephone,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.error || "Impossible de generer l'invitation.")
    }

    return ((data.inviteLink as string | null) ?? "")
  }

  const copyInviteLink = async (link?: string) => {
    const inviteLink = link || lastInviteLink
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    toast({ title: "Lien copie" })
  }

  const sendInviteEmail = (email: string, link?: string) => {
    const inviteLink = link || lastInviteLink
    if (!inviteLink) return
    window.open(`mailto:${email}?subject=Invitation restaurant&body=${encodeURIComponent(inviteLink)}`)
  }

  const sendInviteWhatsApp = (link?: string) => {
    const inviteLink = link || lastInviteLink
    if (!inviteLink) return
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteLink)}`)
  }

  const resendInvite = async (member: any) => {
    setLoading(true)
    try {
      const inviteLink = await requestStaffInvite(member.email, member.role, {
        nomComplet: member.nomComplet || member.email,
        telephone: member.telephone || "Non renseigne",
      })
      setLastInviteLink(inviteLink)
      refetchStaff()
      toast({ title: "Invitation renvoyee", description: member.email })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBrandImage = (image: { url: string }) => {
    if (imagePickerTarget === "logo") {
      setBrandData((current) => ({ ...current, logoUrl: image.url }))
    }

    if (imagePickerTarget === "cover") {
      setBrandData((current) => ({ ...current, coverImage: image.url }))
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

      <div className="w-full">
        <div className="mb-6 flex flex-wrap gap-1 rounded-2xl bg-secondary/30 p-1 shadow-sm">
          <SettingsTabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>
            ÉTABLISSEMENT
          </SettingsTabButton>
          <SettingsTabButton active={activeTab === "staff"} onClick={() => setActiveTab("staff")}>
            ÉQUIPE & RÔLES
          </SettingsTabButton>
          <SettingsTabButton active={activeTab === "payments"} onClick={() => setActiveTab("payments")}>
            PAIEMENTS
          </SettingsTabButton>
          <SettingsTabButton active={activeTab === "branding"} onClick={() => setActiveTab("branding")}>
            PERSONNALISATION
          </SettingsTabButton>
        </div>

        {activeTab === "profile" && (
        <div className="space-y-6">
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
        </div>
        )}

        {activeTab === "staff" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="bg-secondary/20">
                <CardTitle className="text-xl font-black italic uppercase flex items-center gap-2">
                   <Users className="h-5 w-5 text-primary" /> Membres Actifs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {staff?.map((member: any) => {
                    const incomplete = !member.nomComplet || !member.telephone
                    const isEditing = editingStaffId === member.id

                    return (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {(member.nomComplet || member.email || "?").charAt(0).toUpperCase()}
                        </div>
                        {isEditing ? (
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={editingStaff.nomComplet}
                              onChange={(event) => setEditingStaff({ ...editingStaff, nomComplet: event.target.value })}
                              placeholder="Nom complet"
                              className="h-9"
                            />
                            <Input
                              value={editingStaff.telephone}
                              onChange={(event) => setEditingStaff({ ...editingStaff, telephone: event.target.value })}
                              placeholder="Téléphone"
                              className="h-9"
                            />
                            <select
                              value={editingStaff.role}
                              onChange={(event) => setEditingStaff({ ...editingStaff, role: event.target.value })}
                              className="h-9 rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="manager">Manager / Gérant</option>
                              <option value="cashier">Caissier / POS</option>
                              <option value="kitchen">Chef de Cuisine</option>
                              <option value="server">Serveur / Salle</option>
                            </select>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-sm">{member.nomComplet || member.email}</p>
                            <p className="text-xs text-muted-foreground">{member.telephone || member.email || "Contact non renseigne"}</p>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{member.role}</p>
                            {incomplete ? (
                              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase text-orange-600">
                                <AlertTriangle className="h-3 w-3" /> Profil incomplet
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" className="h-8 text-[10px] font-black" disabled={loading} onClick={saveStaffCompletion}>
                              Enregistrer
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" disabled={loading} onClick={cancelStaffCompletion}>
                              Annuler
                            </Button>
                          </>
                        ) : incomplete ? (
                          <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => startStaffCompletion(member)}>
                            Compléter
                          </Button>
                        ) : null}
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-[9px] uppercase">
                          {member.status || 'active'}
                        </Badge>
                        {member.inviteLink ? (
                          <>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => copyInviteLink(member.inviteLink)}>
                              <Copy className="mr-1 h-3 w-3" /> Copier lien
                            </Button>
                            {member.email ? (
                              <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => sendInviteEmail(member.email, member.inviteLink)}>
                                <Mail className="mr-1 h-3 w-3" /> Envoyer invitation
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => sendInviteWhatsApp(member.inviteLink)}>
                              <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                            </Button>
                          </>
                        ) : null}
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black" disabled={loading} onClick={() => resendInvite(member)}>
                          <RefreshCw className="mr-1 h-3 w-3" /> Renvoyer
                        </Button>
                      </div>
                    </div>
                    )
                  })}
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
                  <Label>Nom complet *</Label>
                  <Input
                    placeholder="Ibrahim Diallo"
                    value={newStaff.nomComplet}
                    onChange={e => setNewStaff({...newStaff, nomComplet: e.target.value})}
                    className="bg-secondary/30 border-none rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input
                    placeholder="+223 70 00 00 00"
                    value={newStaff.telephone}
                    onChange={e => setNewStaff({...newStaff, telephone: e.target.value})}
                    className="bg-secondary/30 border-none rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email professionnel (optionnel)</Label>
                  <Input 
                    placeholder="equipe@restaurant.com"
                    value={newStaff.email}
                    onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                    className="bg-secondary/30 border-none rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rôle / Fonction</Label>
                  <select
                    value={newStaff.role}
                    onChange={(event) => setNewStaff({ ...newStaff, role: event.target.value })}
                    className="h-12 w-full rounded-xl border-none bg-secondary/30 px-3 text-sm"
                  >
                    <option value="manager">Manager / Gérant</option>
                    <option value="cashier">Caissier / POS</option>
                    <option value="kitchen">Chef de Cuisine</option>
                    <option value="server">Serveur / Salle</option>
                  </select>
                </div>
                <Button
                  onClick={handleInviteStaff}
                  disabled={loading || !newStaff.nomComplet.trim() || !newStaff.telephone.trim() || !newStaff.role}
                  className="w-full h-11 rounded-xl font-black uppercase italic shadow-lg"
                >
                   {loading ? <Loader2 className="animate-spin" /> : <><Plus className="mr-2 h-4 w-4" /> Ajouter le membre</>}
                </Button>
                {lastInviteLink ? (
                  <div className="space-y-2 rounded-xl border bg-secondary/20 p-3">
                    <Input value={lastInviteLink} readOnly className="h-9 text-xs" />
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyInviteLink()}>
                        <Copy className="mr-1 h-3 w-3" /> Copier
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => sendInviteEmail(lastInviteEmail)}>
                        <Mail className="mr-1 h-3 w-3" /> Email
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => sendInviteWhatsApp()}>
                        <MessageCircle className="mr-1 h-3 w-3" /> SMS
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {activeTab === "payments" && (
          <div className="space-y-6">
            <PaymentsSettingsLazy />
          </div>
        )}

        {activeTab === "branding" && (
        <div className="space-y-6">
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
                  <BrandImageField
                    label="Logo"
                    imageUrl={brandData.logoUrl}
                    previewClassName="h-24 w-24"
                    emptyLabel="Logo"
                    onChoose={() => setImagePickerTarget("logo")}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <BrandImageField
                    label="Image de couverture"
                    imageUrl={brandData.coverImage}
                    previewClassName="h-36 w-full"
                    emptyLabel="Cover"
                    onChoose={() => setImagePickerTarget("cover")}
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
            </CardContent>

            <CardFooter className="p-8 pt-0">
              <Button onClick={handleUpdateBranding} disabled={loading} className="w-full h-14 rounded-xl font-black uppercase italic shadow-xl">
                {loading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Enregistrer la personnalisation</>}
              </Button>
            </CardFooter>
          </Card>
        </div>
        )}
      </div>

      {restaurantId && (
        <ImagePickerModal
          open={imagePickerTarget !== null}
          restaurantId={restaurantId}
          selectedImageUrl={imagePickerTarget === "logo" ? brandData.logoUrl : brandData.coverImage}
          title={imagePickerTarget === "logo" ? "Choisir le logo" : "Choisir la couverture"}
          description="Selectionnez une image de la bibliotheque interne ou importez-en une nouvelle."
          onClose={() => setImagePickerTarget(null)}
          onSelect={handleSelectBrandImage}
        />
      )}
    </div>
  )
}

function BrandImageField({
  label,
  imageUrl,
  previewClassName,
  emptyLabel,
  onChoose,
}: {
  label: string
  imageUrl: string
  previewClassName: string
  emptyLabel: string
  onChoose: () => void
}) {
  return (
    <div className="rounded-2xl bg-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={onChoose} className="rounded-xl font-bold">
          <ImageIcon className="mr-2 h-4 w-4" />
          {imageUrl ? "Changer" : "Choisir une image"}
        </Button>
      </div>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          className={`${previewClassName} rounded-2xl object-cover shadow-sm`}
        />
      ) : (
        <button
          type="button"
          onClick={onChoose}
          className={`${previewClassName} flex items-center justify-center rounded-2xl border border-dashed bg-background text-[10px] font-black uppercase text-muted-foreground shadow-sm transition hover:bg-muted`}
        >
          {emptyLabel}
        </button>
      )}
    </div>
  )
}

function SettingsTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-10 rounded-xl px-4 text-xs font-black uppercase transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      ].join(" ")}
    >
      {children}
    </button>
  )
}
