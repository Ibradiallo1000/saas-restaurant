"use client"

import * as React from "react"
import { doc } from "firebase/firestore"

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"

type Restaurant = {
  id?: string
  name?: string
  logoUrl?: string
  theme?: {
    primary?: string
    secondary?: string
  }
  [key: string]: any
}

type RestaurantContextType = {
  profile: any | null
  restaurantId: string | null
  role: string
  isSuperAdmin: boolean
  restaurant: Restaurant | null
  loading: boolean
}

const restaurantCache: Record<string, Restaurant> = {}

const RestaurantContext = React.createContext<RestaurantContextType>({
  profile: null,
  restaurantId: null,
  role: ROLES.SERVER,
  isSuperAdmin: false,
  restaurant: null,
  loading: false,
})

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const { profile, restaurantId, role, isSuperAdmin } = useTenant()

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId)
  }, [db, restaurantId])

  const { data, isLoading } = useDoc<Restaurant>(restaurantRef)

  React.useEffect(() => {
    if (restaurantId && data) {
      restaurantCache[restaurantId] = data
    }
  }, [restaurantId, data])

  const cachedRestaurant = restaurantId ? restaurantCache[restaurantId] ?? null : null
  const restaurant = data ?? cachedRestaurant

  const value = React.useMemo<RestaurantContextType>(
    () => ({
      profile,
      restaurantId,
      role,
      isSuperAdmin,
      restaurant,
      loading: Boolean(restaurantId && isLoading && !restaurant),
    }),
    [profile, restaurantId, role, isSuperAdmin, restaurant, isLoading]
  )

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  )
}

export function useRestaurant() {
  return React.useContext(RestaurantContext)
}
