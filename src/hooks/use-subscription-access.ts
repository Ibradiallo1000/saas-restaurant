'use client'

import * as React from "react"
import {
  collection,
  query,
  where,
  doc
} from "firebase/firestore"

import {
  useFirestore,
  useUser,
  useMemoFirebase,
  useCollection,
  useDoc
} from "@/firebase"

import { SUBSCRIPTION_STATUS, ROLES } from "@/lib/constants"

export function useSubscriptionAccess() {
  const db = useFirestore()
  const { user } = useUser()

  const [state, setState] = React.useState({
    loading: true,
    hasAccess: false,
    isTrial: false,
    isExpired: false,
    subscription: null as any
  })

  // ===============================
  // 🔥 1. PROFILE FIRESTORE
  // ===============================
  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid)
  }, [db, user])

  const { data: profile } = useDoc(profileRef)

  // ===============================
  // 🔥 2. SUPER ADMIN BYPASS
  // ===============================
  React.useEffect(() => {
    if (!profile) return

    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(profile.role)) {
      setState({
        loading: false,
        hasAccess: true,
        isTrial: false,
        isExpired: false,
        subscription: null
      })
    }
  }, [profile])

  // ===============================
  // 🔥 3. QUERY SUBSCRIPTION
  // ===============================
  const subQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null

    return query(
      collection(db, "subscriptions"),
      where("restaurantId", "==", profile.restaurantId)
    )
  }, [db, profile?.restaurantId])

  const { data: subscriptions } = useCollection(subQuery)

  // ===============================
  // 🔥 4. LOGIC
  // ===============================
  React.useEffect(() => {
    if (!profile) return

    // super admin déjà géré
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(profile.role)) return

    // pas de restaurant
    if (!profile.restaurantId) {
      setState({
        loading: false,
        hasAccess: false,
        isTrial: false,
        isExpired: true,
        subscription: null
      })
      return
    }

    // pas encore chargé
    if (!subscriptions) return

    const sub = subscriptions[0]

    // aucune subscription
    if (!sub) {
      setState({
        loading: false,
        hasAccess: false,
        isTrial: false,
        isExpired: true,
        subscription: null
      })
      return
    }

    const end = sub.endDate?.toDate?.()
    const expired = !end || end.getTime() < Date.now()

    const isTrial = sub.status === SUBSCRIPTION_STATUS.TRIAL

    const hasAccess =
      (sub.status === SUBSCRIPTION_STATUS.ACTIVE ||
        (isTrial && !expired)) &&
      !expired

    setState({
      loading: false,
      hasAccess,
      isTrial,
      isExpired: expired,
      subscription: sub
    })

  }, [subscriptions, profile])

  return state
}