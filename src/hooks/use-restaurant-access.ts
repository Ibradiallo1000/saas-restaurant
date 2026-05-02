"use client"

import * as React from "react"
import { doc, collection, query, where, orderBy, limit } from "firebase/firestore"

import {
  useDoc,
  useFirestore,
  useMemoFirebase,
  useUser,
  useCollection
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

  // ===============================
  // 👤 USER PROFILE
  // ===============================
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user?.uid])

  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  const restaurantId = profile?.restaurantId || null

  // 🔴 STOP TOTAL si pas de restaurant
  if (!restaurantId) {
    return {
      user,
      isLoading: isUserLoading || isProfileLoading,
      restaurantId: null,
      role: null,
      active: false,
      subscriptionStatus: null,
      accessLevel: "blocked",
      isAllowed: false
    }
  }

  // ===============================
  // 🏢 STAFF PROFILE
  // ===============================
  const staffRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null
    return doc(
      db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      "staff",
      user.uid
    )
  }, [db, user?.uid, restaurantId])

  const { data: staffProfile, isLoading: isStaffLoading } = useDoc(staffRef)

  // ===============================
  // 💳 SUBSCRIPTION
  // ===============================
  const subQuery = useMemoFirebase(() => {
    if (!db) return null

    return query(
      collection(db, COLLECTION_NAMES.SUBSCRIPTIONS),
      where("restaurantId", "==", restaurantId),
      orderBy("endDate", "desc"),
      limit(1)
    )
  }, [db, restaurantId])

  const { data: subscriptions, isLoading: isSubLoading } =
    useCollection(subQuery)

  const subscription = subscriptions?.[0] || null

  // ===============================
  // 🧠 BUSINESS LOGIC
  // ===============================
  const accessLevel = React.useMemo(() => {
    if (!subscription) return "blocked"

    const now = new Date()
    const endDate = subscription.endDate?.toDate?.()

    if (subscription.status === "suspended") return "blocked"

    if (endDate && endDate < now) {
      return subscription.status === "grace" ? "grace" : "expired"
    }

    return "active"
  }, [subscription])

  // ===============================
  // 🔐 FINAL ACCESS
  // ===============================
  return React.useMemo(() => {
    const role = staffProfile?.role || null
    const active = Boolean(staffProfile && staffProfile.active !== false)

    const roleAllowed = Boolean(
      user &&
        role &&
        active &&
        allowedRoles.includes(role)
    )

    const subscriptionAllowed =
      accessLevel === "active" || accessLevel === "grace"

    return {
      user,
      isLoading:
        isUserLoading ||
        isProfileLoading ||
        isStaffLoading ||
        isSubLoading,

      restaurantId,
      role,
      active,

      subscriptionStatus: subscription?.status || null,
      accessLevel,

      isAllowed: roleAllowed && subscriptionAllowed
    }
  }, [
    allowedRoles,
    accessLevel,
    isProfileLoading,
    isStaffLoading,
    isSubLoading,
    isUserLoading,
    staffProfile,
    subscription,
    user
  ])
}