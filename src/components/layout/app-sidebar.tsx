"use client"

import * as React from "react"
import {
  Building2,
  ChefHat,
  CreditCard,
  GitBranch,
  Globe2,
  ImageIcon,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Monitor,
  Package,
  Settings,
  ShieldAlert,
  Store,
  Users,
  Users2,
  WalletCards,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { limit, orderBy, query, where } from "firebase/firestore"

import { ThemeToggle } from "@/components/ui/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { getOptimizedImage } from "@/lib/image"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export function AppSidebar() {
  const pathname = usePathname()
  const currentPathname = pathname ?? ""
  const auth = useAuth()
  const db = useFirestore()
  const { setOpenMobile } = useSidebar()
  const { restaurant } = useRestaurant()
  const { user, profile, role, isSuperAdmin, restaurantId } = useTenant()
  const isPlatformContext = currentPathname.startsWith("/platform")

  const newOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || isPlatformContext) return null
    return query(
      restaurantOrdersRef(db, restaurantId),
      where("status", "in", ["pending", "nouvelle"]),
      orderBy("createdAt", "desc"),
      limit(10)
    )
  }, [db, restaurantId, isPlatformContext])

  const { data: newOrders } = useCollection(newOrdersQuery)
  const newOrdersCount = newOrders?.length ?? 0

  const navItems = React.useMemo<NavItem[]>(() => {
    if (isPlatformContext && isSuperAdmin) {
      return [
        { name: "SaaS Overview", href: "/platform", icon: LayoutDashboard },
        { name: "Restaurants", href: "/platform/restaurants", icon: Building2 },
        { name: "Abonnements", href: "/platform/billing", icon: CreditCard },
        { name: "Pays", href: "/platform/settings/countries", icon: Globe2 },
        { name: "Moyens paiement", href: "/platform/settings/payment-methods", icon: WalletCards },
        { name: "Variantes paiement", href: "/platform/settings/payment-variants", icon: GitBranch },
        { name: "Parametres SaaS", href: "/platform/settings", icon: Settings },
      ]
    }

    if (!restaurantId) return []

    const nav: NavItem[] = []

    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard })
      nav.push({ name: "Gestion Menu", href: "/manager", icon: Store })
      nav.push({ name: "Images", href: "/dashboard/images", icon: ImageIcon })
      nav.push({ name: "Inventaire", href: "/inventory", icon: Package })
    }

    if ([ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER].includes(role as any)) {
      nav.push({ name: "Caisse (POS)", href: "/pos", icon: Monitor })
    }

    if ([ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN].includes(role as any)) {
      nav.push({ name: "Cuisine", href: "/kitchen", icon: ChefHat })
    }

    nav.push({ name: "Commandes", href: "/orders", icon: ListOrdered })

    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Fidelite", href: "/customers", icon: Users2 })
      nav.push({ name: "Paiements", href: "/settings/payments", icon: WalletCards })
      nav.push({ name: "Configuration", href: "/settings", icon: Settings })
    }

    return nav
  }, [isPlatformContext, isSuperAdmin, restaurantId, role])

  const restaurantName = restaurant?.name?.trim() || "Restaurant"
  const restaurantInitial = restaurantName.charAt(0).toUpperCase() || "R"
  const activeHref = React.useMemo(
    () => getActiveSidebarHref(currentPathname, navItems),
    [currentPathname, navItems]
  )

  return (
    <Sidebar className="border-r bg-white/70 backdrop-blur-md">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {restaurant?.logoUrl ? (
              <img
                src={getOptimizedImage(restaurant.logoUrl, 120)}
                alt={restaurantName}
                width={120}
                height={120}
                className="h-10 w-10 rounded-xl object-cover shadow"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-bold">
                {restaurantInitial}
              </div>
            )}

            <span className="truncate text-sm font-semibold">
              {isPlatformContext ? "GastronomeAI" : restaurantName}
            </span>
          </div>

          <ThemeToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {isPlatformContext ? "Administration SaaS" : `Espace ${role}`}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.href === activeHref

                return (
                  <SidebarMenuItem key={item.name}>
                    <Link
                      href={item.href}
                      prefetch
                      onClick={() => setOpenMobile(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                        isActive
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                      {item.href === "/orders" && newOrdersCount > 0 && (
                        <span
                          className={cn(
                            "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                            isActive ? "bg-white text-primary" : "bg-red-600 text-white"
                          )}
                        >
                          {newOrdersCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-primary/20">
                {isPlatformContext ? (
                  <ShieldAlert className="h-4 w-4 text-primary" />
                ) : (
                  <Users className="h-4 w-4 text-primary" />
                )}
              </div>

              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-xs font-semibold">
                  {user.email?.split("@")[0]}
                </span>
                <span className="text-[9px] text-muted-foreground uppercase">
                  {profile?.role || role}
                </span>
              </div>

              <LogOut
                className="ml-auto h-4 w-4 cursor-pointer"
                onClick={() => signOut(auth)}
              />
            </div>

            {isSuperAdmin && !isPlatformContext && (
              <ButtonLink href="/platform">Aller a la Platform</ButtonLink>
            )}
          </div>
        ) : (
          <Link href="/login" className="text-center text-xs font-bold text-primary">
            Connexion
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

function getActiveSidebarHref(pathname: string, items: NavItem[]) {
  const normalizedPathname = normalizePath(pathname)

  return items
    .filter((item) => isRouteMatch(normalizedPathname, item.href))
    .sort((a, b) => normalizePath(b.href).length - normalizePath(a.href).length)[0]
    ?.href ?? null
}

function isRouteMatch(pathname: string, href: string) {
  const normalizedHref = normalizePath(href)

  return (
    pathname === normalizedHref ||
    pathname.startsWith(`${normalizedHref}/`)
  )
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1)
  }

  return path || "/"
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </Link>
  )
}
