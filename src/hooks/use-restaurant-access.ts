"use client"

import * as React from "react"
import { collection, doc, limit, orderBy, query, where } from "firebase/firestore"

import {
  useCollectionOnce,
  useDocOnce,
  useFirestore,
  useMemoFirebase,
  useUser,
} from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"

type StaffAccess = {
  user: ReturnType<typeof useUser>["user"]
  isLoading: boolean
  restaurantId: string | null
  role: string | null
  active: boolean
  isAllowed: boolean
  subscriptionStatus: string | null
  accessLevel: "active" | "grace" | "expired" | "blocked"
}

export function useRestaurantAccess(allowedRoles: string[]): StaffAccess {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user?.uid])

  const { data: profile, isLoading: isProfileLoading } = useDocOnce(userProfileRef)
  const restaurantId = profile?.restaurantId || null

  const staffRef = useMemoFirebase(() => {
    if (!db || !user?.uid || !restaurantId) return null
    return doc(
      db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      "staff",
      user.uid
    )
  }, [db, user?.uid, restaurantId])

  const { data: staffProfile, isLoading: isStaffLoading } = useDocOnce(staffRef)

  const subQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      collection(db, COLLECTION_NAMES.SUBSCRIPTIONS),
      where("restaurantId", "==", restaurantId),
      orderBy("endDate", "desc"),
      limit(1)
    )
  }, [db, restaurantId])

  const { data: subscriptions, isLoading: isSubLoading } = useCollectionOnce(subQuery)
  const subscription = subscriptions?.[0] || null

  const accessLevel = React.useMemo<StaffAccess["accessLevel"]>(() => {
    if (!subscription) return "blocked"

    const now = new Date()
    const endDate = subscription.endDate?.toDate?.()

    if (subscription.status === "suspended") return "blocked"
    if (endDate && endDate < now) {
      return subscription.status === "grace" ? "grace" : "expired"
    }

    return "active"
  }, [subscription])

  return React.useMemo(() => {
    if (!restaurantId) {
      return {
        user,
        isLoading: isUserLoading || isProfileLoading,
        restaurantId: null,
        role: null,
        active: false,
        subscriptionStatus: null,
        accessLevel: "blocked",
        isAllowed: false,
      }
    }

    const role = staffProfile?.role || null
    const active = Boolean(staffProfile && staffProfile.active !== false)
    const roleAllowed = Boolean(user && role && active && allowedRoles.includes(role))
    const subscriptionAllowed = accessLevel === "active" || accessLevel === "grace"

    return {
      user,
      isLoading: isUserLoading || isProfileLoading || isStaffLoading || isSubLoading,
      restaurantId,
      role,
      active,
      subscriptionStatus: subscription?.status || null,
      accessLevel,
      isAllowed: roleAllowed && subscriptionAllowed,
    }
  }, [
    accessLevel,
    allowedRoles,
    isProfileLoading,
    isStaffLoading,
    isSubLoading,
    isUserLoading,
    restaurantId,
    staffProfile,
    subscription,
    user,
  ])
}
