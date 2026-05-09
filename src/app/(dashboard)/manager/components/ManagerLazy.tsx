"use client"

import dynamic from "next/dynamic"
import { ManagerRouteSkeleton } from "@/components/performance/route-skeletons"

const loadManagerClient = () => import("./ManagerClient")

const ManagerClient = dynamic(loadManagerClient, {
  ssr: false,
  loading: () => <ManagerRouteSkeleton />,
})

export default function ManagerLazy() {
  return <ManagerClient />
}
