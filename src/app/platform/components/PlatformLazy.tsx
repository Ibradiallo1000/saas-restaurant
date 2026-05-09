"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformClient = dynamic(() => import("./PlatformClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformLazy() {
  return <PlatformClient />
}
