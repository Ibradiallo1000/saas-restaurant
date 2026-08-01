"use client"

import * as React from "react"
import { PosLayout, PosPage } from "@/components/pos-ui"
import POSHeader, { type POSTab } from "./POSHeader"

type POSLayoutProps = {
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
  center?: React.ReactNode
  left: React.ReactNode
  right?: React.ReactNode
}

export default function POSLayout({
  restaurantName,
  restaurantLogoUrl,
  activeTab,
  readyOrderCount,
  isCashSessionOpen,
  userName,
  roleLabel,
  totalAmount = 0,
  onTabChange,
  canCloseSession = false,
  onCloseSession,
  onLogout,
  center,
  left,
  right,
}: POSLayoutProps) {
  const header = <POSHeader
        restaurantName={restaurantName}
        restaurantLogoUrl={restaurantLogoUrl}
        activeTab={activeTab}
        readyOrderCount={readyOrderCount}
        isCashSessionOpen={isCashSessionOpen}
        userName={userName}
        roleLabel={roleLabel}
        totalAmount={totalAmount}
        onTabChange={onTabChange}
        canCloseSession={canCloseSession}
        onCloseSession={onCloseSession}
        onLogout={onLogout}
      />

  return <PosPage header={header} layout="adaptive" fullHeight>
    {center && right ? <div className="flex h-full min-h-0 flex-col gap-[var(--pos-layout-gap)]">
      <PosLayout
        className="grid h-full min-h-0 grid-rows-[minmax(10rem,1fr)_minmax(18rem,44dvh)] overflow-hidden lg:grid-rows-1"
        layout="adaptive"
        catalog={<div className="h-full min-h-0 min-w-0">{center}</div>}
        cart={<div className="h-full min-h-0 min-w-0">{right}</div>}
      />
    </div> : center ? <div className="h-full min-h-0 min-w-0">{center}</div> : right ? <PosLayout layout="adaptive" catalog={left} cart={right} /> : <section className="h-full overflow-y-auto">{left}</section>}
  </PosPage>
}
