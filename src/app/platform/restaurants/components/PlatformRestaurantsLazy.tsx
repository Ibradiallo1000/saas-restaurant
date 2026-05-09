"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformRestaurantsClient = dynamic(() => import("./PlatformRestaurantsClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformRestaurantsLazy() {
  return <PlatformRestaurantsClient />
}
