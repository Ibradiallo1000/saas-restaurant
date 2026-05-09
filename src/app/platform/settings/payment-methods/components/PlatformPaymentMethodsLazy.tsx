"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformPaymentMethodsClient = dynamic(
  () => import("./PlatformPaymentMethodsClient"),
  {
    ssr: false,
    loading: () => <PlatformRouteSkeleton />,
  }
)

export default function PlatformPaymentMethodsLazy() {
  return <PlatformPaymentMethodsClient />
}
