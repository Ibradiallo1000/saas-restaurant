"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { collection, limit, orderBy, query } from "firebase/firestore"
import { useCollectionOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import { PlatformBillingView } from "./PlatformBillingView"
import { buildPlatformBillingViewModel } from "./platform-billing-view-model"

export default function BillingAdminPage() {
  const db = useFirestore()
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const plansQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, COLLECTION_NAMES.PLANS), limit(20))
  }, [db])
  const { data: plans, isLoading: isPlansLoading, error: plansError } = useCollectionOnce(plansQuery)

  const subsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, COLLECTION_NAMES.SUBSCRIPTIONS), orderBy("endDate", "desc"), limit(50))
  }, [db])
  const { data: subscriptions, isLoading: isSubscriptionsLoading, error: subscriptionsError } = useCollectionOnce(subsQuery)

  const restQuery = useMemoFirebase(() => null, [db])
  const { data: restaurants } = useCollectionOnce(restQuery)

  const stats = React.useMemo(() => {
    if (!subscriptions || !plans || !mounted) return { mrr: 0, alerts: 0, count: 0 }
    const now = new Date()
    const active = subscriptions.filter((subscription) => subscription.status === "active")
    const mrr = active.reduce((total, subscription) => {
      const plan = plans.find((candidate) => candidate.id === subscription.planId)
      return total + (plan?.price || 0)
    }, 0)
    const alerts = active.filter((subscription) => {
      const end = subscription.endDate?.toDate?.()
      if (!end) return false
      return end < new Date(now.getTime() + 7 * 86400000)
    }).length
    return { mrr, alerts, count: active.length }
  }, [mounted, plans, subscriptions])

  const joinedSubscriptions = React.useMemo(() => (subscriptions ?? []).map((subscription) => ({
    subscription,
    restaurant: restaurants?.find((restaurant) => restaurant.id === subscription.restaurantId),
    plan: plans?.find((plan) => plan.id === subscription.planId),
  })), [plans, restaurants, subscriptions])
  const viewModel = React.useMemo(() => buildPlatformBillingViewModel(joinedSubscriptions, plans ?? [], mounted), [joinedSubscriptions, mounted, plans])

  return <PlatformBillingView subscriptions={viewModel.subscriptions} plans={viewModel.plans} stats={stats} loading={!mounted || isPlansLoading || isSubscriptionsLoading} error={Boolean(plansError || subscriptionsError)} onManagePlans={() => router.push("/platform/plans")} />
}
