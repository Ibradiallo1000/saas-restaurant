"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import {
  Banknote,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MenuSquare,
  Package,
  ReceiptText,
  Settings,
  Table2,
  User,
  UserRound,
  Wallet,
} from "lucide-react"

import OperationalBottomNav from "@/components/mobile/OperationalBottomNav"
import OperationalMobileHeader from "@/components/mobile/OperationalMobileHeader"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/firebase"
import { RestaurantProvider, useRestaurant } from "@/design-system/context/RestaurantContext"
import { TenantProvider, useTenant } from "@/design-system/context/TenantProvider"
import { RestaurantThemeProvider } from "@/design-system/theme/RestaurantThemeProvider"
import { getOptimizedImage } from "@/lib/image"
import { canAccessManager, getRoleHomePath, isRouteAllowedForRole } from "@/lib/guards"
import { ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { RestaurantLiveDataProvider, useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"

const MANAGER_NAV = [
  { label: "Analytics", href: "/manager/dashboard", icon: LayoutDashboard },
  { label: "Commandes", href: "/manager/commandes", icon: ClipboardList, withBadge: true },
  { label: "Caisse", href: "/manager/caisse", icon: Wallet },
  { label: "Menu", href: "/manager/menu", icon: MenuSquare },
  { label: "Images", href: "/manager/images", icon: ImageIcon },
  { label: "Inventaire", href: "/manager/inventory", icon: Package },
  { label: "Dépenses", href: "/manager/expenses", icon: ReceiptText },
  { label: "Fournisseurs", href: "/manager/suppliers", icon: UserRound },
  { label: "Trésorerie", href: "/manager/treasury", icon: Banknote },
  { label: "Cuisine", href: "/manager/cuisine", icon: ChefHat },
]

const MOBILE_MANAGER_DRAWER_NAV: typeof MANAGER_NAV = []

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <RestaurantProvider>
        <RestaurantThemeProvider>
          <RestaurantLiveDataProvider>
            <ManagerLayoutContent>{children}</ManagerLayoutContent>
          </RestaurantLiveDataProvider>
        </RestaurantThemeProvider>
      </RestaurantProvider>
    </TenantProvider>
  )
}

function ManagerLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? "/manager/dashboard"
  const tenant = useTenant()
  const restaurant = useRestaurant()
  const isMobile = useIsMobile()
  const loading = tenant.loading || restaurant.loading
  const hasManagerAccess = canAccessManager(tenant.role as any)
  const isAllowedForRole = isRouteAllowedForRole(pathname, tenant.role as any)

  React.useEffect(() => {
    if (loading) return
    if (!tenant.user) {
      router.replace("/login")
      return
    }
    if (!hasManagerAccess) {
      router.replace(getRoleHomePath(tenant.role as any))
      return
    }
    if (!isAllowedForRole) {
      router.replace(getRoleHomePath(tenant.role as any))
    }
  }, [hasManagerAccess, isAllowedForRole, loading, pathname, router, tenant.role, tenant.user])

  if (loading || !tenant.user || !hasManagerAccess || !isAllowedForRole) {
    return <AdminRouteSkeleton />
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <OperationalMobileHeader />
        <main className="flex flex-col gap-4 px-3 pb-[calc(80px+env(safe-area-inset-bottom))] pt-[calc(56px+env(safe-area-inset-top)+8px)]">{children}</main>
        <OperationalBottomNav />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <ManagerSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ManagerHeader />
        <main className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </main>
      </div>
    </div>
  )
}

