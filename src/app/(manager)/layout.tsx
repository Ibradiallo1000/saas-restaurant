"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { signOut } from "firebase/auth"
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MenuSquare,
  Clock,
  Package,
  ReceiptText,
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
import { TimeFilterProvider } from "@/contexts/time-filter-context"
import { getOptimizedImage } from "@/lib/image"
import { canAccessManager, getRoleHomePath, isRouteAllowedForRole } from "@/lib/guards"
import { ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import { RestaurantLiveDataProvider, useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { PreparationIssuesAlert } from "@/modules/preparation/PreparationIssuesAlert"

const MANAGER_NAV_GROUPS = [
  { label: "Vue d’ensemble", items: [{ label: "Vue d’ensemble", href: "/manager/dashboard", icon: LayoutDashboard }] },
  { label: "Opérations", items: [
    { label: "Commandes", href: "/manager/commandes", icon: ClipboardList },
    { label: "Préparation", href: "/preparation", icon: ClipboardList },
    { label: "Caisse", href: "/manager/caisse", icon: Wallet },
    { label: "Postes de caisse", href: "/manager/pos-stations", icon: Wallet },
    { label: "Postes de préparation", href: "/manager/preparation-stations", icon: ClipboardList },
    { label: "Tables", href: "/manager/tables", icon: Table2 },
    { label: "Disponibilités", href: "/manager/availability", icon: MenuSquare },
  ] },
  { label: "Finances", items: [
    { label: "Trésorerie", href: "/manager/tresorerie", icon: Banknote },
    { label: "Dépenses", href: "/manager/depenses", icon: ReceiptText },
    { label: "Fournisseurs", href: "/manager/suppliers", icon: UserRound },
  ] },
  { label: "Stock", items: [
    { label: "Stock", href: "/manager/stock", icon: Package },
    { label: "Contrôles", href: "/manager/stock/controls", icon: ClipboardList },
    { label: "Réapprovisionnement", href: "/manager/stock/replenishment", icon: Package },
    { label: "Historique", href: "/manager/stock/history", icon: Clock },
  ] },
  { label: "Équipe", items: [{ label: "Horaires", href: "/manager/hours", icon: Clock }] },
  { label: "Configuration", items: [
    { label: "Menu", href: "/manager/menu", icon: MenuSquare },
    { label: "Médias", href: "/manager/images", icon: ImageIcon },
  ] },
]

const MANAGER_NAV = MANAGER_NAV_GROUPS.flatMap((group) => group.items)

const MOBILE_MANAGER_DRAWER_NAV: typeof MANAGER_NAV = []

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <RestaurantProvider>
        <RestaurantThemeProvider>
          <TimeFilterProvider>
            <RestaurantLiveDataProvider>
              <ManagerLayoutContent>{children}</ManagerLayoutContent>
            </RestaurantLiveDataProvider>
          </TimeFilterProvider>
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
      <div className="min-h-screen max-w-full overflow-x-hidden bg-background">
        <OperationalMobileHeader />
        <main className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden px-3 pb-[calc(80px+env(safe-area-inset-bottom))] pt-[calc(56px+env(safe-area-inset-top)+8px)]">
          <PreparationIssuesAlert />
          {children}
        </main>
        <OperationalBottomNav />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <ManagerSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <PreparationIssuesAlert />
          {children}
        </main>
      </div>
    </div>
  )
}

