"use client"

import dynamic from "next/dynamic"
import { KitchenRouteSkeleton } from "@/components/performance/route-skeletons"

const loadKitchenClient = () => import("./KitchenClient")

const KitchenClient = dynamic(loadKitchenClient, {
  ssr: false,
  loading: () => <KitchenRouteSkeleton />,
})

export default function KitchenLazy() {
  return <KitchenClient />
}
