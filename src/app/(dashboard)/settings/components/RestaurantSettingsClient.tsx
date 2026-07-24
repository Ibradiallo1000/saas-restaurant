"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useFirestore, useMemoFirebase, useCollectionOnce } from "@/firebase"
import { doc, updateDoc, serverTimestamp, collection, query, limit } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { SettingsPermissionDeniedState } from "@/components/settings-ui"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import ImagePickerModal from "@/components/ImagePickerModal"
import PaymentsSettingsLazy from "../payments/components/PaymentsSettingsLazy"
import { RestaurantSettingsView } from "./RestaurantSettingsView"
import { buildRestaurantSettingsViewModel, type BrandingImageTarget, type SettingsTab } from "./restaurant-settings-view-model"

export default function RestaurantSettingsPage() {
  const searchParams = useSearchParams()
  const db = useFirestore()
  const { restaurant, restaurantId, refreshRestaurant, role } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [brandingStatus, setBrandingStatus] = React.useState<"idle" | "saving" | "success" | "error">("idle")
  const [brandingMessage, setBrandingMessage] = React.useState("")
  const [staffPendingAction, setStaffPendingAction] = React.useState<string | null>(null)
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
  }, [db, restaurantId])
  const { data: staff, isLoading: staffLoading, error: staffError, refetch: refetchStaff } = useCollectionOnce(staffQuery)

  const [resData, setResData] = React.useState({ name: "", country: "", currency: "" })
  const [brandData, setBrandData] = React.useState({
    name: "",
    logoUrl: "",
    coverImage: "",
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
      coverImage: restaurant.coverImage || restaurant.coverImageUrl || "",
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

  const handleUpdateBranding = async () => {
    if (!restaurantRef) return
    setLoading(true)
    setBrandingStatus("saving")
    setBrandingMessage("Sauvegarde de la personnalisation en cours...")
    try {
      const nextLogoUrl = brandData.logoUrl.trim()
      const nextCoverImage = brandData.coverImage.trim()

      await updateDoc(restaurantRef, {
        name: brandData.name.trim(),
        logoUrl: nextLogoUrl,
        coverImage: nextCoverImage,
        coverImageUrl: nextCoverImage,
        updatedAt: serverTimestamp(),
      })
      refreshRestaurant()
      setBrandingStatus("success")
      setBrandingMessage("Personnalisation enregistrée. Les nouvelles images seront conservées après actualisation.")
      toast({ title: "Personnalisation mise à jour", description: "Le logo et la couverture du restaurant ont été enregistrés." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      setBrandingStatus("error")
      setBrandingMessage(`Impossible de sauvegarder la personnalisation : ${message}`)
      toast({ variant: "destructive", title: "Erreur", description: `Impossible de sauvegarder la personnalisation. ${message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleInviteStaff = async () => {
    if (!restaurantId || !user) return
    setStaffPendingAction("invite")
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
      setStaffPendingAction(null)
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

    setStaffPendingAction(`complete:${editingStaffId}`)
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
      setStaffPendingAction(null)
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
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast({ title: "Lien copié" })
    } catch {
      toast({ variant: "destructive", title: "Copie impossible", description: "Copiez manuellement le lien d’invitation affiché." })
    }
  }

  const sendInviteEmail = (email: string, link?: string) => {
    const inviteLink = link || lastInviteLink
    if (!inviteLink) return
    window.open(`mailto:${email}?subject=Invitation restaurant&body=${encodeURIComponent(inviteLink)}`)
    toast({ title: "Messagerie ouverte" })
  }

  const sendInviteWhatsApp = (link?: string) => {
    const inviteLink = link || lastInviteLink
    if (!inviteLink) return
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteLink)}`)
    toast({ title: "WhatsApp ouvert" })
  }

  const resendInvite = async (member: any) => {
    if (!member.email) return
    setStaffPendingAction(`resend:${member.id}`)
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
      setStaffPendingAction(null)
    }
  }

  const handleSelectBrandImage = (image: { url: string }) => {
    if (imagePickerTarget === "logo") {
      setBrandData((current) => ({ ...current, logoUrl: image.url }))
      setBrandingStatus("idle")
      setBrandingMessage("Logo sélectionné. Enregistrez pour appliquer ce changement.")
    }

    if (imagePickerTarget === "cover") {
      setBrandData((current) => ({ ...current, coverImage: image.url }))
      setBrandingStatus("idle")
      setBrandingMessage("Image de couverture sélectionnée. Enregistrez pour appliquer ce changement.")
    }
  }

  if (role !== ROLES.OWNER) {
    return <SettingsPermissionDeniedState title="Accès réservé au propriétaire" description="Vous ne pouvez pas modifier les paramètres de cet établissement." />
  }

  const viewModel = buildRestaurantSettingsViewModel({ activeTab, loading, staffLoading, staffError: staffError?.message, staffPendingAction, profile: resData, branding: brandData, staff, newStaff, editingStaffId, editingStaff, lastInviteLink, lastInviteEmail })

  return <>
    <RestaurantSettingsView
      model={viewModel}
      payments={<PaymentsSettingsLazy />}
      onTabChange={setActiveTab}
      onProfileChange={setResData}
      onSaveProfile={handleUpdateRestaurant}
      onBrandingChange={setBrandData}
      brandingStatus={brandingStatus}
      brandingMessage={brandingMessage}
      onChooseBrandImage={setImagePickerTarget}
      onSaveBranding={handleUpdateBranding}
      onNewStaffChange={setNewStaff}
      onInviteStaff={handleInviteStaff}
      onStartStaffEdit={startStaffCompletion}
      onStaffEditChange={setEditingStaff}
      onSaveStaffEdit={saveStaffCompletion}
      onCancelStaffEdit={cancelStaffCompletion}
      onCopyInvite={copyInviteLink}
      onSendInviteEmail={sendInviteEmail}
      onSendInviteWhatsApp={sendInviteWhatsApp}
      onResendInvite={resendInvite}
    />
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
  </>
}
