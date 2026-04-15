"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Monitor,
  ChefHat,
  Package,
  Users2,
  ListOrdered,
  Settings,
  LogOut,
  Sparkles,
  Users,
  ShieldAlert,
  Building2,
  CreditCard,
  ClipboardCheck,
  Store
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"

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

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser()

  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile } = useDoc(platformUserRef)

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const isSuperAdmin = !!platformProfile && [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(platformProfile.role)
  const isPlatformContext = pathname.startsWith('/platform')
  const role = profile?.role || ROLES.SERVER

  const platformNav = [
    { name: "SaaS Overview", href: "/platform", icon: LayoutDashboard },
    { name: "Restaurants", href: "/platform/restaurants", icon: Building2 },
    { name: "Abonnements", href: "/platform/billing", icon: CreditCard },
    { name: "Paramètres SaaS", href: "/platform/settings", icon: Settings },
  ]

  const getBusinessNav = () => {
    if (!profile?.restaurantId) return []
    
    const nav = []

    // Dashboard Owner/Manager
    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Analytiques", href: "/dashboard", icon: LayoutDashboard })
    }

    // Manager specific
    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Gestion Menu", href: "/manager", icon: Store })
      nav.push({ name: "Inventaire", href: "/inventory", icon: Package })
    }

    // POS / Cashier
    if ([ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER].includes(role as any)) {
      nav.push({ name: "Caisse (POS)", href: "/pos", icon: Monitor })
    }

    // Kitchen
    if ([ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN].includes(role as any)) {
      nav.push({ name: "Cuisine", href: "/kitchen", icon: ChefHat })
    }

    // Orders (All staff)
    nav.push({ name: "Commandes", href: "/orders", icon: ListOrdered })

    // Customers (Owner/Manager)
    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Fidélité", href: "/customers", icon: Users2 })
    }

    return nav
  }

  const businessNav = getBusinessNav()

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
        {isPlatformContext && isSuperAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
              Administration SaaS
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformNav.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
              Menu {role.toUpperCase()}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {businessNav.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-xl bg-secondary p-3 shadow-sm group-data-[collapsible=icon]:p-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                {isPlatformContext ? <ShieldAlert className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-semibold">{user.email?.split('@')[0]}</span>
                <span className="truncate text-[9px] text-muted-foreground font-bold uppercase">
                  {role}
                </span>
              </div>
              <LogOut 
                className="ml-auto h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive shrink-0 group-data-[collapsible=icon]:hidden" 
                onClick={() => signOut(auth)}
              />
            </div>
          </div>
        ) : (
          <Link href="/login" className="text-center block text-xs font-bold text-primary italic uppercase">Connexion</Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
