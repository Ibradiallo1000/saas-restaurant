"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformSettingsClient = dynamic(() => import("./PlatformSettingsClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformSettingsLazy() {
  return <PlatformSettingsClient />
}
