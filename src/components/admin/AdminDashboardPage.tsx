"use client"

import * as React from "react"
import Link from "next/link"
import { Banknote, Building2, CheckCircle2, Clock, CreditCard, FileText, Percent } from "lucide-react"
import { collection } from "firebase/firestore"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { COLLECTION_NAMES, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from "@/lib/constants"
import type { Restaurant, RestaurantRequest, Subscription } from "@/types"
import { CreateRestaurantModal } from "@/components/admin/CreateRestaurantModal"
import { getPlanPrice } from "@/services/subscription.service"

export function AdminDashboardPage() {
  const db = useFirestore()

  const restaurantsRef = useMemoFirebase(() => {
    return null
  }, [db])

  const requestsRef = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, COLLECTION_NAMES.REQUESTS)
  }, [db])

  const subscriptionsRef = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, COLLECTION_NAMES.SUBSCRIPTIONS)
  }, [db])

  const { data: restaurants, isLoading: loadingRestaurants } = useCollection<Restaurant>(restaurantsRef)
  const { data: requests, isLoading: loadingRequests } = useCollection<RestaurantRequest>(requestsRef)
  const { data: subscriptions, isLoading: loadingSubscriptions } =
    useCollection<Subscription>(subscriptionsRef)

  const pendingRequests = requests?.filter((request) => request.status === "pending").length ?? 0
  const activeRestaurants =
    restaurants?.filter((restaurant) => restaurant.status === "active").length ?? 0
  const trialSubscriptions =
    subscriptions?.filter((subscription) => subscription.status === SUBSCRIPTION_STATUS.TRIAL).length ?? 0
  const paidRestaurants =
    subscriptions?.filter(
      (subscription) =>
        (subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
          subscription.status === SUBSCRIPTION_STATUS.LIFETIME) &&
        subscription.plan !== SUBSCRIPTION_PLAN.TRIAL
    ).length ?? 0
  const restaurantsFromRequests =
    restaurants?.filter((restaurant) => restaurant.source === "request").length ?? 0
  const totalRequests = requests?.length ?? 0
  const conversionRate =
    totalRequests > 0 ? `${Math.round((restaurantsFromRequests / totalRequests) * 100)}%` : "0%"
  const trialToActiveRate =
    paidRestaurants + trialSubscriptions > 0
      ? `${Math.round((paidRestaurants / (paidRestaurants + trialSubscriptions)) * 100)}%`
      : "0%"
  const estimatedMrr =
    subscriptions
      ?.filter(
        (subscription) =>
          subscription.status === SUBSCRIPTION_STATUS.ACTIVE &&
          subscription.plan !== SUBSCRIPTION_PLAN.TRIAL
      )
      .reduce((total, subscription) => total + getPlanPrice(subscription.plan), 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Provisioning, demandes et restaurants.</p>
        </div>
        <CreateRestaurantModal />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Restaurants"
          value={restaurants?.length ?? 0}
          loading={loadingRestaurants}
          icon={Building2}
        />
        <MetricCard
          title="Restaurants actifs"
          value={activeRestaurants}
          loading={loadingRestaurants}
          icon={CheckCircle2}
        />
        <MetricCard title="Demandes pending" value={pendingRequests} loading={loadingRequests} icon={Clock} />
        <MetricCard
          title="Restaurants en essai"
          value={trialSubscriptions}
          loading={loadingSubscriptions}
          icon={CreditCard}
        />
        <MetricCard
          title="Conversion"
          value={conversionRate}
          loading={loadingRestaurants || loadingRequests}
          icon={Percent}
        />
        <MetricCard
          title="Restaurants payants"
          value={paidRestaurants}
          loading={loadingSubscriptions}
          icon={CheckCircle2}
        />
        <MetricCard
          title="Conversion trial actif"
          value={trialToActiveRate}
          loading={loadingSubscriptions}
          icon={Percent}
        />
        <MetricCard
          title="MRR estime"
          value={`${estimatedMrr.toLocaleString()} XOF`}
          loading={loadingSubscriptions}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/admin/demandes">
              <FileText className="mr-2 h-4 w-4" />
              Voir les demandes
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/restaurants">
              <Building2 className="mr-2 h-4 w-4" />
              Voir les restaurants
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  loading,
  icon: Icon,
}: {
  title: string
  value: React.ReactNode
  loading: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  )
}
