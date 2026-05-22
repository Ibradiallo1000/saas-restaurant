"use client"

import dynamic from "next/dynamic"
import { ManagerRouteSkeleton } from "@/components/performance/route-skeletons"

const loadManagerClient = () => import("./ManagerClient")

const ManagerClient = dynamic(loadManagerClient, {
  ssr: false,
  loading: () => <ManagerRouteSkeleton />,
})

type ManagerMode = "dashboard" | "orders" | "menu"

export default function ManagerLazy({ mode = "dashboard" }: { mode?: ManagerMode }) {
  return <ManagerClient mode={mode} />
}
