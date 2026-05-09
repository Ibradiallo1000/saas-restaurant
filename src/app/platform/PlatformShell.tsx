"use client"

import dynamic from "next/dynamic"

import { SidebarProvider } from "@/components/ui/sidebar"
import { TenantProvider } from "@/design-system/context/TenantProvider"
import { RestaurantProvider } from "@/design-system/context/RestaurantContext"
import { RestaurantThemeProvider } from "@/design-system/theme/RestaurantThemeProvider"

const AppSidebar = dynamic(
  () => import("@/components/layout/app-sidebar").then((mod) => mod.AppSidebar),
  {
    ssr: false,
    loading: () => (
      <aside className="hidden min-h-screen w-64 shrink-0 border-r border-border bg-sidebar md:block" />
    ),
  }
)

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <RestaurantProvider>
        <RestaurantThemeProvider>
          <SidebarProvider defaultOpen>
            <div className="app-background flex min-h-screen w-full">
              <AppSidebar />
              <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
                {children}
              </main>
            </div>
          </SidebarProvider>
        </RestaurantThemeProvider>
      </RestaurantProvider>
    </TenantProvider>
  )
}
