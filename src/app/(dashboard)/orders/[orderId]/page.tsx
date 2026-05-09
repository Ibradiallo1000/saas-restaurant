"use client"

import OrderTrackingPage from "@/modules/public/pages/OrderTrackingPage"
import { useRestaurant } from "@/design-system/context/RestaurantContext"

export default function Page({ params }: any) {
  const { restaurantId } = useRestaurant()
  return <OrderTrackingPage orderId={params.orderId} restaurantId={restaurantId} />
}
