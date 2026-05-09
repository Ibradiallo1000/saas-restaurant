"use client"

import dynamic from "next/dynamic"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"

const RestaurantSettingsClient = dynamic(
  () => import("./RestaurantSettingsClient"),
  {
    ssr: false,
    loading: () => <AdminRouteSkeleton />,
  }
)

export default function SettingsLazy() {
  return <RestaurantSettingsClient />
}
