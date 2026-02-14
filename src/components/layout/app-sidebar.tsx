"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Building2,
  Users,
  Sparkles,
  LogOut,
  ShieldCheck,
  Settings,
  Package,
  ShoppingCart,
  Users2,
  ListOrdered,
  ChefHat,
  Monitor,
  Star
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { useTranslation } from "@/lib/i18n"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser()

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  
  const { data: profile } = useDoc(userProfileRef)

  const role = profile?.role || ROLES.SERVER

  // Visibilité basée sur les rôles
  const canViewAdmin = [ROLES.OWNER, ROLES.MANAGER, ROLES.SUPER_ADMIN].includes(role)
  const canViewPOS = [ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER].includes(role)
  const canViewKitchen = [ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN].includes(role)
  const canViewInventory = [ROLES.OWNER, ROLES.MANAGER].includes(role)
  const canViewStaff = [ROLES.OWNER, ROLES.MANAGER].includes(role)

  const navigation = [
    { name: t.common.dashboard, href: "/dashboard", icon: LayoutDashboard, show: canViewAdmin },
    { name: t.common.setup, href: "/setup", icon: ShieldCheck, show: role === ROLES.OWNER },
  ]

  const businessNav = profile?.restaurantId ? [
    { name: "POS / Caisse", href: "/pos", icon: Monitor, show: canViewPOS },
    { name: "Cuisine", href: "/kitchen", icon: ChefHat, show: canViewKitchen },
    { name: "Commandes", href: "/orders", icon: ListOrdered, show: true },
    { name: "Menus & Plats", href: "/menus", icon: ShoppingCart, show: canViewAdmin },
    { name: "Inventaire", href: "/inventory", icon: Package, show: canViewInventory },
    { name: "Fidélité", href: "/customers", icon: Users2, show: canViewAdmin },
    { name: "Paramètres", href: "/settings", icon: Settings, show: canViewAdmin },
  ].filter(item => item.show) : []

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-headline text-xl font-bold tracking-tight text-primary group-data-[collapsible=icon]:hidden italic">
            GastronomeAI
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
            Système
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.filter(i => i.show).map((item) => {
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      className={cn(
                        "transition-all duration-200",
                        isActive ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent/50"
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {businessNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
              Opérations
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {businessNav.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                        className={cn(
                          "transition-all duration-200",
                          isActive ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent/50"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                          <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-xl bg-secondary p-3 shadow-sm group-data-[collapsible=icon]:p-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">{profile?.name || user.email?.split('@')[0]}</span>
                <span className="truncate text-[10px] text-muted-foreground font-bold uppercase">
                  {t.roles[role as keyof typeof t.roles] || "Utilisateur"}
                </span>
              </div>
              <LogOut 
                className="ml-auto h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:hidden" 
                onClick={() => signOut(auth)}
              />
            </div>
          </div>
        ) : (
          <Link href="/login" className="text-center block text-xs font-bold text-primary">{t.common.login}</Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
