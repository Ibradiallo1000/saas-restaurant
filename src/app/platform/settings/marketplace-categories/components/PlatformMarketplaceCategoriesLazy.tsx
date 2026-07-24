"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformMarketplaceCategoriesClient = dynamic(() => import("./PlatformMarketplaceCategoriesClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformMarketplaceCategoriesLazy() {
  return <PlatformMarketplaceCategoriesClient />
}
