"use client"

import * as React from "react"
import { Building2, Loader2, RotateCcw, ShieldOff } from "lucide-react"
import { collection, doc, updateDoc } from "firebase/firestore"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { PageHeader } from "@/design-system/components"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import type { Restaurant } from "@/types"
import { CreateRestaurantModal } from "@/components/admin/CreateRestaurantModal"
import { cn } from "@/lib/utils"

export function AdminRestaurantsPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const restaurantsRef = useMemoFirebase(() => {
    return null
  }, [db])

  const { data: restaurants, isLoading } = useCollection<Restaurant>(restaurantsRef)

  const sortedRestaurants = React.useMemo(() => {
    return [...(restaurants ?? [])].sort((first, second) => {
      const firstTime = first.createdAt?.toMillis?.() ?? 0
      const secondTime = second.createdAt?.toMillis?.() ?? 0
      return secondTime - firstTime
    })
  }, [restaurants])

  const updateStatus = async (restaurantId: string, status: "active" | "suspended") => {
    if (!db || busyId) return
    setBusyId(restaurantId)

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId), { status })
      toast({
        title: status === "active" ? "Restaurant reactive" : "Restaurant suspendu",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Mise a jour impossible",
        description: error?.message || "Le statut n'a pas ete modifie.",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        subtitle="Liste et statut des restaurants."
        action={<CreateRestaurantModal />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Restaurants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedRestaurants.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucun restaurant cree.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRestaurants.map((restaurant) => {
                  const isBusy = busyId === restaurant.id
                  const isSuspended = restaurant.status === "suspended"

                  return (
                    <TableRow key={restaurant.id}>
                      <TableCell>
                        <div className="font-medium">{restaurant.name}</div>
                        <div className="text-xs text-muted-foreground">{restaurant.email}</div>
                      </TableCell>
                      <TableCell>{restaurant.country}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            restaurant.status === "active" &&
                              "border-green-200 bg-green-50 text-green-700",
                            restaurant.status === "suspended" &&
                              "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {restaurant.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {isSuspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(restaurant.id, "active")}
                              disabled={Boolean(busyId)}
                            >
                              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                              Reactiver
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(restaurant.id, "suspended")}
                              disabled={Boolean(busyId)}
                            >
                              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                              Suspendre
                            </Button>
                          )}
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
