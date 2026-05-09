"use client"

import dynamic from "next/dynamic"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"

const ImagesPage = dynamic(() => import("@/components/dashboard/ImagesPage"), {
  ssr: false,
  loading: () => <AdminRouteSkeleton />,
})

export default function ImagesLazy() {
  return <ImagesPage />
}
