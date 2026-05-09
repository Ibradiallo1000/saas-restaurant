"use client"

import dynamic from "next/dynamic"
import { POSRouteSkeleton } from "@/components/performance/route-skeletons"

const loadPOSClient = () => import("./POSClient")

const POSClient = dynamic(loadPOSClient, {
  ssr: false,
  loading: () => <POSRouteSkeleton />,
})

export default function POSLazy() {
  return <POSClient />
}
