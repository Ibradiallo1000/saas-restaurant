"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { RestaurantProvider } from "@/design-system/context/RestaurantContext"
import { TenantProvider } from "@/design-system/context/TenantProvider"
import { RestaurantThemeProvider } from "@/design-system/theme/RestaurantThemeProvider"

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen>
      <TenantProvider>
        <RestaurantProvider>
          <RestaurantThemeProvider>
            <div className="app-background flex min-h-screen w-full">
              <AppSidebar />
              <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
                {children}
              </main>
            </div>
          </RestaurantThemeProvider>
        </RestaurantProvider>
      </TenantProvider>
    </SidebarProvider>
  )
}
