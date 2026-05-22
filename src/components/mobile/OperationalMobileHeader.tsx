"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { Bell, LogOut, Menu, Settings, User } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useAuth } from "@/firebase"
import { ROLES } from "@/lib/constants"
import { getOptimizedImage } from "@/lib/image"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

export default function OperationalMobileHeader() {
  const auth = useAuth()
  const router = useRouter()
  const { restaurant } = useRestaurant()
  const { user, role } = useTenant()
  const { cashSessionRequests, unpaidServedCount, activeOrders } = useRestaurantLiveData()
  const restaurantName = restaurant?.name?.trim() || "Restaurant"
  const userLabel = user?.displayName || user?.email?.split("@")[0] || "Utilisateur"
  const lateOrdersCount = React.useMemo(
    () => (activeOrders || []).filter((order: any) => isLateKitchenOrder(order)).length,
    [activeOrders]
  )
  const notificationsCount = cashSessionRequests.length + unpaidServedCount + lateOrdersCount

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-foreground"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="flex h-full w-[86vw] max-w-sm flex-col p-0 md:hidden">
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle className="text-sm font-black uppercase">Compte</SheetTitle>
            <SheetDescription className="sr-only">
              Accès au profil, aux paramètres et à la déconnexion.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 p-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{userLabel}</p>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">{role}</p>
                </div>
              </div>
            </div>

            {role === ROLES.OWNER ? (
              <SheetClose asChild>
                <Link
                  href="/settings"
                  className="flex min-h-12 items-center gap-3 rounded-xl border bg-card px-3 text-sm font-black"
                >
                  <Settings className="h-5 w-5 text-primary" />
                  Parametres
                </Link>
              </SheetClose>
            ) : null}
          </div>

          <div className="border-t p-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black text-muted-foreground hover:bg-muted"
            >
              <LogOut className="h-5 w-5" />
              Déconnexion
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="mx-3 flex min-w-0 flex-1 items-center justify-center gap-2">
        {restaurant?.logoUrl ? (
          <img
            src={getOptimizedImage(restaurant.logoUrl, 96)}
            alt={restaurantName}
            className="h-7 w-7 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <span className="truncate text-sm font-black uppercase tracking-tight">{restaurantName}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground"
          aria-label={`${notificationsCount} notification(s)`}
        >
          <Bell className="h-5 w-5" />
          {notificationsCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-black leading-4 text-white">
              {notificationsCount > 9 ? "9+" : notificationsCount}
            </span>
          ) : null}
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
          {userLabel.slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  )
}

function isLateKitchenOrder(order: any) {
  const status = order?.status || order?.orderStatus
  if (status !== "pending" && status !== "preparing") return false
  const createdAt =
    order?.createdAt?.toDate?.().getTime?.() ??
    (typeof order?.createdAt?.seconds === "number" ? order.createdAt.seconds * 1000 : null)
  if (!createdAt) return false
  return Date.now() - createdAt > 20 * 60 * 1000
}
