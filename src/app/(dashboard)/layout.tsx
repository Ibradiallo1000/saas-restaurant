// app/(dashboard)/layout.tsx
"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {children}
      </main>
    </div>
  )
}