"use client"

import * as React from "react"
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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      
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
      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        
        {sidebar && center && right ? (
          <div className="grid h-full grid-cols-[220px_minmax(0,1fr)_380px] gap-4">
            <section className="min-h-0 overflow-hidden">{sidebar}</section>
            <section className="min-w-0 overflow-y-auto pr-1">{center}</section>
            <aside className="min-h-0 overflow-hidden">{right}</aside>
          </div>
        ) : right ? (
          <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
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
