"use client"

import * as React from "react"
import { Check, Loader2, X } from "lucide-react"
import { collection, doc, updateDoc, where, query } from "firebase/firestore"

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
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import { createRestaurant } from "@/services/onboarding-api.service"
import type { RestaurantRequest } from "@/types"

type OnboardingRestaurantRequest = RestaurantRequest & {
  slug?: string
  userId?: string
  ownerUserId?: string
}

export function AdminRequestsPage() {
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, COLLECTION_NAMES.REQUESTS), where("status", "==", "pending"))
  }, [db])

  const { data: requests, isLoading } = useCollection<OnboardingRestaurantRequest>(requestsQuery)

  const sortedRequests = React.useMemo(() => {
    return [...(requests ?? [])].sort((first, second) => {
      const firstTime = first.createdAt?.toMillis?.() ?? 0
      const secondTime = second.createdAt?.toMillis?.() ?? 0
      return secondTime - firstTime
    })
  }, [requests])

  const approveRequest = async (request: OnboardingRestaurantRequest) => {
    if (!db || busyId) return
    setBusyId(request.id)

    try {
      const actorToken = await user?.getIdToken()
      const ownerUserId = request.userId ?? request.ownerUserId

      if (!ownerUserId) {
        throw new Error("UID Firebase Auth proprietaire manquant sur la demande.")
      }

      await createRestaurant(
        {
          name: request.restaurantName,
          email: request.email,
          slug: request.slug ?? slugify(request.restaurantName),
          userId: ownerUserId,
          requestId: request.id,
        },
        actorToken
      )

      toast({
        title: "Demande approuvee",
        description: "Le restaurant a ete provisionne.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Approbation impossible",
        description: error?.message || "Le provisioning a echoue.",
      })
    } finally {
      setBusyId(null)
    }
  }

  const rejectRequest = async (requestId: string) => {
    if (!db || busyId) return
    setBusyId(requestId)

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.REQUESTS, requestId), {
        status: "rejected",
      })

      toast({
        title: "Demande rejetee",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Rejet impossible",
        description: error?.message || "La demande n'a pas ete mise a jour.",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes"
        subtitle="Demandes en attente de validation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucune demande pending.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRequests.map((request) => {
                  const isBusy = busyId === request.id

                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.restaurantName}</TableCell>
                      <TableCell>{request.email}</TableCell>
                      <TableCell>{request.country}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveRequest(request)}
                            disabled={Boolean(busyId)}
                          >
                            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectRequest(request.id)}
                            disabled={Boolean(busyId)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Rejeter
                          </Button>
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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
