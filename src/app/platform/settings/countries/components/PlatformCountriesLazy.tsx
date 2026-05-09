"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformCountriesClient = dynamic(() => import("./PlatformCountriesClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformCountriesLazy() {
  return <PlatformCountriesClient />
}
