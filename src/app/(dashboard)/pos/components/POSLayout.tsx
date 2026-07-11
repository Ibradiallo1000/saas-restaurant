"use client"

import * as React from "react"
import { Menu } from "lucide-react"
import POSHeader, { type POSTab } from "./POSHeader"

type POSLayoutProps = {
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
  sidebar?: React.ReactNode
  center?: React.ReactNode
  left: React.ReactNode
  right?: React.ReactNode
}

export default function POSLayout({
  restaurantName,
  restaurantLogoUrl,
  activeTab,
  unpaidServedCount,
  isCashSessionOpen,
  userName,
  roleLabel,
  totalAmount = 0,
  onTabChange,
  canCloseSession = false,
  onCloseSession,
  onLogout,
  sidebar,
  center,
  left,
  right,
}: POSLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-background)]">
      
      {/* HEADER FIXE */}
      <POSHeader
        restaurantName={restaurantName}
        restaurantLogoUrl={restaurantLogoUrl}
        activeTab={activeTab}
        unpaidServedCount={unpaidServedCount}
        isCashSessionOpen={isCashSessionOpen}
        userName={userName}
        roleLabel={roleLabel}
        totalAmount={totalAmount}
        onTabChange={onTabChange}
        canCloseSession={canCloseSession}
        onCloseSession={onCloseSession}
        onLogout={onLogout}
      />

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-4 md:px-5">
        
        {sidebar && center && right ? (
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto lg:grid lg:grid-cols-[230px_minmax(0,1fr)_400px] lg:overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)_410px]">
            <section className="hidden min-h-0 overflow-hidden lg:block">{sidebar}</section>
            <details className="group relative z-20 shrink-0 lg:hidden">
              <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-full border bg-card px-4 text-sm font-black shadow-sm [&::-webkit-details-marker]:hidden">
                <Menu className="h-4 w-4 text-[var(--brand-primary)]" />
                Catégories
              </summary>
              <div className="absolute left-0 top-[3.25rem] z-30 h-[min(70vh,520px)] w-72 max-w-[calc(100vw-2rem)] overflow-hidden">
                {sidebar}
              </div>
            </details>
            <section className="min-h-[520px] min-w-0 overflow-hidden lg:min-h-0 lg:pr-1">{center}</section>
            <aside className="min-h-[520px] overflow-hidden lg:min-h-0">{right}</aside>
          </div>
        ) : right ? (
          <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <section className="min-w-0 h-full overflow-y-auto pr-2">{left}</section>
            <aside className="h-full overflow-y-auto">{right}</aside>
          </div>
        ) : (
          <section className="h-full overflow-y-auto">
            {left}
          </section>
        )}

      </div>
    </div>
  )
}
