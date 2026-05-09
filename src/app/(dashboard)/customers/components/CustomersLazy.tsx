"use client"

import dynamic from "next/dynamic"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"

const CustomersClient = dynamic(() => import("./CustomersClient"), {
  ssr: false,
  loading: () => <AdminRouteSkeleton />,
})

export default function CustomersLazy() {
  return <CustomersClient />
}
