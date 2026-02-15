
"use client"

/**
 * @fileOverview Layout de protection du tableau de bord.
 * Gère l'isolation multi-tenant, les SuperAdmins et le Soft-Lock.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck } from "lucide-react"
import { COLLECTION_NAMES, ROLES, SUBSCRIPTION_STATUS } from "@/lib/constants"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()

  // 1. Vérification SuperAdmin (Plateforme)
  const platformUserRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformLoading } = useDoc(platformUserRef)

  // 2. Vérification Profil Utilisateur Restaurant (Local)
  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  // 3. Récupération des données du restaurant
  const restaurantRef = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
  }, [db, profile])
  const { data: restaurant, isLoading: isRestaurantLoading } = useDoc(restaurantRef)

  const isSubscriptionExpired = React.useMemo(() => {
    if (!restaurant?.subscriptionEndDate) return false
    return new Date() > new Date(restaurant.subscriptionEndDate)
  }, [restaurant])

  // Logique de redirection
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  if (isUserLoading || isPlatformLoading || isProfileLoading || isRestaurantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // CAS SPECIAL : SuperAdmin de la plateforme
  if (platformProfile?.role === ROLES.SUPER_ADMIN) {
    return (
      <div className="space-y-4">
        <div className="bg-primary/10 border-b border-primary/20 px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-black uppercase italic text-xs">
            <ShieldCheck className="h-4 w-4" /> Mode SuperAdmin Activé
          </div>
          <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold" onClick={() => router.push("/setup")}>
            Créer un Restaurant
          </Button>
        </div>
        {children}
      </div>
    )
  }

  // Cas 1 : Utilisateur sans restaurant (mais pas SuperAdmin)
  if (user && !profile?.restaurantId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-8 bg-muted rounded-3xl border flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-bold text-lg">En attente d'activation</p>
            <p className="text-sm opacity-80">
              Votre compte n'est rattaché à aucun établissement actif. Veuillez contacter l'administration.
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/")} variant="outline" className="w-full">
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  // Cas 2 : Établissement suspendu
  if (restaurant && !restaurant.active) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10" />
          <div className="space-y-1">
            <p className="font-bold text-lg">Compte suspendu</p>
            <p className="text-sm opacity-80">Votre établissement a été suspendu par l'administration.</p>
          </div>
        </div>
      </div>
    )
  }

  // Cas 3 : Soft-Lock Abonnement
  if (isSubscriptionExpired || restaurant?.subscriptionStatus === SUBSCRIPTION_STATUS.EXPIRED) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card shadow-2xl rounded-2xl p-8 border-t-4 border-destructive text-center space-y-6 animate-in zoom-in-95">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-2xl font-black uppercase italic">Abonnement Expiré</h2>
            <p className="text-muted-foreground text-sm">
              Accès aux opérations bloqué. Veuillez contacter votre agent GastronomeAI.
            </p>
            <Button onClick={() => router.push("/dashboard")} variant="secondary" className="w-full">
              Rapports (Lecture seule)
            </Button>
          </div>
        </div>
        <div className="opacity-40 pointer-events-none">
          {children}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
