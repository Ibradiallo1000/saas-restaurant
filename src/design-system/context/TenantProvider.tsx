"use client"

import * as React from "react"
import type { User } from "firebase/auth"
import { doc } from "firebase/firestore"

import { useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
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

const tenantProfileCache: Record<string, TenantProfile> = {}

const TenantContext = React.createContext<TenantContextType>({
  user: null,
  profile: null,
  restaurantId: null,
  role: ROLES.SERVER,
  isSuperAdmin: false,
  loading: true,
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const uid = user?.uid ?? null

  const userRef = useMemoFirebase(() => {
    if (!db || !uid) return null
    return doc(db, COLLECTION_NAMES.USERS, uid)
  }, [db, uid])

  const { data, isLoading } = useDoc<TenantProfile>(userRef)

  React.useEffect(() => {
    if (uid && data) {
      tenantProfileCache[uid] = data
    }
  }, [uid, data])

  const cachedProfile = uid ? tenantProfileCache[uid] ?? null : null
  const profile = data ?? cachedProfile
  const restaurantId = profile?.restaurantId ?? null
  const role = profile?.role || ROLES.SERVER
  const isSuperAdmin = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(role as any)

  const value = React.useMemo<TenantContextType>(
    () => ({
      user,
      profile,
      restaurantId,
      role,
      isSuperAdmin,
      loading: isUserLoading || (Boolean(uid) && isLoading && !profile),
    }),
    [user, profile, restaurantId, role, isSuperAdmin, isUserLoading, uid, isLoading]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  return React.useContext(TenantContext)
}
