'use client';

/**
 * @fileOverview Layout de protection multi-tenant et Soft-Lock.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2, AlertCircle, ShieldCheck, Lock } from "lucide-react"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { SubscriptionService } from "@/services/subscription.service"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()

  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformLoading } = useDoc(platformUserRef)

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

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

  React.useEffect(() => {
    if (!isUserLoading && !user) router.push("/login")
  }, [user, isUserLoading, router])

  if (isUserLoading || isPlatformLoading || isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Validation des accès...</p>
      </div>
    )
  }

  if (platformProfile?.role === ROLES.SUPER_ADMIN) {
    return (
      <div className="space-y-4">
        <div className="bg-primary/10 border-b border-primary/20 px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-black uppercase italic text-[10px]">
            <ShieldCheck className="h-4 w-4" /> Mode Admin • Vue Établissement
          </div>
          <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold" onClick={() => router.push("/platform")}>Retour Platform</Button>
        </div>
        {children}
      </div>
    )
  }

  if (isSubscriptionLocked) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card shadow-2xl rounded-3xl p-10 border-t-8 border-destructive text-center space-y-8 animate-in zoom-in-95 duration-500">
            <Lock className="h-12 w-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Accès Restreint</h2>
              <p className="text-muted-foreground text-sm font-medium">Votre abonnement a expiré. L'accès aux outils de vente est suspendu.</p>
            </div>
            <Button className="h-14 w-full text-lg font-black uppercase italic shadow-lg" onClick={() => window.open(`mailto:support@gastronomeai.com`)}>Renouveler l'abonnement</Button>
            <Button onClick={() => setIsSubscriptionLocked(false)} variant="ghost" className="text-xs uppercase font-bold underline">Consulter les rapports (Lecture Seule)</Button>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none filter blur-sm">{children}</div>
      </div>
    )
  }

  return <>{children}</>
}
