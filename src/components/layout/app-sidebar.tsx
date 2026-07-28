"use client"

import * as React from "react"
import {
  Building2,
  Banknote,
  BookOpen,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GitBranch,
  Globe2,
  ImageIcon,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Monitor,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldAlert,
  Star,
  Store,
  Table2,
  Tags,
  Users,
  Users2,
  Wallet,
  WalletCards,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
import { usePlatform } from "@/contexts/platform-context"
import { getOptimizedImage } from "@/lib/image"
import { ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { OrdersBadge } from "@/components/orders-badge"

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

type NavSection = {
  label: string
  items: NavItem[]
}

const AppSidebarComponent = () => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPathname = pathname ?? ""
  const auth = useAuth()
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()
  const { restaurant } = useRestaurant()
  const { settings: platformSettings, isLoading: isPlatformLoading } = usePlatform()
  const { user, profile, role, isSuperAdmin, restaurantId } = useTenant()
  const isPlatformContext = currentPathname.startsWith("/platform")

  const navSections = React.useMemo<NavSection[]>(() => {
    if (isPlatformContext && isSuperAdmin) {
      return [
        {
          label: "Administration",
          items: [
            { name: "Analytics Admin", href: "/platform", icon: LayoutDashboard },
            { name: "Restaurants", href: "/platform/restaurants", icon: Building2 },
            { name: "Bibliotheque menus", href: "/platform/menu-library", icon: BookOpen },
            { name: "Abonnements", href: "/platform/billing", icon: CreditCard },
          ],
        },
        {
          label: "Configuration",
          items: [
            { name: "Pays", href: "/platform/settings/countries", icon: Globe2 },
            { name: "Catégories marketplace", href: "/platform/settings/marketplace-categories", icon: Tags },
            { name: "Paiements", href: "/platform/settings/payment-methods", icon: WalletCards },
            { name: "Variantes paiement", href: "/platform/settings/payment-variants", icon: GitBranch },
          ],
        },
        {
          label: "Système",
          items: [
            { name: "Paramètres SaaS", href: "/platform/settings", icon: Settings },
          ],
        },
      ]
    }

    if (!restaurantId) return []

    const items: NavItem[] = []

    if (role === ROLES.OWNER) {
      items.push({ name: "Dashboard", href: "/owner", icon: LayoutDashboard })
      items.push({ name: "Commandes", href: "/owner/commandes", icon: ListOrdered })
      items.push({ name: "Caisse", href: "/owner/caisse", icon: Wallet })
      items.push({ name: "Dépenses", href: "/owner/depenses", icon: ReceiptText })
      items.push({ name: "Stock", href: "/owner/stock", icon: PackageSearch })
      items.push({ name: "Trésorerie", href: "/owner/tresorerie", icon: Banknote })
      items.push({ name: "Voix du client", href: "/owner/avis", icon: Star })
      if (isMobile) return [{ label: "Terrain", items }]
      items.push({ name: "Menu", href: "/menu", icon: Store })
      items.push({ name: "Tables", href: "/tables", icon: Table2 })
      items.push({ name: "Images", href: "/images", icon: ImageIcon })
      items.push({ name: "Configuration", href: "/settings", icon: Settings })
      return [{ label: "Restaurant", items }]
    }

    if (role === ROLES.MANAGER) {
      items.push({ name: "Dashboard", href: "/manager/dashboard", icon: Store })
      items.push({ name: "Commandes", href: "/manager/commandes", icon: ListOrdered })
      items.push({ name: "Caisse", href: "/manager/caisse", icon: Wallet })
      items.push({ name: "Menu", href: "/manager/menu", icon: Store })
      items.push({ name: "Tables", href: "/manager/tables", icon: Table2 })
      items.push({ name: "Images", href: "/manager/images", icon: ImageIcon })
      items.push({ name: "Dépenses", href: "/manager/depenses", icon: ReceiptText })
      items.push({ name: "Trésorerie", href: "/manager/tresorerie", icon: Banknote })
    }

    if (role === ROLES.CASHIER) {
      items.push({ name: "Caisse (POS)", href: "/pos", icon: Monitor })
    }

    if (role === ROLES.KITCHEN) {
      items.push({ name: "Cuisine", href: "/kitchen", icon: ChefHat })
    }

    return [{ label: `Espace ${role}`, items }]
  }, [isMobile, isPlatformContext, isSuperAdmin, restaurantId, role])

  const navItems = React.useMemo(
    () => navSections.flatMap((section) => section.items),
    [navSections]
  )
  const restaurantName = restaurant?.name?.trim() || "Restaurant"
  const restaurantInitial = restaurantName.charAt(0).toUpperCase() || "R"
  const platformName = platformSettings.name?.trim() || "Plateforme"
  const platformInitial = platformName.charAt(0).toUpperCase() || "P"
  const brandName = isPlatformContext ? platformName : restaurantName
  const brandInitial = isPlatformContext ? platformInitial : restaurantInitial
  const brandLogoUrl = isPlatformContext ? platformSettings.logoUrl : restaurant?.logoUrl
  const activeHref = React.useMemo(
    () => getActiveSidebarHref(currentPathname, navItems),
    [currentPathname, navItems]
  )
  const isCollapsed = state === "collapsed"

  const handleLogout = React.useCallback(async () => {
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarHeader className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("flex min-w-0 items-center gap-2", isCollapsed && "justify-center")}>
            {brandLogoUrl ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent">
                <img
                  src={getOptimizedImage(brandLogoUrl, 120)}
                  alt={brandName}
                  width={120}
                  height={120}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-bold">
                {brandInitial}
              </div>
            )}

            {!isCollapsed ? (
              <span className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">
                {isPlatformContext && isPlatformLoading ? "Chargement..." : brandName}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? "Ouvrir la sidebar" : "Reduire la sidebar"}
              aria-label={isCollapsed ? "Ouvrir la sidebar" : "Reduire la sidebar"}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!isCollapsed ? (
              <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-secondary-foreground">
                {section.label}
              </SidebarGroupLabel>
            ) : null}

            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = isSidebarItemActive(item, activeHref)

                  return (
                    <SidebarMenuItem key={item.href}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMobile(false)
                          router.push(getSidebarTargetHref(item.href, searchParams))
                        }}
                        title={isCollapsed ? item.name : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                          isCollapsed && "justify-center px-0",
                          isActive
                            ? "bg-primary text-white [&>svg]:text-white"
                            : "text-secondary-foreground hover:bg-secondary hover:text-white [&>svg]:text-secondary-foreground hover:[&>svg]:text-white"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon className="h-5 w-5" />
                        {!isCollapsed ? <span>{item.name}</span> : null}
                        {!isCollapsed && item.href === "/orders" && <OrdersBadge />}
                      </button>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-secondary p-3", isCollapsed && "justify-center p-2")}>
              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-primary/20">
                {isPlatformContext ? (
                  <ShieldAlert className="h-4 w-4 text-primary" />
                ) : (
                  <Users className="h-4 w-4 text-primary" />
                )}
              </div>

              {!isCollapsed ? (
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {user.email?.split("@")[0]}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase">
                    {profile?.role || role}
                  </span>
                </div>
              ) : null}

              <LogOut
                className={cn("h-4 w-4 cursor-pointer text-secondary-foreground transition-colors hover:text-white", !isCollapsed && "ml-auto")}
                onClick={handleLogout}
              />
            </div>

            {isSuperAdmin && !isPlatformContext && !isCollapsed && (
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

function getSidebarTargetHref(href: string, searchParams: URLSearchParams | null) {
  if (!href.startsWith("/owner")) return href
  const params = new URLSearchParams(searchParams?.toString() ?? "")
  return params.size > 0 ? `${href}?${params.toString()}` : href
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

function isSidebarItemActive(item: NavItem, activeHref: string | null) {
  return activeHref === item.href
}
