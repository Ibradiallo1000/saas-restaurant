"use client"

import * as React from "react"
import { CircleDollarSign, LogOut } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { cn } from "@/lib/utils"

export type POSTab = "cashier" | "orders"

type POSHeaderProps = {
  restaurantName?: string | null
  restaurantLogoUrl?: string | null
  activeTab: POSTab
  unpaidServedCount: number
  isCashSessionOpen: boolean
  userName?: string | null
  roleLabel?: string
  totalAmount?: number
  onTabChange: (tab: POSTab) => void
  onLogout?: () => void
}

function formatPrice(value: number) {
  return value.toLocaleString("fr-FR")
}

export default function POSHeader({
  restaurantName,
  restaurantLogoUrl,
  activeTab,
  unpaidServedCount,
  isCashSessionOpen,
  userName,
  roleLabel = "Caissier",
  totalAmount = 0,
  onTabChange,
  onLogout,
}: POSHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between bg-primary px-6 text-white">
      <div className="flex items-center gap-3">
        {restaurantLogoUrl ? (
          <img
            src={restaurantLogoUrl}
            alt={restaurantName || "Restaurant"}
            className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/20"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <CircleDollarSign className="h-5 w-5" />
          </div>
        )}

        <span className="font-semibold">{restaurantName || "Restaurant"}</span>
      </div>

      <div className="flex gap-2">
        <TabButton active={activeTab === "cashier"} onClick={() => onTabChange("cashier")}>
          Caisse
        </TabButton>

        <TabButton active={activeTab === "orders"} onClick={() => onTabChange("orders")}>
          Commandes
          {unpaidServedCount > 0 && (
            <span className="ml-1 rounded-full bg-white px-1.5 text-xs text-primary">
              {unpaidServedCount}
            </span>
          )}
        </TabButton>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm">
          <span className="opacity-70">Total caisse :</span>
          <span className="ml-1 font-semibold">{formatPrice(totalAmount)} FCFA</span>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "border-white/30 bg-white/15 px-2 py-1 text-xs font-bold text-white",
            isCashSessionOpen ? "bg-white/20" : "bg-red-500/25"
          )}
        >
          {isCashSessionOpen ? "Active" : "Ferm\u00e9e"}
        </Badge>

        <div className="flex flex-col text-xs leading-tight">
          <span className="font-medium">{userName || "Utilisateur"}</span>
          <span className="opacity-70">{roleLabel}</span>
        </div>

        <div className="[&_button]:text-white [&_button:hover]:bg-white/15 [&_button:hover]:text-white">
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="rounded-md p-2 text-white hover:bg-white/15"
          aria-label="D\u00e9connexion"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-4 py-2 text-sm font-bold transition",
        active
          ? "bg-white text-primary shadow-sm"
          : "text-white/75 hover:bg-white/15 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}
