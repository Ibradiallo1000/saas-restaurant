"use client"

import * as React from "react"
import type { User } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"

import { useFirestore, useUser } from "@/firebase"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"

type TenantProfile = {
  restaurantId?: string | null
  role?: string | null
  [key: string]: any
}

type TenantContextType = {
  user: User | null
  profile: TenantProfile | null
  restaurantId: string | null
  role: string
  isSuperAdmin: boolean
  loading: boolean
}

// Cache global
const globalCache = new Map<string, TenantProfile>()

const TenantContext = React.createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const uid = user?.uid ?? null
  
  const [profile, setProfile] = React.useState<TenantProfile | null>(() => {
    // Initialiser depuis le cache si disponible
    return uid ? globalCache.get(uid) ?? null : null
  })
  
  const [isLoading, setIsLoading] = React.useState(!profile && !isUserLoading && !!uid)

  // Utiliser onSnapshot au lieu de useDoc pour éviter les re-renders inutiles
  React.useEffect(() => {
    if (!db || !uid || isUserLoading) return

    setIsLoading(true)
    
    const userDocRef = doc(db, COLLECTION_NAMES.USERS, uid)
    
    // Écouter les changements en temps réel
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data() as TenantProfile
          
          // Mettre à jour le cache
          globalCache.set(uid, userData)
          
          // Mettre à jour l'état uniquement si les données ont changé
          setProfile(prev => {
            // Comparaison simple pour éviter les updates inutiles
            if (JSON.stringify(prev) === JSON.stringify(userData)) return prev
            return userData
          })
        } else {
          setProfile(null)
        }
        setIsLoading(false)
      },
      (error) => {
        console.error("Error fetching tenant profile:", error)
        setIsLoading(false)
      }
    )
    
    return () => unsubscribe()
  }, [db, uid, isUserLoading])

  // Mémoriser les valeurs dérivées
  const restaurantId = profile?.restaurantId ?? null
  const role = profile?.role || ROLES.SERVER
  const isSuperAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(role as any)
  
  // État de chargement combiné
  const loading = isUserLoading || isLoading

  // Mémoriser la valeur du contexte
  const value = React.useMemo<TenantContextType>(
    () => ({
      user: user ?? null,
      profile,
      restaurantId,
      role,
      isSuperAdmin,
      loading,
    }),
    [user, profile, restaurantId, role, isSuperAdmin, loading]
  )

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = React.useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}