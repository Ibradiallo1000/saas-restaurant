"use client"

/**
 * @fileOverview Layout de protection du tableau de bord.
 * Gère l'isolation multi-tenant, la redirection auth,
 * et le "Soft-Lock" en cas d'expiration d'abonnement.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2, AlertCircle, ShieldAlert } from "lucide-react"
import { COLLECTION_NAMES, SUBSCRIPTION_STATUS } from "@/lib/constants"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()

  // Récupération du profil utilisateur pour connaître son restaurantId actif
  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  // Récupération des données du restaurant pour vérifier l'abonnement
  const restaurantRef = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
  }, [db, profile])

  const { data: restaurant, isLoading: isRestaurantLoading } = useDoc(restaurantRef)

  // Vérification de la validité temporelle de l'abonnement
  const isSubscriptionExpired = React.useMemo(() => {
    if (!restaurant?.subscriptionEndDate) return false
    return new Date() > new Date(restaurant.subscriptionEndDate)
  }, [restaurant])

  // Logique de redirection
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
    // Si l'utilisateur est connecté mais n'a pas encore de restaurant (nouvel Owner)
    if (!isUserLoading && user && !isProfileLoading && !profile?.restaurantId) {
      router.push("/setup")
    }
  }, [user, isUserLoading, profile, isProfileLoading, router])

  if (isUserLoading || isProfileLoading || isRestaurantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Cas 1 : Établissement suspendu par le Super Admin
  if (restaurant && !restaurant.active) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10" />
          <div className="space-y-1">
            <p className="font-bold text-lg">Compte suspendu</p>
            <p className="text-sm opacity-80">Votre établissement a été suspendu par l'administration GastronomeAI.</p>
          </div>
        </div>
        <Button onClick={() => router.push("/")} variant="outline" className="w-full">
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  // Cas 2 : Abonnement expiré (Soft-Lock)
  // On autorise la lecture du dashboard mais on bloque les actions critiques via UI 
  // Ici on injecte un contexte ou un overlay si expiré
  if (isSubscriptionExpired || restaurant?.subscriptionStatus === SUBSCRIPTION_STATUS.EXPIRED) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card shadow-2xl rounded-2xl p-8 border-t-4 border-destructive text-center space-y-6 animate-in zoom-in-95">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase italic">Abonnement Expiré</h2>
              <p className="text-muted-foreground text-sm">
                L'accès aux opérations (POS, Commandes, Cuisine) est bloqué.
                Veuillez renouveler votre abonnement auprès de votre agent GastronomeAI.
              </p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-xl text-xs font-mono">
              Restaurant ID: {restaurant?.id}
            </div>
            <Button onClick={() => router.push("/dashboard")} variant="secondary" className="w-full">
              Consulter les rapports (Lecture seule)
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