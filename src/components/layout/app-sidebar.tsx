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
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"

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
import { useAuth } from "@/firebase"
import { getOptimizedImage } from "@/lib/image"
import { ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { OrdersBadge } from "@/components/orders-badge"

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const AppSidebarComponent = () => {
  const pathname = usePathname()
  const router = useRouter()
  const currentPathname = pathname ?? ""
  const auth = useAuth()
  const { setOpenMobile } = useSidebar()
  const { restaurant } = useRestaurant()
  const { user, profile, role, isSuperAdmin, restaurantId } = useTenant()
  const isPlatformContext = currentPathname.startsWith("/platform")
  const [optimisticHref, setOptimisticHref] = React.useState<string | null>(null)

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
  const visibleActiveHref = optimisticHref ?? activeHref

  React.useEffect(() => {
    setOptimisticHref(null)
  }, [currentPathname])

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-border">
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

            <span className="truncate text-sm font-semibold text-foreground">
              {isPlatformContext ? "GastronomeAI" : restaurantName}
            </span>
          </div>

          <ThemeToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-secondary-foreground">
            {isPlatformContext ? "Administration SaaS" : `Espace ${role}`}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.href === visibleActiveHref

                return (
                  <SidebarMenuItem key={item.name}>
                    <Link
                      href={item.href}
                      prefetch
                      onClick={() => {
                        setOptimisticHref(item.href)
                        setOpenMobile(false)
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-white [&>svg]:text-white"
                          : "text-secondary-foreground hover:bg-secondary hover:text-white [&>svg]:text-secondary-foreground hover:[&>svg]:text-white"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                      {item.href === "/orders" && <OrdersBadge />}
                    </Link>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-3">
              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-primary/20">
                {isPlatformContext ? (
                  <ShieldAlert className="h-4 w-4 text-primary" />
                ) : (
                  <Users className="h-4 w-4 text-primary" />
                )}
              </div>

              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-xs font-semibold text-foreground">
                  {user.email?.split("@")[0]}
                </span>
                <span className="text-[9px] text-muted-foreground uppercase">
                  {profile?.role || role}
                </span>
              </div>

              <LogOut
                className="ml-auto h-4 w-4 cursor-pointer text-secondary-foreground transition-colors hover:text-white"
                onClick={handleLogout}
              />
            </div>

            {isSuperAdmin && !isPlatformContext && (
              <ButtonLink href="/platform">Aller a la Platform</ButtonLink>
            )}
          </div>
        ) : (
          <Link href="/login" prefetch className="text-center text-xs font-bold text-primary">
            Connexion
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

export const AppSidebar = React.memo(AppSidebarComponent)

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
      prefetch
      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </Link>
  )
}