function ManagerSidebar() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const { restaurant } = useRestaurant()
  const { user, role } = useTenant()
  const pendingPaymentCount = useManagerPendingPaymentCount()
  const pendingCashOpeningCount = useManagerPendingCashOpeningCount()
  const [collapsed, setCollapsed] = React.useState(false)
  const compactViewport = useCompactManagerRail()
  const compact = collapsed || compactViewport

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
      // Rediriger même en cas d'erreur pour éviter de laisser l'utilisateur bloqué
      router.push("/login")
    }
  }, [auth, router])

  return (
    <aside className={cn(
      "flex h-screen shrink-0 flex-col border-r bg-card text-card-foreground transition-all",
      compact ? "w-[68px]" : "w-64"
    )}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className={cn("flex min-w-0 items-center gap-2", compact && "justify-center")}>
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
          {!compact ? (
            <p className="min-w-0 break-words text-sm font-black uppercase leading-snug">
              {restaurant?.name || "Restaurant"}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {!compactViewport ? <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
            aria-label={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button> : null}
        </div>
      </div>

      <nav className={cn("flex-1 space-y-3 overflow-y-auto", compact ? "px-2 py-3" : "px-3 py-3")}>
        {MANAGER_NAV_GROUPS.map((group) => <div key={group.label} className="space-y-1">
          {!compact ? <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{group.label}</p> : null}
          {group.items.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon
          const badgeCount =
            item.href === "/manager/commandes"
              ? pendingPaymentCount
              : item.href === "/manager/caisse"
                ? pendingCashOpeningCount
                : 0

          return (
            <button
              type="button"
              key={item.href}
              title={compact ? item.label : undefined}
              onClick={() => router.push(getManagerTargetHref(item.href, searchParams))}
              className={cn(
                "relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition",
                compact && "justify-center px-0",
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-card-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              {!compact ? <span className="flex-1">{item.label}</span> : null}
              {badgeCount > 0 && !compact ? (
                <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                  {badgeCount}
                </span>
              ) : null}
              {badgeCount > 0 && compact ? <span className="absolute ml-7 -mt-7 size-2 rounded-full bg-red-500" aria-label={`${badgeCount} élément(s) en attente`} /> : null}
            </button>
          )
        })}</div>)}
      </nav>

      <div className="border-t p-3">
        <div className={cn("rounded-lg border bg-background p-3", compact && "p-2")}>
          <div className={cn("flex items-center gap-3", compact && "justify-center")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
            {!compact ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black">{user?.displayName || user?.email?.split("@")[0] || "Utilisateur"}</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{role}</p>
              </div>
            ) : null}
            {!compact ? (
              <button
                type="button"
                onClick={handleLogout}
                title="Déconnexion"
                aria-label="Déconnexion"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <LogOut className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          {compact ? (
            <button
              type="button"
              onClick={handleLogout}
              title="Déconnexion"
              aria-label="Déconnexion"
              className="mt-2 flex h-9 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

function useCompactManagerRail() {
  const [compact, setCompact] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px) and (max-width: 1279px)")
    const update = () => setCompact(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return compact
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
  const searchParams = useSearchParams()
  const auth = useAuth()
  const { restaurant } = useRestaurant()
  const { user, role } = useTenant()
  const pendingPaymentCount = useManagerPendingPaymentCount()
  const pendingCashOpeningCount = useManagerPendingCashOpeningCount()

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
      // Rediriger même en cas d'erreur pour éviter de laisser l'utilisateur bloqué
      router.push("/login")
    }
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
                <button
                  type="button"
                  onClick={() => router.push(getManagerTargetHref(item.href, searchParams))}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-lg px-4 text-left text-base font-black transition",
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
                </button>
              </SheetClose>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">
                {user?.displayName || user?.email?.split("@")[0] || "Utilisateur"}
              </p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Déconnexion"
              aria-label="Déconnexion"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function useManagerPendingPaymentCount() {
  return useRestaurantLiveData().unpaidServedCount
}

function useManagerPendingCashOpeningCount() {
  const { cashSessionRequests, pendingCashValidationCount } = useRestaurantLiveData()
  return cashSessionRequests.length + pendingCashValidationCount
}

function isActivePath(pathname: string, href: string) {
  if (href === "/manager/inventory" && isInventoryPath(pathname)) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isInventoryPath(pathname: string) {
  return (
    pathname === "/manager/inventory" ||
    pathname.startsWith("/manager/inventory/") ||
    pathname === "/manager/stock" ||
    pathname.startsWith("/manager/stock/")
  )
}

function getManagerTargetHref(href: string, searchParams: URLSearchParams | null) {
  const params = new URLSearchParams(searchParams?.toString() ?? "")
  return params.size > 0 ? `${href}?${params.toString()}` : href
}