function ManagerSidebar() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const auth = useAuth()
  const { restaurant } = useRestaurant()
  const { user, role } = useTenant()
  const pendingPaymentCount = useManagerPendingPaymentCount()
  const pendingCashOpeningCount = useManagerPendingCashOpeningCount()
  const [collapsed, setCollapsed] = React.useState(false)

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  return (
    <aside className={cn(
      "flex h-screen shrink-0 flex-col border-r bg-card text-card-foreground transition-all",
      collapsed ? "w-40" : "w-64"
    )}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className={cn("flex min-w-0 items-center gap-2", collapsed && "justify-center")}>
          {restaurant?.logoUrl ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent">
              <img
                src={getOptimizedImage(restaurant.logoUrl, 120)}
                alt={restaurant?.name || "Restaurant"}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Wallet className="h-5 w-5" />
            </div>
          )}
          {!collapsed ? (
            <p className="min-w-0 break-words text-sm font-black uppercase leading-snug">
              {restaurant?.name || "Restaurant"}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={collapsed ? "Ouvrir la sidebar" : "Reduire la sidebar"}
            aria-label={collapsed ? "Ouvrir la sidebar" : "Reduire la sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        {MANAGER_NAV.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon
          const badgeCount =
            item.href === "/manager/commandes"
              ? pendingPaymentCount
              : item.href === "/manager/caisse"
                ? pendingCashOpeningCount
                : 0

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
                collapsed && "justify-center px-0",
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-card-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              {!collapsed ? <span className="flex-1">{item.label}</span> : null}
              {badgeCount > 0 && !collapsed ? (
                <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 border-t p-3">
        <div className={cn("rounded-lg border bg-background p-3", collapsed && "p-2")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-xs font-black">{user?.displayName || user?.email?.split("@")[0] || "Utilisateur"}</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{role}</p>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Deconnexion"
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed ? <span>Deconnexion</span> : null}
        </button>
      </div>
    </aside>
  )
}

function ManagerMobileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const auth = useAuth()
  const { restaurant } = useRestaurant()
  const { user, role } = useTenant()
  const pendingPaymentCount = useManagerPendingPaymentCount()
  const pendingCashOpeningCount = useManagerPendingCashOpeningCount()

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex h-full w-full flex-col p-0 sm:max-w-none md:hidden">
        <SheetHeader className="border-b p-4 text-left">
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex min-w-0 items-center gap-2">
              {restaurant?.logoUrl ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent">
                  <img
                    src={getOptimizedImage(restaurant.logoUrl, 120)}
                    alt={restaurant?.name || "Restaurant"}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                  <Wallet className="h-5 w-5" />
                </div>
              )}
              <SheetTitle className="min-w-0 break-words text-sm font-black uppercase leading-snug">
                {restaurant?.name || "Restaurant"}
              </SheetTitle>
            </div>
            <ThemeToggle />
          </div>
        </SheetHeader>

        <nav className="flex-1 space-y-2 overflow-y-auto p-3">
          {MOBILE_MANAGER_DRAWER_NAV.map((item) => {
            const active = isActivePath(pathname, item.href)
            const Icon = item.icon
            const badgeCount =
              item.href === "/manager/commandes"
                ? pendingPaymentCount
                : item.href === "/manager/caisse"
                  ? pendingCashOpeningCount
                  : 0

            return (
              <SheetClose key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-lg px-4 text-base font-black transition",
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-card-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 ? (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                      {badgeCount}
                    </span>
                  ) : null}
                </Link>
              </SheetClose>
            )
          })}
        </nav>

        <div className="space-y-3 border-t p-3">
          <div className="flex items-center justify-between rounded-lg border bg-background p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">
                {user?.displayName || user?.email?.split("@")[0] || "Utilisateur"}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border text-sm font-black text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ManagerHeader({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const pathname = usePathname() ?? ""
  const { user, role } = useTenant()
  const pageTitle = React.useMemo(() => {
    const item = MANAGER_NAV.find((navItem) => isActivePath(pathname, navItem.href))
    return item?.label || "Manager"
  }, [pathname])

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-foreground md:hidden"
          aria-label="Ouvrir le menu manager"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black uppercase tracking-tight">{pageTitle}</h1>
        </div>
      </div>
      <div className="hidden text-right md:block">
        <p className="text-sm font-black">{user?.displayName || user?.email?.split("@")[0] || "Utilisateur"}</p>
        <p className="text-xs font-bold uppercase text-muted-foreground">{role}</p>
      </div>
    </header>
  )
}

function useManagerPendingPaymentCount() {
  return useRestaurantLiveData().unpaidServedCount
}

function useManagerPendingCashOpeningCount() {
  return useRestaurantLiveData().cashSessionRequests.length
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
