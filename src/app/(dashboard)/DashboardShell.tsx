"use client"

import dynamic from "next/dynamic"

import { SidebarSkeleton } from "@/components/layout/sidebar-skeleton"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TenantProvider } from "@/design-system/context/TenantProvider"
import { RestaurantProvider, useRestaurant } from "@/design-system/context/RestaurantContext"
import { RestaurantThemeProvider } from "@/design-system/theme/RestaurantThemeProvider"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { useTenant } from "@/design-system/context/TenantProvider"

const AppSidebar = dynamic(
  () => import("@/components/layout/app-sidebar").then((mod) => mod.AppSidebar),
  {
    ssr: false,
    loading: () => <SidebarSkeleton />,
  }
)

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <RestaurantProvider>
        <RestaurantThemeProvider>
          <DashboardShellContent>{children}</DashboardShellContent>
        </RestaurantThemeProvider>
      </RestaurantProvider>
    </TenantProvider>
  )
}

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const tenant = useTenant()
  const restaurant = useRestaurant()
  const isLoading = tenant.loading || restaurant.loading

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full">
        {isLoading ? <SidebarSkeleton /> : <AppSidebar />}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {isLoading ? <AdminRouteSkeleton /> : children}
        </main>
      </div>
    </SidebarProvider>
  )
}
