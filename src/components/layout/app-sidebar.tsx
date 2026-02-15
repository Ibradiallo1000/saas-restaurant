
"use client"

/**
 * @fileOverview Barre latérale dynamique.
 * Adapte son contenu selon le contexte (Plateforme ou Restaurant) et le rôle.
 */

import * as React from "react"
import {
  LayoutDashboard,
  ShieldCheck,
  Package,
  ShoppingCart,
  Users2,
  ListOrdered,
  ChefHat,
  Monitor,
  Settings,
  LogOut,
  Sparkles,
  Users,
  ShieldAlert,
  Building2,
  Activity,
  CreditCard
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

  // 1. Détection du contexte Plateforme
  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile } = useDoc(platformUserRef)

  // 2. Détection du contexte Restaurant
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  // 3. Récupération Branding Plateforme
  const platformConfigRef = useMemoFirebase(() => {
    if (!db) return null
    return doc(db, COLLECTION_NAMES.PLATFORM, 'main')
  }, [db])
  const { data: platformConfig } = useDoc(platformConfigRef)

  const isSuperAdmin = !!platformProfile && [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(platformProfile.role)
  const isPlatformContext = pathname.startsWith('/platform')
  const role = profile?.role || (isSuperAdmin ? ROLES.SUPER_ADMIN : ROLES.SERVER)

  const platformNav = [
    { name: "SaaS Overview", href: "/platform", icon: LayoutDashboard },
    { name: "Restaurants", href: "/platform/restaurants", icon: Building2 },
    { name: "Abonnements", href: "/platform/billing", icon: CreditCard },
    { name: "Paramètres SaaS", href: "/platform/settings", icon: Settings },
  ]

  const businessNav = profile?.restaurantId ? [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, show: true },
    { name: "POS / Caisse", href: "/pos", icon: Monitor, show: [ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER].includes(role) },
    { name: "Cuisine", href: "/kitchen", icon: ChefHat, show: [ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN].includes(role) },
    { name: "Commandes", href: "/orders", icon: ListOrdered, show: true },
    { name: "Inventaire", href: "/inventory", icon: Package, show: [ROLES.OWNER, ROLES.MANAGER].includes(role) },
    { name: "Fidélité", href: "/customers", icon: Users2, show: [ROLES.OWNER, ROLES.MANAGER].includes(role) },
  ].filter(item => item.show) : []

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-headline text-xl font-bold tracking-tight text-primary group-data-[collapsible=icon]:hidden italic">
            {platformConfig?.name || "GastronomeAI"}
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
              Établissement
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
            {isSuperAdmin && !isPlatformContext && (
              <Link href="/platform" className="text-[10px] font-bold text-primary text-center uppercase hover:underline mb-2">
                Retour Mode Admin
              </Link>
            )}
            <div className="flex items-center gap-3 rounded-xl bg-secondary p-3 shadow-sm group-data-[collapsible=icon]:p-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                {isPlatformContext ? <ShieldAlert className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-semibold">{user.email?.split('@')[0]}</span>
                <span className="truncate text-[9px] text-muted-foreground font-bold uppercase">
                  {isPlatformContext ? platformProfile?.role : role}
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
