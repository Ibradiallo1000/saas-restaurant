"use client"

import * as React from "react"
import type { User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

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

const globalCache = new Map<string, TenantProfile>()

const TenantContext = React.createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const uid = user?.uid ?? null

  const [profile, setProfile] = React.useState<TenantProfile | null>(() => {
    return uid ? globalCache.get(uid) ?? null : null
  })

  const [isLoading, setIsLoading] = React.useState(!isUserLoading && !!uid)
  const previousUidRef = React.useRef<string | null>(uid)

  React.useEffect(() => {
    if (previousUidRef.current === uid) return

    previousUidRef.current = uid
    setProfile(uid ? globalCache.get(uid) ?? null : null)
    setIsLoading(Boolean(uid && !isUserLoading))
  }, [uid, isUserLoading])

  // Temporary stabilization: avoid a global Firestore Listen channel here.
  React.useEffect(() => {
    if (!db || !uid || isUserLoading) {
      if (!uid) {
        setProfile(null)
        setIsLoading(false)
      }
      return
    }

    let cancelled = false
    setIsLoading(true)

    const userDocRef = doc(db, COLLECTION_NAMES.USERS, uid)

    getDoc(userDocRef)
      .then((docSnapshot) => {
        if (cancelled) return

        if (docSnapshot.exists()) {
          const userData = docSnapshot.data() as TenantProfile

          globalCache.set(uid, userData)

          setProfile((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(userData)) return prev
            return userData
          })
        } else {
          setProfile(null)
        }

        setIsLoading(false)
      })
      .catch((error) => {
        if (cancelled) return

        console.error("Error fetching tenant profile:", error)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [db, uid, isUserLoading])

  const restaurantId = isUserLoading || isLoading ? null : profile?.restaurantId ?? null
  const role = profile?.role || ROLES.SERVER
  const isSuperAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(role as any)
  const loading = isUserLoading || isLoading

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

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = React.useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}
