"use client"

import * as React from "react"
import { CheckCircle2, CircleDollarSign, CircleOff, LockKeyhole, LogOut, ReceiptText } from "lucide-react"

import { ThemeToggle } from "@/components/ui/theme-toggle"
import { PosHeader as PosHeaderPrimitive } from "@/components/pos-ui"
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
  const renderIdentity = (mobile = false) => <span className={cn("flex min-w-0 items-center", mobile ? "gap-2" : "gap-3")}>
        {restaurantLogoUrl ? (
          <img
            src={restaurantLogoUrl}
            alt={restaurantName || "Restaurant"}
            className={cn("shrink-0 object-cover ring-1 ring-border", mobile ? "size-9 rounded-xl min-[360px]:size-10" : "size-10 rounded-2xl")}
          />
        ) : (
          <span className={cn("flex shrink-0 items-center justify-center bg-[var(--brand-primary)] text-white shadow-sm", mobile ? "size-9 rounded-xl min-[360px]:size-10" : "size-10 rounded-2xl")}>
            <CircleDollarSign className="h-5 w-5" />
          </span>
        )}

        <span className="min-w-0">
          <span className="block truncate text-sm font-black leading-tight">{restaurantName || "Restaurant"}</span>
          <span className={cn("text-[10px] font-black uppercase tracking-wide text-muted-foreground", mobile ? "hidden min-[390px]:block" : "block")}>Point de vente</span>
        </span>
      </span>
  const tabs = <div className="flex rounded-full border bg-muted/50 p-1 shadow-inner">
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
  const actions = <><div className="hidden rounded-2xl border bg-background px-3 py-2 text-right shadow-sm sm:block">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Total caisse</p>
          <p className="whitespace-nowrap text-sm font-black tabular-nums text-[var(--brand-primary)]">{formatPrice(totalAmount)} FCFA</p>
        </div>
        <div className="hidden rounded-2xl border bg-background px-3 py-2 text-right shadow-sm sm:block">
          <p className="text-xs font-black">{userName || "Utilisateur"}</p>
          <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
        </div>
        <ThemeToggle />
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="D\u00e9connexion"
        >
          <LogOut size={16} />
        </button></>
  const closeAction = isCashSessionOpen ? <button type="button" onClick={onCloseSession} disabled={!canCloseSession} className="dashboard-focus-visible hidden min-h-11 items-center gap-2 rounded-[var(--radius-dashboard-button)] border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] px-3 text-sm font-semibold text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"><LockKeyhole className="size-4" aria-hidden="true"/>Clôturer caisse</button> : null

  const mobileSessionLabel = isCashSessionOpen ? "Session de caisse active" : "Session de caisse fermée"
  const mobileHeader = <header className="relative z-10 shrink-0 border-b border-[var(--pos-divider)] bg-[var(--pos-panel)] px-[calc(var(--pos-gutter-x)+var(--safe-left,0px))] pb-2 pt-[calc(.5rem+var(--safe-top,0px))] pr-[calc(var(--pos-gutter-x)+var(--safe-right,0px))] shadow-[var(--shadow-dashboard-surface)] md:hidden">
    <div className="flex min-h-14 min-w-0 items-center justify-between gap-1.5">
      {renderIdentity(true)}
      <div className="flex shrink-0 items-center gap-0.5">
        <span role="status" aria-label={mobileSessionLabel} className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border", isCashSessionOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300")}>
          {isCashSessionOpen ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <CircleOff className="size-5" aria-hidden="true" />}
        </span>
        <span className="[&_button]:size-11 [&_button]:rounded-full"><ThemeToggle /></span>
        <button type="button" onClick={onLogout} className="dashboard-focus-visible flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Se déconnecter">
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <nav aria-label="Navigation du point de vente" className="mt-1">{tabs}</nav>
  </header>

  return <>{mobileHeader}<PosHeaderPrimitive className="hidden md:block" title={renderIdentity()} sessionStatus={sessionStatus} sessionLabel={isCashSessionOpen ? "Session active" : "Caisse fermée"} actions={<>{tabs}{actions}</>} closeSessionAction={closeAction} /></>
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
      {active ? <ReceiptText className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}
