"use client"

import * as React from "react"
import { collection, doc } from "firebase/firestore"

import { OrdersProvider, useOrders } from "@/modules/orders/OrdersProvider"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { KitchenBoard } from "@/modules/kitchen/KitchenBoard"
import {
  adaptCanonicalGroupsToKitchenBoard,
  resolveKitchenCanonicalReadMode,
  useCanonicalKitchenRead,
} from "@/modules/kitchen/canonical-read"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import { KitchenErrorState, KitchenLoadingState, KitchenOrderCardSkeleton, KitchenPage as KitchenPageShell } from "@/components/kitchen-ui"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { resolveAllowedPreparationStationIds, VIRTUAL_PREPARATION_STATIONS } from "@/lib/preparation-stations"

export default function KitchenPage() {
  const { restaurantId } = useRestaurant()
  const mode = resolveKitchenCanonicalReadMode(restaurantId ?? "")

  if (mode !== "legacy") {
    return <CanonicalKitchenPageContent restaurantId={restaurantId ?? undefined} />
  }
  return (
    <OrdersProvider restaurantId={restaurantId ?? undefined}>
      <LegacyKitchenPageContent />
    </OrdersProvider>
  )
}

function LegacyKitchenPageContent() {
  const { restaurantId } = useRestaurant()
  const { orders, isLoading } = useOrders()

  if (isLoading) {
    return (
      <KitchenPageShell>
        <KitchenLoadingState label="Chargement des commandes Cuisine" />
        <div className="mt-4 grid gap-[var(--kitchen-column-gap)] md:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <KitchenOrderCardSkeleton key={index} />)}
        </div>
      </KitchenPageShell>
    )
  }

  if (!restaurantId) {
    return <KitchenPageShell><KitchenErrorState title="Restaurant non disponible" description="Impossible d’ouvrir l’écran Cuisine pour le moment." /></KitchenPageShell>
  }

  return (
    <KitchenBoard
      orders={(orders || []) as RestaurantOrder[]}
      restaurantId={restaurantId}
    />
  )
}

function CanonicalKitchenPageContent({
  restaurantId,
}: {
  restaurantId?: string
}) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const staffRef = useMemoFirebase(() => db && restaurantId && user ? doc(db, "restaurants", restaurantId, "staff", user.uid) : null, [db, restaurantId, user])
  const stationsRef = useMemoFirebase(() => db && restaurantId ? collection(db, "restaurants", restaurantId, "preparationStations") : null, [db, restaurantId])
  const staff = useDoc<any>(staffRef)
  const stationResult = useCollection<any>(stationsRef)
  const allowedIds = React.useMemo(() => resolveAllowedPreparationStationIds(staff.data), [staff.data])
  const stations = React.useMemo(() => (stationResult.data || []).filter((station: any) => allowedIds.includes(station.id) && station.isActive !== false && station.acceptsOrders !== false), [allowedIds, stationResult.data])
  const [selectedStationId, setSelectedStationId] = React.useState<string | undefined>()
  React.useEffect(() => {
    const next = stations[0]?.id
    if (selectedStationId && stations.some((station: any) => station.id === selectedStationId)) return
    setSelectedStationId(next)
  }, [selectedStationId, stations])
  const usesVirtualKitchen = allowedIds.includes(VIRTUAL_PREPARATION_STATIONS.kitchen.id) && stations.length === 0
  const state = useCanonicalKitchenRead({
    restaurantId,
    userId: user?.uid,
    preparationStationId: usesVirtualKitchen ? undefined : selectedStationId,
    enabled: Boolean(restaurantId && user && !staff.isLoading && (usesVirtualKitchen || selectedStationId)),
  })
  const orders = React.useMemo(
    () => adaptCanonicalGroupsToKitchenBoard(state.groups),
    [state.groups]
  )

  if (isUserLoading || state.isLoading) {
    return <KitchenLoading />
  }
  if (!restaurantId) {
    return <KitchenPageShell><KitchenErrorState title="Restaurant non disponible" description="Impossible d’ouvrir l’écran Cuisine pour le moment." /></KitchenPageShell>
  }
  if (state.error) {
    return <KitchenPageShell><KitchenErrorState title="Lecture Cuisine indisponible" description="La synchronisation des lignes de commande a échoué. Réessayez dans quelques instants." /></KitchenPageShell>
  }
  return (
    <>
      {stations.length > 1 ? <div className="mb-3 max-w-sm"><label className="text-sm font-bold" htmlFor="preparation-station">Poste de préparation</label><select id="preparation-station" className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={selectedStationId || ""} onChange={(event) => setSelectedStationId(event.target.value)}>{stations.map((station: any) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></div> : null}
      {state.isSaturated ? (
        <p role="alert" className="sr-only">
          La limite de 200 lignes actives est atteinte.
        </p>
      ) : null}
      <KitchenBoard
        orders={orders as RestaurantOrder[]}
        restaurantId={restaurantId}
      />
    </>
  )
}

function KitchenLoading() {
  return (
    <KitchenPageShell>
      <KitchenLoadingState label="Chargement des commandes Cuisine" />
      <div className="mt-4 grid gap-[var(--kitchen-column-gap)] md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <KitchenOrderCardSkeleton key={index} />)}
      </div>
    </KitchenPageShell>
  )
}
