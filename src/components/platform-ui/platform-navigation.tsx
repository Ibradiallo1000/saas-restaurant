"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { PlatformNavigationItem } from "./platform-foundations"

export interface PlatformNavigationProps extends React.HTMLAttributes<HTMLElement> { label: string; items: PlatformNavigationItem[] }

function NavigationItem({ item, compact = false }: { item: PlatformNavigationItem; compact?: boolean }) {
  const classes = cn("dashboard-focus-visible flex min-h-11 items-center gap-3 rounded-[var(--radius-dashboard-button)] px-3 py-2 text-sm font-medium", item.state === "active" ? "bg-[var(--platform-highlight)] text-[var(--dashboard-title)]" : "text-[var(--dashboard-subtitle)] hover:bg-[var(--platform-muted)]", item.state === "disabled" && "pointer-events-none opacity-50", compact && "whitespace-nowrap")
  const content = <>{item.icon ? <span aria-hidden="true" className="shrink-0 [&_svg]:size-5">{item.icon}</span> : null}<span>{item.label}</span>{item.badge ? <span className="ml-auto">{item.badge}</span> : null}</>
  if (item.href) return <a href={item.href} aria-current={item.state === "active" ? "page" : undefined} aria-disabled={item.state === "disabled" || undefined} className={classes} onClick={item.state === "disabled" ? (event) => event.preventDefault() : item.onSelect}>{content}</a>
  return <button type="button" disabled={item.state === "disabled"} aria-current={item.state === "active" ? "page" : undefined} className={cn(classes, "w-full text-left")} onClick={item.onSelect}>{content}</button>
}

export const PlatformSidebar = React.forwardRef<HTMLElement, PlatformNavigationProps>(({ className, items, label, ...props }, ref) => <aside ref={ref} className={cn("w-full border-[var(--platform-border)] bg-[var(--platform-sidebar)] lg:w-64 lg:border-r", className)} {...props}><nav aria-label={label} className="grid gap-1 p-3">{items.map((item) => <NavigationItem key={item.id} item={item} />)}</nav></aside>)
PlatformSidebar.displayName = "PlatformSidebar"

export const PlatformSecondaryNavigation = React.forwardRef<HTMLElement, PlatformNavigationProps>(({ className, items, label, ...props }, ref) => <nav ref={ref} aria-label={label} className={cn("overflow-x-auto border-b border-[var(--platform-divider)]", className)} {...props}><div className="flex min-w-max gap-1 p-2">{items.map((item) => <NavigationItem key={item.id} item={item} compact />)}</div></nav>)
PlatformSecondaryNavigation.displayName = "PlatformSecondaryNavigation"
