"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { usePlatform } from "@/contexts/platform-context"
import { useUser } from "@/firebase"

export function Header() {
  const { settings } = usePlatform()
  const { user } = useUser()

  const restaurantName = settings?.name || "Restaurant"
  const logo = settings?.logoUrl

  return (
    <header className="app-header sticky top-0 z-20 h-12 flex items-center justify-between px-3">
      
      {/* LEFT */}
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="h-9 w-9 rounded-md" />

        {logo ? (
          <img src={logo} alt="logo" className="h-6 w-6 rounded-md object-cover" />
        ) : (
          <div className="h-6 w-6 rounded-md bg-primary/20" />
        )}

        <span className="truncate text-sm font-semibold">
          {restaurantName}
        </span>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Avatar className="h-8 w-8 border">
          <AvatarImage src={user?.photoURL ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(user?.email)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

function getInitials(email?: string | null) {
  if (!email) return "U"
  return email.slice(0, 2).toUpperCase()
}
