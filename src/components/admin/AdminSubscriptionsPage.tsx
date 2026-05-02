"use client"

import * as React from "react"
import { collection } from "firebase/firestore"
import { CheckCircle2, Clock, Loader2, ShieldOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useUserClaims } from "@/hooks/use-user-claims"
import {
  COLLECTION_NAMES,
  ROLES,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLAN_LABELS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Restaurant, RestaurantPlan, Subscription, SubscriptionStatus } from "@/types"
import {
  activateGracePeriod,
  grantLifetimeAccess,
  setSubscriptionCurrentPeriodEnd,
  suspendSubscription,
  updateSubscriptionPlan,
} from "@/services/subscription.service"

type FilterValue = "all" | SubscriptionStatus

export function AdminSubscriptionsPage() {
  const db = useFirestore()
  const { role } = useUserClaims()
  const { toast } = useToast()
  const [filter, setFilter] = React.useState<FilterValue>("all")
  const [busyRestaurantId, setBusyRestaurantId] = React.useState<string | null>(null)
  const [periodEndsByRestaurant, setPeriodEndsByRestaurant] = React.useState<Record<string, string>>({})
  const [graceEndsByRestaurant, setGraceEndsByRestaurant] = React.useState<Record<string, string>>({})
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  const subscriptionsRef = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, COLLECTION_NAMES.SUBSCRIPTIONS)
  }, [db])

  const restaurantsRef = useMemoFirebase(() => {
    return null
  }, [db])

  const { data: subscriptions, isLoading: loadingSubscriptions } =
    useCollection<Subscription>(subscriptionsRef)
  const { data: restaurants, isLoading: loadingRestaurants } = useCollection<Restaurant>(restaurantsRef)

  const restaurantsById = React.useMemo(() => {
    return new Map((restaurants ?? []).map((restaurant) => [restaurant.id, restaurant]))
  }, [restaurants])

  const filteredSubscriptions = React.useMemo(() => {
    return [...(subscriptions ?? [])]
      .filter((subscription) => filter === "all" || subscription.status === filter)
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis?.() ?? 0
        const secondTime = second.createdAt?.toMillis?.() ?? 0
        return secondTime - firstTime
      })
  }, [filter, subscriptions])

  const runAction = async (
    restaurantId: string,
    action: () => Promise<void>,
    successTitle: string
  ) => {
    if (!db || busyRestaurantId) return
    setBusyRestaurantId(restaurantId)

    try {
      await action()
      toast({ title: successTitle })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Action impossible",
        description: error?.message || "La mise a jour a echoue.",
      })
    } finally {
      setBusyRestaurantId(null)
    }
  }

  const isLoading = loadingSubscriptions || loadingRestaurants

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Abonnements</h1>
          <p className="text-sm text-muted-foreground">
            Gestion manuelle des plans, périodes, tolérances et suspensions.
          </p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value={SUBSCRIPTION_STATUS.TRIAL}>
              {SUBSCRIPTION_STATUS_LABELS[SUBSCRIPTION_STATUS.TRIAL]}
            </SelectItem>
            <SelectItem value={SUBSCRIPTION_STATUS.ACTIVE}>
              {SUBSCRIPTION_STATUS_LABELS[SUBSCRIPTION_STATUS.ACTIVE]}
            </SelectItem>
            <SelectItem value={SUBSCRIPTION_STATUS.GRACE}>
              {SUBSCRIPTION_STATUS_LABELS[SUBSCRIPTION_STATUS.GRACE]}
            </SelectItem>
            <SelectItem value={SUBSCRIPTION_STATUS.SUSPENDED}>
              {SUBSCRIPTION_STATUS_LABELS[SUBSCRIPTION_STATUS.SUSPENDED]}
            </SelectItem>
            <SelectItem value={SUBSCRIPTION_STATUS.LIFETIME}>
              {SUBSCRIPTION_STATUS_LABELS[SUBSCRIPTION_STATUS.LIFETIME]}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liste abonnements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucun abonnement.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de fin</TableHead>
                  <TableHead>Tolérance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((subscription) => {
                  const restaurant = restaurantsById.get(subscription.restaurantId)
                  const isBusy = busyRestaurantId === subscription.restaurantId
                  const periodEndValue =
                    periodEndsByRestaurant[subscription.restaurantId] ??
                    toDateInputValue(subscription.currentPeriodEnd)
                  const graceEndValue =
                    graceEndsByRestaurant[subscription.restaurantId] ??
                    toDateInputValue(subscription.graceEndsAt)

                  return (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div className="font-medium">{restaurant?.name ?? "Inconnu"}</div>
                        <div className="text-xs text-muted-foreground">{subscription.restaurantId}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={subscription.plan}
                          onValueChange={(plan) =>
                            runAction(
                              subscription.restaurantId,
                              () =>
                                updateSubscriptionPlan(
                                  db,
                                  subscription.restaurantId,
                                  plan as RestaurantPlan
                                ),
                              "Plan mis a jour"
                            )
                          }
                          disabled={Boolean(busyRestaurantId)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SUBSCRIPTION_PLAN.TRIAL}>
                              {SUBSCRIPTION_PLAN_LABELS[SUBSCRIPTION_PLAN.TRIAL]}
                            </SelectItem>
                            <SelectItem value={SUBSCRIPTION_PLAN.BASIC}>
                              {SUBSCRIPTION_PLAN_LABELS[SUBSCRIPTION_PLAN.BASIC]}
                            </SelectItem>
                            <SelectItem value={SUBSCRIPTION_PLAN.PRO}>
                              {SUBSCRIPTION_PLAN_LABELS[SUBSCRIPTION_PLAN.PRO]}
                            </SelectItem>
                            <SelectItem value={SUBSCRIPTION_PLAN.CUSTOM}>
                              {SUBSCRIPTION_PLAN_LABELS[SUBSCRIPTION_PLAN.CUSTOM]}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={subscription.status} />
                      </TableCell>
                      <TableCell>{formatEndDate(subscription)}</TableCell>
                      <TableCell>{formatDate(subscription.graceEndsAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Input
                              type="date"
                              value={periodEndValue}
                              onChange={(event) =>
                                setPeriodEndsByRestaurant((current) => ({
                                  ...current,
                                  [subscription.restaurantId]: event.target.value,
                                }))
                              }
                              className="h-9 w-40"
                              disabled={Boolean(busyRestaurantId)}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busyRestaurantId) || !periodEndValue}
                              onClick={() =>
                                runAction(
                                  subscription.restaurantId,
                                  () =>
                                    setSubscriptionCurrentPeriodEnd(
                                      db,
                                      subscription.restaurantId,
                                      parseDateInput(periodEndValue)
                                    ),
                                  "Date de fin mise a jour"
                                )
                              }
                            >
                              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Activer
                            </Button>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <Input
                              type="date"
                              value={graceEndValue}
                              onChange={(event) =>
                                setGraceEndsByRestaurant((current) => ({
                                  ...current,
                                  [subscription.restaurantId]: event.target.value,
                                }))
                              }
                              className="h-9 w-40"
                              disabled={Boolean(busyRestaurantId)}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busyRestaurantId) || !graceEndValue}
                              onClick={() =>
                                runAction(
                                  subscription.restaurantId,
                                  () =>
                                    activateGracePeriod(
                                      db,
                                      subscription.restaurantId,
                                      parseDateInput(graceEndValue)
                                    ),
                                  "Mode tolérance activé"
                                )
                              }
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              Tolérance
                            </Button>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            {isSuperAdmin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={Boolean(busyRestaurantId)}
                                onClick={() =>
                                  runAction(
                                    subscription.restaurantId,
                                    () => grantLifetimeAccess(db, subscription.restaurantId),
                                    "Accès illimité activé"
                                  )
                                }
                              >
                                Accès illimité
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busyRestaurantId)}
                              onClick={() =>
                                runAction(
                                  subscription.restaurantId,
                                  () => suspendSubscription(db, subscription.restaurantId),
                                  "Abonnement suspendu"
                                )
                              }
                            >
                              <ShieldOff className="mr-2 h-4 w-4" />
                              Suspendre
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === SUBSCRIPTION_STATUS.ACTIVE && "border-green-200 bg-green-50 text-green-700",
        status === SUBSCRIPTION_STATUS.TRIAL && "border-blue-200 bg-blue-50 text-blue-700",
        status === SUBSCRIPTION_STATUS.GRACE && "border-amber-200 bg-amber-50 text-amber-700",
        status === SUBSCRIPTION_STATUS.SUSPENDED && "border-red-200 bg-red-50 text-red-700",
        status === SUBSCRIPTION_STATUS.LIFETIME && "border-purple-200 bg-purple-50 text-purple-700"
      )}
    >
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  )
}

function formatEndDate(subscription: Subscription) {
  if (subscription.status === SUBSCRIPTION_STATUS.LIFETIME) return "Accès permanent"
  return formatDate(subscription.currentPeriodEnd ?? subscription.trialEndsAt)
}

function formatDate(timestamp: Subscription["trialEndsAt"]) {
  if (!timestamp) return "-"
  return timestamp.toDate().toLocaleDateString()
}

function toDateInputValue(timestamp: Subscription["trialEndsAt"]) {
  if (!timestamp) return ""
  return timestamp.toDate().toISOString().slice(0, 10)
}

function parseDateInput(value: string) {
  return new Date(`${value}T23:59:59`)
}
