"use client"

import * as React from "react"
import {
  CheckCircle2,
  CircleDollarSign,
  CircleOff,
  LockKeyhole,
  LogOut,
  ReceiptText,
  User,
  ClipboardList,
  ChevronDown,
} from "lucide-react"

import { ThemeToggle } from "@/components/ui/theme-toggle"
import { PosHeader as PosHeaderPrimitive } from "@/components/pos-ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const sessionStatus = isCashSessionOpen ? "active" as const : "closed" as const

  // Identité du restaurant (gauche)
  const renderIdentity = (mobile = false) => (
    <span className={cn("flex min-w-0 items-center", mobile ? "gap-2" : "gap-2.5")}>
      {restaurantLogoUrl ? (
        <img
          src={restaurantLogoUrl}
          alt={restaurantName || "Restaurant"}
          className={cn(
            "shrink-0 object-cover ring-1 ring-border",
            mobile ? "size-9 rounded-xl min-[360px]:size-10" : "size-9 rounded-2xl"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center bg-[var(--brand-primary)] text-white shadow-sm",
            mobile ? "size-9 rounded-xl min-[360px]:size-10" : "size-9 rounded-2xl"
          )}
        >
          <CircleDollarSign className="h-5 w-5" />
        </span>
      )}

      <span className="min-w-0">
        <span className="block truncate text-sm font-black leading-tight">
          {restaurantName || "Restaurant"}
        </span>
        <span
          className={cn(
            "text-[10px] font-black uppercase tracking-wide text-muted-foreground",
            mobile ? "hidden min-[390px]:block" : "block"
          )}
        >
          Point de vente
        </span>
      </span>
    </span>
  )

  // Onglets Caisse / Commandes
  const tabs = (
    <div className="flex shrink-0 rounded-full border bg-muted/50 p-1 shadow-inner">
      <TabButton active={activeTab === "cashier"} onClick={() => onTabChange("cashier")}>
        <ReceiptText className="h-4 w-4" aria-hidden="true" />
        Caisse
      </TabButton>

      <TabButton active={activeTab === "orders"} onClick={() => onTabChange("orders")}>
        <ClipboardList className="h-4 w-4" aria-hidden="true" />
        Commandes
        {unpaidServedCount > 0 && (
          <span className="ml-1 rounded-full bg-[var(--brand-primary)] px-1.5 text-xs text-white">
            {unpaidServedCount}
          </span>
        )}
      </TabButton>
    </div>
  )

  // Bouton Clôturer (juste après les onglets)
  const closeAction = isCashSessionOpen ? (
    <button
      type="button"
      onClick={onCloseSession}
      disabled={!canCloseSession}
      className="dashboard-focus-visible hidden min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-white px-3.5 text-sm font-semibold text-[var(--brand-primary)] shadow-sm hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50 lg:inline-flex"
    >
      <LockKeyhole className="size-4" aria-hidden="true" />
      Clôturer
    </button>
  ) : null

  // Total caisse (carte indépendante)
  const totalCard = (
    <div className="hidden shrink-0 rounded-xl border bg-background px-3 py-1.5 shadow-sm lg:block">
      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        Total caisse
      </p>
      <p className="whitespace-nowrap text-sm font-black tabular-nums text-[var(--brand-primary)]">
        {formatPrice(totalAmount)} FCFA
      </p>
    </div>
  )

  // Menu utilisateur (complètement à droite)
  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden shrink-0 items-center gap-2 rounded-xl border bg-background px-3 py-1.5 shadow-sm transition-colors hover:bg-muted/50 lg:inline-flex">
          <User className="size-4 text-muted-foreground" aria-hidden="true" />
          <div className="text-left">
            <p className="text-xs font-black leading-tight">{userName || "Utilisateur"}</p>
            <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
          </div>
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-black">{userName || "Utilisateur"}</span>
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 focus:text-red-700"
        >
          <LogOut className="mr-2 size-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Version mobile
  const mobileSessionLabel = isCashSessionOpen
    ? "Session de caisse active"
    : "Session de caisse fermée"

  const mobileHeader = (
    <header className="relative z-10 shrink-0 border-b border-[var(--pos-divider)] bg-[var(--pos-panel)] px-[calc(var(--pos-gutter-x)+var(--safe-left,0px))] pb-2 pt-[calc(.5rem+var(--safe-top,0px))] pr-[calc(var(--pos-gutter-x)+var(--safe-right,0px))] shadow-[var(--shadow-dashboard-surface)] md:hidden">
      <div className="flex min-h-14 min-w-0 items-center justify-between gap-1.5">
        {renderIdentity(true)}
        <div className="flex shrink-0 items-center gap-0.5">
          <span
            role="status"
            aria-label={mobileSessionLabel}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-black",
              isCashSessionOpen
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            )}
          >
            {isCashSessionOpen ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <CircleOff className="size-4" aria-hidden="true" />
            )}
          </span>
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Navigation du point de vente" className="mt-1">
        {tabs}
      </nav>
    </header>
  )

  // ✅ Actions sans doublon du badge Active
  // Le badge Active est géré par PosHeaderPrimitive via sessionStatus/sessionLabel
  const actions = (
    <div className="flex w-full items-center justify-between gap-4">
      {/* Groupe 1 : Thème uniquement (le badge Active est déjà dans PosHeaderPrimitive) */}
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
      </div>

      {/* Groupe 2 : Onglets + Clôturer */}
      <div className="flex shrink-0 items-center gap-2">
        {tabs}
        {closeAction}
      </div>

      {/* Groupe 3 : Total + Profil (à droite) */}
      <div className="flex shrink-0 items-center gap-2">
        {totalCard}
        {userMenu}
      </div>
    </div>
  )

  return (
    <>
      {mobileHeader}
      <PosHeaderPrimitive
        className="hidden md:block"
        title={renderIdentity()}
        sessionStatus={sessionStatus}
        sessionLabel={isCashSessionOpen ? "Active" : "Fermée"}
        actions={actions}
        closeSessionAction={null}
      />
    </>
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
      aria-pressed={active}
      className={cn(
        "dashboard-focus-visible inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition",
        active
          ? "bg-[var(--brand-primary)] text-white shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}