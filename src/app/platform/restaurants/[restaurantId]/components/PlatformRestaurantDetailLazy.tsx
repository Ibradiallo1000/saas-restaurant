"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformRestaurantDetailClient = dynamic(
  () => import("./PlatformRestaurantDetailClient"),
  {
    ssr: false,
    loading: () => <PlatformRouteSkeleton />,
  }
)

export default function PlatformRestaurantDetailLazy() {
  return <PlatformRestaurantDetailClient />
}
