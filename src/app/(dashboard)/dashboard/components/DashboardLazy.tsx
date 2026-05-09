"use client"

import dynamic from "next/dynamic"
import { DashboardRouteSkeleton } from "@/components/performance/route-skeletons"

const loadDashboardClient = () => import("./DashboardClient")

const DashboardClient = dynamic(loadDashboardClient, {
  ssr: false,
  loading: () => <DashboardRouteSkeleton />,
})

export default function DashboardLazy() {
  return <DashboardClient />
}
