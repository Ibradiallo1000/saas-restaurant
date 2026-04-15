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
  Store,
  ChevronRight,
  Check
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc, updateDoc, collection, query, where, orderBy } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { cn } from "@/lib/utils"

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
  SidebarGroupContent,
  useSidebar
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser()
  const { setOpenMobile } = useSidebar()

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile } = useDoc(platformUserRef)

  const ownedRestaurantsQuery = useMemoFirebase(() => {
    if (!db || !user || profile?.role !== ROLES.OWNER) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS),
      where("ownerId", "==", user.uid),
      orderBy("name", "asc")
    )
  }, [db, user, profile?.role])
  const { data: ownedRestaurants } = useCollection(ownedRestaurantsQuery)

  const isSuperAdmin = !!platformProfile && [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(platformProfile.role as any)
  const isPlatformContext = pathname.startsWith('/platform')
  const role = profile?.role || ROLES.SERVER

  const switchRestaurant = async (restaurantId: string) => {
    if (!db || !user || !userProfileRef) return
    await updateDoc(userProfileRef, { restaurantId })
  }

  const platformNav = [
    { name: "SaaS Overview", href: "/platform", icon: LayoutDashboard },
    { name: "Restaurants", href: "/platform/restaurants", icon: Building2 },
    { name: "Abonnements", href: "/platform/billing", icon: CreditCard },
    { name: "Paramètres SaaS", href: "/platform/settings", icon: Settings },
  ]

  const getBusinessNav = () => {
    if (!profile?.restaurantId) return []
    const nav = []

    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Analytiques", href: "/dashboard", icon: LayoutDashboard })
    }

    if ([ROLES.OWNER, ROLES.MANAGER].includes(role as any)) {
      nav.push({ name: "Gestion Menu", href: "/manager", icon: Store })
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
      nav.push({ name: "Fidélité", href: "/customers", icon: Users2 })
      nav.push({ name: "Configuration", href: "/settings", icon: Settings })
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
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
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
          <>
            {profile?.role === ROLES.OWNER && ownedRestaurants && ownedRestaurants.length > 1 && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                  Mes Établissements
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {ownedRestaurants.map((res) => (
                      <SidebarMenuItem key={res.id}>
                        <SidebarMenuButton 
                          isActive={profile.restaurantId === res.id}
                          onClick={() => switchRestaurant(res.id)}
                          className={cn(
                            "group-data-[collapsible=icon]:justify-center",
                            profile.restaurantId === res.id ? "bg-primary/10 text-primary font-bold" : ""
                          )}
                        >
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{res.name}</span>
                          {profile.restaurantId === res.id && <Check className="ml-auto h-3 w-3" />}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
                <Separator className="my-2 mx-4 opacity-50" />
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                Espace {role.toUpperCase()}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {businessNav.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.name}>
                        <Link href={item.href} onClick={() => setOpenMobile(false)}>
                          <item.icon className="h-5 w-5" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
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
            {isSuperAdmin && !isPlatformContext && (
              <Button asChild variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase italic group-data-[collapsible=icon]:hidden">
                <Link href="/platform">Aller à la Platform</Link>
              </Button>
            )}
          </div>
        ) : (
          <Link href="/login" className="text-center block text-xs font-bold text-primary italic uppercase">Connexion</Link>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
