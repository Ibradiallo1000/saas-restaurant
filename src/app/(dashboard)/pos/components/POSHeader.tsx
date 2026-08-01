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
  MoreVertical,
} from "lucide-react"

import { ThemeToggle } from "@/components/ui/theme-toggle"
import { PosHeader as PosHeaderPrimitive } from "@/components/pos-ui"
import { OperationalStationIdentity } from "@/components/operational-ui"
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
  readyOrderCount: number
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
  readyOrderCount,
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

  const renderIdentity = (compact = false) => (
    <OperationalStationIdentity
      compact={compact}
      fallbackIcon={CircleDollarSign}
      restaurantLogoUrl={restaurantLogoUrl}
      restaurantName={restaurantName}
      subtitle="Point de vente"
    />
  )

  // Onglets Caisse / Commandes
  const tabs = (
    <div className="flex w-full min-w-0 rounded-xl border bg-muted/50 p-1 shadow-inner">
      <TabButton active={activeTab === "cashier"} onClick={() => onTabChange("cashier")}>
        <ReceiptText className="h-4 w-4" aria-hidden="true" />
        Caisse
      </TabButton>

      <TabButton active={activeTab === "orders"} onClick={() => onTabChange("orders")}>
        <ClipboardList className="h-4 w-4" aria-hidden="true" />
        Commandes
        {readyOrderCount > 0 && (
          <span
            role="status"
            aria-label={`${readyOrderCount} commande${readyOrderCount > 1 ? "s" : ""} prête${readyOrderCount > 1 ? "s" : ""} à traiter`}
            className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white shadow-sm"
          >
            {readyOrderCount}
          </span>
        )}
      </TabButton>
    </div>
  )

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
        <button type="button" aria-label="Ouvrir les actions du compte et de la caisse" className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-xl border bg-background shadow-sm transition-colors hover:bg-muted/50 lg:size-auto lg:min-h-11 lg:px-3 lg:py-1.5">
          <MoreVertical className="size-5 text-muted-foreground lg:hidden" aria-hidden="true" />
          <User className="hidden size-4 text-muted-foreground lg:block" aria-hidden="true" />
          <div className="hidden text-left lg:block">
            <p className="text-xs font-black leading-tight">{userName || "Utilisateur"}</p>
            <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
          </div>
          <ChevronDown className="hidden size-3 text-muted-foreground lg:block" />
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
        <DropdownMenuLabel className="space-y-1 font-normal">
          <span className="flex justify-between gap-3 text-xs"><span>Statut</span><strong>{isCashSessionOpen ? "Caisse ouverte" : "Caisse fermée"}</strong></span>
          <span className="flex justify-between gap-3 text-xs"><span>Total encaissé</span><strong className="tabular-nums">{formatPrice(totalAmount)} FCFA</strong></span>
        </DropdownMenuLabel>
        {isCashSessionOpen ? <DropdownMenuItem disabled={!canCloseSession} onSelect={onCloseSession}><LockKeyhole className="mr-2 size-4" />Clôturer la caisse</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="justify-between">Thème <ThemeToggle /></DropdownMenuItem>
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
          <div className="hidden min-[390px]:block pr-1 text-right">
            <p className="text-[10px] font-semibold text-muted-foreground">Total encaissé</p>
            <p className="text-xs font-black tabular-nums">{formatPrice(totalAmount)} FCFA</p>
          </div>
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
          {userMenu}
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
    <div className="flex w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {tabs}
      </div>
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
        "dashboard-focus-visible inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition",
        active
          ? "bg-[var(--brand-primary)] text-white shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
