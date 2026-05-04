"use client"

import * as React from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { RestaurantProvider } from "@/design-system/context/RestaurantContext"
import { TenantProvider } from "@/design-system/context/TenantProvider"
import { RestaurantThemeProvider } from "@/design-system/theme/RestaurantThemeProvider"

export default function DashboardLayout({
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

              <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
                <React.Suspense fallback={<div>Chargement...</div>}>
                  {children}
                </React.Suspense>
              </main>
            </div>
          </RestaurantThemeProvider>
        </RestaurantProvider>
      </TenantProvider>
    </SidebarProvider>
  )
}
