"use client"

import dynamic from "next/dynamic"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"

const OrdersClient = dynamic(() => import("./OrdersClient"), {
  ssr: false,
  loading: () => <AdminRouteSkeleton />,
})

export default function OrdersLazy() {
  return <OrdersClient />
}
