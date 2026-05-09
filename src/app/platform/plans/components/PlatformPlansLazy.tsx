"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformPlansClient = dynamic(() => import("./PlatformPlansClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformPlansLazy() {
  return <PlatformPlansClient />
}
