"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2, AlertCircle } from "lucide-react"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    const r = doc(db, COLLECTION_NAMES.USERS, user.uid)
    return Object.assign(r, { __memo: true })
  }, [db, user])
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  const restaurantRef = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    const r = doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
    return Object.assign(r, { __memo: true })
  }, [db, profile])

  const { data: restaurant, isLoading: isRestaurantLoading } = useDoc(restaurantRef)

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
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

  if (!restaurant?.active) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10" />
          <div className="space-y-1">
            <p className="font-bold text-lg">Compte suspendu</p>
            <p className="text-sm opacity-80">Votre établissement n'est plus actif. Veuillez contacter le support SaaS.</p>
          </div>
        </div>
        <Button onClick={() => router.push("/")} variant="outline" className="w-full">
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
