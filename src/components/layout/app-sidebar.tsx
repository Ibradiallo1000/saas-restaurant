
"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Building2,
  Users,
  Sparkles,
  LogOut,
  ShieldCheck,
  CreditCard,
  Settings,
  Package,
  ShoppingCart,
  Users2
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"

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
  const pathname = usePathname()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser()

  // Fetch current user profile to see restaurant context
  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    const r = doc(db, "users", user.uid)
    return Object.assign(r, { __memo: true })
  }, [db, user])
  
  const { data: profile } = useDoc(userProfileRef)

  const navigation = [
    { name: "Accueil", href: "/", icon: LayoutDashboard },
    { name: "SaaS Setup", href: "/setup", icon: ShieldCheck },
  ]

  const businessNav = profile?.restaurantId ? [
    { name: "Mon Établissement", href: "/restaurant", icon: Building2 },
    { name: "Commandes", href: "/orders", icon: ShoppingCart },
    { name: "Inventaire", icon: Package, href: "/inventory" },
    { name: "Clients", icon: Users2, href: "/customers" },
  ] : []

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
            Système Core
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
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

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3 shadow-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">{user.email?.split('@')[0]}</span>
              <span className="truncate text-[10px] text-muted-foreground font-bold uppercase">
                {profile?.role || "Utilisateur"}
              </span>
            </div>
            <LogOut 
              className="ml-auto h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:hidden" 
              onClick={() => signOut(auth)}
            />
          </div>
        ) : (
          <div className="p-2 text-center">
            <Link href="/login" className="text-xs text-primary font-bold hover:underline">
              Se connecter
            </Link>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
