"use client"

import * as React from "react"

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
import { useUser } from "@/firebase"

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
  const state = useCanonicalKitchenRead({
    restaurantId,
    userId: user?.uid,
    enabled: Boolean(restaurantId && user),
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
