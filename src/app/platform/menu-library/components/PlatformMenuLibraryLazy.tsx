"use client"

import dynamic from "next/dynamic"

import { PlatformRouteSkeleton } from "@/components/performance/platform-route-skeleton"

const PlatformMenuLibraryClient = dynamic(() => import("./PlatformMenuLibraryClient"), {
  ssr: false,
  loading: () => <PlatformRouteSkeleton />,
})

export default function PlatformMenuLibraryLazy() {
  return <PlatformMenuLibraryClient />
}

