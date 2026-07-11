"use client"

import * as React from "react"
import { CircleDollarSign, LockKeyhole, LogOut, ReceiptText, UserRound } from "lucide-react"

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
    <header className="grid h-[60px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b bg-card/95 px-4 text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {restaurantLogoUrl ? (
          <img
            src={restaurantLogoUrl}
            alt={restaurantName || "Restaurant"}
            className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-white shadow-sm">
            <CircleDollarSign className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-black leading-tight">{restaurantName || "Restaurant"}</p>
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Point de vente</p>
        </div>
      </div>

      <div className="flex rounded-full border bg-muted/50 p-1 shadow-inner">
        <TabButton active={activeTab === "cashier"} onClick={() => onTabChange("cashier")}>
          Caisse
        </TabButton>

        <TabButton active={activeTab === "orders"} onClick={() => onTabChange("orders")}>
          Commandes
          {unpaidServedCount > 0 && (
            <span className="ml-1 rounded-full bg-[var(--brand-primary)] px-1.5 text-xs text-white">
              {unpaidServedCount}
            </span>
          )}
        </TabButton>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="hidden rounded-2xl border bg-background px-3 py-2 text-right shadow-sm sm:block">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Total caisse</p>
          <p className="whitespace-nowrap text-sm font-black text-[var(--brand-primary)]">{formatPrice(totalAmount)} FCFA</p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "h-9 gap-1.5 rounded-full px-3 text-xs font-black",
            isCashSessionOpen
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", isCashSessionOpen ? "bg-emerald-500" : "bg-red-500")} />
          {isCashSessionOpen ? "Session active" : "Caisse fermée"}
        </Badge>

        {isCashSessionOpen ? (
          <button
            type="button"
            onClick={onCloseSession}
            disabled={!canCloseSession}
            className="hidden h-10 items-center gap-2 rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] px-3 text-xs font-black text-[var(--brand-primary)] shadow-sm transition hover:border-[var(--brand-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
          >
            <LockKeyhole className="h-4 w-4" />
            Clôturer caisse
          </button>
        ) : null}

        <div className="hidden items-center gap-2 rounded-full border bg-background px-2.5 py-1.5 shadow-sm lg:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block max-w-28 truncate text-xs font-black">{userName || "Utilisateur"}</span>
            <span className="block text-[10px] font-bold text-muted-foreground">{roleLabel}</span>
          </span>
        </div>

        <div>
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
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
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition",
        active
          ? "bg-[var(--brand-primary)] text-white shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      )}
    >
      {active ? <ReceiptText className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}
