"use client"

import dynamic from "next/dynamic"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"

const RestaurantPaymentsSettingsClient = dynamic(
  () => import("./RestaurantPaymentsSettingsClient"),
  {
    ssr: false,
    loading: () => <AdminRouteSkeleton />,
  }
)

export default function PaymentsSettingsLazy() {
  return <RestaurantPaymentsSettingsClient />
}
