"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, LayoutDashboard, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

const MOBILE_MANAGER_NAV = [
  { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
  { label: "Commandes", href: "/manager/commandes", icon: ClipboardList, withBadge: true },
  { label: "Caisse", href: "/manager/caisse", icon: Wallet },
]

export default function ManagerBottomNav() {
  const pathname = usePathname() ?? ""
  const pendingPaymentCount = useManagerPendingPaymentCount()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 w-full items-center justify-around border-t bg-background md:hidden">
      {MOBILE_MANAGER_NAV.map((item) => {
        const active = isActivePath(pathname, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground",
              active && "text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
            {item.withBadge && pendingPaymentCount > 0 ? (
              <span className="absolute right-4 top-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                {pendingPaymentCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function useManagerPendingPaymentCount() {
  return useRestaurantLiveData().unpaidServedCount
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
