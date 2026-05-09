"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformBillingClient = dynamic(() => import("./PlatformBillingClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformBillingLazy() {
  return <PlatformBillingClient />
}
