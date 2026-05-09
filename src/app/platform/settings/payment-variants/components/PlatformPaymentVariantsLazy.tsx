"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformPaymentVariantsClient = dynamic(
  () => import("./PlatformPaymentVariantsClient"),
  {
    ssr: false,
    loading: () => <PlatformRouteSkeleton />,
  }
)

export default function PlatformPaymentVariantsLazy() {
  return <PlatformPaymentVariantsClient />
}
