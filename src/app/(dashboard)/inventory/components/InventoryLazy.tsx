"use client"

import dynamic from "next/dynamic"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"

const InventoryClient = dynamic(() => import("./InventoryClient"), {
  ssr: false,
  loading: () => <AdminRouteSkeleton />,
})

export default function InventoryLazy() {
  return <InventoryClient />
}
