
'use client';

/**
 * @fileOverview Layout de protection et de verrouillage du tableau de bord.
 * Gère l'isolation multi-tenant et le Soft-Lock par abonnement.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck, Lock } from "lucide-react"
import { COLLECTION_NAMES, ROLES, SUBSCRIPTION_STATUS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { SubscriptionService } from "@/services/subscription.service"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()

  // 1. Profil Utilisateur Plateforme
  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformLoading } = useDoc(platformUserRef)

  // 2. Profil Utilisateur Restaurant (Local)
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  // 3. Récupération Restaurant + Abonnement
  const restaurantRef = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
  }, [db, profile])
  const { data: restaurant, isLoading: isRestaurantLoading } = useDoc(restaurantRef)

  // Vérification de l'abonnement via un service dédié (Simulation ici, optimisable via useCollection)
  const [isSubscriptionLocked, setIsSubscriptionLocked] = React.useState(false);
  
  React.useEffect(() => {
    const checkSub = async () => {
      if (!db || !profile?.restaurantId) return;
      const subService = new SubscriptionService(db);
      const activeSub = await subService.getActiveSubscription(profile.restaurantId);
      if (!activeSub || subService.isExpired(activeSub)) {
        setIsSubscriptionLocked(true);
      }
    };
    checkSub();
  }, [db, profile]);

  // Redirection si non connecté
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  if (isUserLoading || isPlatformLoading || isProfileLoading || isRestaurantLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Vérification des accès...
        </p>
      </div>
    )
  }

  // CAS SPECIAL : SuperAdmin
  if (platformProfile?.role === ROLES.SUPER_ADMIN) {
    return (
      <div className="space-y-4">
        <div className="bg-primary/10 border-b border-primary/20 px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-black uppercase italic text-[10px]">
            <ShieldCheck className="h-4 w-4" /> Mode SuperAdmin • Vue Établissement
          </div>
          <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold" onClick={() => router.push("/platform")}>
            Retour Administration
          </Button>
        </div>
        {children}
      </div>
    )
  }

  // Cas : Établissement suspendu ou non rattaché
  if (user && !profile?.restaurantId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center p-12 bg-muted rounded-3xl border border-dashed space-y-6">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase italic">Accès en attente</h2>
          <p className="text-sm text-muted-foreground">
            Votre compte n'est lié à aucun établissement actif. Veuillez contacter le support GastronomeAI.
          </p>
        </div>
        <Button onClick={() => router.push("/")} variant="outline" className="w-full h-12">Retour à l'accueil</Button>
      </div>
    )
  }

  // Cas : Soft-Lock Abonnement Expiré
  if (isSubscriptionLocked) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] rounded-3xl p-10 border-t-8 border-destructive text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <Lock className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Accès Restreint</h2>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                Votre abonnement a expiré. L'accès aux outils de vente et de cuisine est suspendu jusqu'au renouvellement.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={() => window.open(`mailto:support@gastronomeai.com`)} className="h-14 w-full text-lg font-black uppercase italic shadow-lg">
                Renouveler maintenant
              </Button>
              <Button onClick={() => setIsSubscriptionLocked(false)} variant="ghost" className="text-xs uppercase font-bold text-muted-foreground hover:bg-transparent underline">
                Consulter les rapports (lecture seule)
              </Button>
            </div>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none blur-sm filter grayscale">
          {children}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
