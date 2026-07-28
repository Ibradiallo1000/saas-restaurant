"use client"

import { usePathname } from "next/navigation"

import { GlobalTimeFilterBar } from "@/components/time-filter/GlobalTimeFilterBar"

const PERIOD_FILTER_ROUTES = new Set([
  "/manager/dashboard",
  "/manager/commandes",
  "/manager/caisse",
  "/manager/tresorerie",
  "/manager/treasury",
  "/manager/depenses",
  "/manager/expenses",
  "/manager/inventory",
  "/manager/stock",
])

export function ManagerPeriodFilter() {
  const pathname = usePathname() ?? ""
  if (!PERIOD_FILTER_ROUTES.has(pathname)) return null

  return (
    <div className="max-w-full overflow-x-auto pb-1 sm:pb-0">
      <GlobalTimeFilterBar compact />
    </div>
  )
}

export function managerRouteUsesPeriodFilter(pathname: string) {
  return PERIOD_FILTER_ROUTES.has(pathname)
}
