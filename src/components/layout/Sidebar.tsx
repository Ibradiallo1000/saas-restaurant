"use client"

import * as React from "react"
import {
  ChefHat,
  CreditCard,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Monitor,
  Store,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth, useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { useCurrentUser } from "@/hooks/use-current-user"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export function Sidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const db = useFirestore()
  const { firebaseUser: user, activeRole, isSuperAdmin, restaurantId } = useCurrentUser()
  const { setOpenMobile } = useSidebar()

  const restaurantRole = activeRole ?? ROLES.SERVER
  const hasRestaurantAccess = Boolean(restaurantId && activeRole)
  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId)
  }, [db, restaurantId])
  const { data: restaurant } = useDocOnce(restaurantRef)
  const restaurantName = restaurant?.name?.trim() || "Restaurant"
  const restaurantInitial = restaurantName.charAt(0).toUpperCase() || "R"

  const businessNav = React.useMemo<NavItem[]>(() => {
    if (!hasRestaurantAccess) return []

    if (restaurantRole === ROLES.OWNER || isSuperAdmin) {
      return [
        { name: "Analytics", href: "/owner", icon: LayoutDashboard },
        { name: "Manager", href: "/manager", icon: Store },
        { name: "Images", href: "/dashboard/images", icon: ImageIcon },
        { name: "Paiements", href: "/settings/payments", icon: CreditCard },
        { name: "Caisse", href: "/pos", icon: Monitor },
        { name: "Cuisine", href: "/kitchen", icon: ChefHat },
      ]
    }

    if (restaurantRole === ROLES.MANAGER) {
      return [
        { name: "Manager", href: "/manager", icon: Store },
        { name: "Images", href: "/dashboard/images", icon: ImageIcon },
        { name: "Paiements", href: "/settings/payments", icon: CreditCard },
        { name: "Caisse", href: "/pos", icon: Monitor },
        { name: "Cuisine", href: "/kitchen", icon: ChefHat },
      ]
    }

    if (restaurantRole === ROLES.CASHIER) {
      return [{ name: "Caisse POS", href: "/pos", icon: Monitor }]
    }

    if (restaurantRole === ROLES.KITCHEN) {
      return [{ name: "Cuisine", href: "/kitchen", icon: ChefHat }]
    }

    return []
  }, [hasRestaurantAccess, restaurantRole, isSuperAdmin])

  const navItems = businessNav
  const sectionLabel = `Espace ${restaurantRole}`

  return (
    <SidebarPrimitive
      variant="sidebar"
      collapsible="icon"
      className={cn(
        "border-r border-border",
        "[&_[data-sidebar=sidebar]]:bg-sidebar",
        "[&_[data-sidebar=sidebar]]:text-secondary-foreground",
        "[&_[data-sidebar=sidebar]]:shadow-xl"
      )}
    >
      <SidebarHeader className="p-3">
        <div className="flex min-h-10 items-center gap-3 rounded-md px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-white shadow-sm">
            {restaurant?.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold">{restaurantInitial}</span>
            )}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold text-white">{restaurantName}</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {sectionLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href)

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.name}
                      className={cn(
                        "min-h-10 rounded-md text-secondary-foreground transition-all duration-200 hover:bg-secondary hover:text-white focus-visible:ring-2 focus-visible:ring-primary",
                        active &&
                          "!bg-primary !font-medium !text-white hover:!bg-primary hover:!text-white [&>svg]:!text-white"
                      )}
                    >
                      <Link href={item.href} prefetch onClick={() => setOpenMobile(false)}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {user ? (
          <div className="flex min-h-10 items-center gap-3 rounded-md border border-border bg-secondary p-2 text-secondary-foreground group-data-[collapsible=icon]:justify-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-xs font-medium text-white">{user.email?.split("@")[0]}</div>
              <div className="truncate text-[10px] font-semibold uppercase text-muted-foreground">
                {isSuperAdmin ? ROLES.SUPER_ADMIN : restaurantRole}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-secondary-foreground hover:bg-accent hover:text-white group-data-[collapsible=icon]:hidden"
              onClick={() => signOut(auth)}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Se déconnecter</span>
            </Button>
          </div>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </SidebarPrimitive>
  )
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
