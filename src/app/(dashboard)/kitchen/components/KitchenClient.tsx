"use client"

import { OrdersProvider, useOrders } from "@/modules/orders/OrdersProvider"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { KitchenBoard } from "@/modules/kitchen/KitchenBoard"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import { KitchenErrorState, KitchenLoadingState, KitchenOrderCardSkeleton, KitchenPage as KitchenPageShell } from "@/components/kitchen-ui"

export default function KitchenPage() {
  const { restaurantId } = useRestaurant()

  return (
    <OrdersProvider restaurantId={restaurantId ?? undefined}>
      <KitchenPageContent />
    </OrdersProvider>
  )
}

function KitchenPageContent() {
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
