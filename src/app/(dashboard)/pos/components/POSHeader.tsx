"use client"

import * as React from "react"
import { CircleDollarSign, LockKeyhole, LogOut } from "lucide-react"

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
  canCloseSession?: boolean
  onCloseSession?: () => void
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
  canCloseSession = false,
  onCloseSession,
  onLogout,
}: POSHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-primary/20 bg-primary px-4 text-white shadow-sm md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {restaurantLogoUrl ? (
          <img
            src={restaurantLogoUrl}
            alt={restaurantName || "Restaurant"}
            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/20"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <CircleDollarSign className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-black leading-tight">{restaurantName || "Restaurant"}</p>
          <p className="text-[10px] font-black uppercase tracking-wide text-white/65">Point de vente</p>
        </div>
      </div>

      <div className="flex rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
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

      <div className="flex items-center gap-3">
        <div className="hidden rounded-xl bg-white/10 px-3 py-2 text-right ring-1 ring-white/15 sm:block">
          <p className="text-[10px] font-black uppercase tracking-wide text-white/65">Total caisse</p>
          <p className="whitespace-nowrap text-sm font-black">{formatPrice(totalAmount)} FCFA</p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "h-9 gap-1.5 rounded-xl border-white/25 px-3 text-xs font-black text-white",
            isCashSessionOpen ? "bg-emerald-400/20" : "bg-red-500/25"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", isCashSessionOpen ? "bg-emerald-300" : "bg-red-300")} />
          {isCashSessionOpen ? "Session active" : "Caisse fermée"}
        </Badge>

        {isCashSessionOpen ? (
          <button
            type="button"
            onClick={onCloseSession}
            disabled={!canCloseSession}
            className="hidden h-10 items-center gap-2 rounded-xl border border-white/30 bg-white px-3 text-xs font-black text-primary shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white disabled:opacity-55 md:inline-flex"
          >
            <LockKeyhole className="h-4 w-4" />
            Clôturer caisse
          </button>
        ) : null}

        <div className="hidden flex-col text-xs leading-tight lg:flex">
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
        "rounded-lg px-4 py-2 text-sm font-black transition",
        active
          ? "bg-white text-primary shadow-sm"
          : "text-white/75 hover:bg-white/15 hover:text-white"
      )}
    >
      {children}
    </button>
  )
}
