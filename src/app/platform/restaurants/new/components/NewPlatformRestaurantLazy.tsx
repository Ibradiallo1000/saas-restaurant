"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const NewPlatformRestaurantClient = dynamic(() => import("./NewPlatformRestaurantClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function NewPlatformRestaurantLazy() {
  return <NewPlatformRestaurantClient />
}
