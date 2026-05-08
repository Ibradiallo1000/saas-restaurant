"use client"

import { OrdersProvider, useOrders } from "@/modules/orders/OrdersProvider"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { KitchenBoard } from "@/modules/kitchen/KitchenBoard"
import type { RestaurantOrder } from "@/modules/restaurant/types"

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
    return <div className="p-6">Chargement des commandes...</div>
  }

  if (!restaurantId) {
    return <div className="p-6">Restaurant non disponible.</div>
  }

  return (
    <KitchenBoard
      orders={(orders || []) as RestaurantOrder[]}
      restaurantId={restaurantId}
    />
  )
}
