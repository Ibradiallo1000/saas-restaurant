"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { SubscriptionAccessGuard } from "@/components/subscription/SubscriptionAccessGuard"
import { SidebarProvider } from "@/components/ui/sidebar"
import { getRoleHomePath, isPublicRoute, isRouteAllowedForRole } from "@/lib/guards"
import { useCurrentUser } from "@/hooks/use-current-user"

function FullScreenLoader() {
  return (
    <div className="app-background flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const currentUser = useCurrentUser()

  const isPublic = isPublicRoute(pathname)
  const isFullscreenZone = pathname.startsWith("/pos") || pathname.startsWith("/kitchen")
  const routeRole = currentUser.isSuperAdmin ? "super_admin" : currentUser.activeRole
  const roleHomePath = getRoleHomePath(routeRole)
  const isAllowed = isRouteAllowedForRole(pathname, routeRole)

  React.useEffect(() => {
    if (currentUser.isLoading) return

    if (!currentUser.firebaseUser) {
      if (!isPublic) router.replace("/login")
      return
    }

    if (!isAllowed) {
      router.replace(roleHomePath)
    }
  }, [currentUser.firebaseUser, currentUser.isLoading, isAllowed, isPublic, roleHomePath, router])

  if (currentUser.isLoading) {
    return <FullScreenLoader />
  }

  if (!currentUser.firebaseUser && !isPublic) return null

  if (currentUser.firebaseUser && !isAllowed) return null

  if (isPublic) return <>{children}</>

  const protectedContent =
    currentUser.isSuperAdmin || !currentUser.restaurantId ? (
      children
    ) : (
      <SubscriptionAccessGuard companyId={currentUser.companyId} restaurantId={currentUser.restaurantId}>
        {children}
      </SubscriptionAccessGuard>
    )

  if (isFullscreenZone) {
    return <>{protectedContent}</>
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="app-background flex min-h-screen w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">{protectedContent}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
