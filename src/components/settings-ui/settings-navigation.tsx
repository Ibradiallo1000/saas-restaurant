"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import type { SettingsNavigationItem, SettingsNavigationOrientation } from "./settings-foundations"

export interface SettingsNavigationProps extends Omit<React.HTMLAttributes<HTMLElement>, "onSelect"> { items: SettingsNavigationItem[]; activeId?: string; onSelect?: (id: string) => void; ariaLabel?: string; orientation?: SettingsNavigationOrientation; collapsed?: boolean }
export const SettingsNavigation = React.forwardRef<HTMLElement, SettingsNavigationProps>(({ activeId, ariaLabel = "Sections des paramètres", className, collapsed = false, items, onSelect, orientation = "adaptive", ...props }, ref) => {
  const visibleItems = items.filter((item) => !item.hidden)
  return <nav ref={ref} aria-label={ariaLabel} className={cn("min-w-0", className)} {...props}><ul className={cn("flex min-w-0 gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible", orientation === "horizontal" && "lg:flex-row lg:overflow-x-auto", orientation === "vertical" && "flex-col overflow-visible")}>
    {visibleItems.map((item) => { const active = item.id === activeId; const content = <><span aria-hidden="true" className="shrink-0 [&_svg]:size-5">{item.icon}</span><span className={cn("min-w-0", collapsed && "sr-only")}><span className="block text-sm font-semibold">{item.label}</span>{item.description ? <span className="mt-0.5 hidden text-xs font-normal text-[var(--settings-muted)] lg:block">{item.description}</span> : null}</span>{item.badge ? <span className="ml-auto shrink-0">{item.badge}</span> : null}</>;
      const classes = cn("dashboard-focus-visible flex min-h-11 min-w-max items-center gap-3 rounded-[var(--radius-dashboard-button)] px-3 py-2 text-left text-[var(--dashboard-subtitle)] transition-colors [transition-duration:var(--motion-settings-section)] hover:bg-[var(--settings-navigation-hover)] motion-reduce:transition-none lg:w-full", active && "bg-[var(--settings-navigation-active)] text-[var(--dashboard-title)]", item.disabled && "cursor-not-allowed text-[var(--settings-navigation-disabled)] opacity-60")
      return <li key={item.id}>{item.href ? <Link href={item.href} aria-current={active ? "page" : undefined} aria-disabled={item.disabled || undefined} tabIndex={item.disabled ? -1 : undefined} onClick={(event) => { if (item.disabled) event.preventDefault(); else onSelect?.(item.id) }} className={classes}>{content}</Link> : <button type="button" aria-current={active ? "page" : undefined} disabled={item.disabled} onClick={() => onSelect?.(item.id)} className={classes}>{content}</button>}</li>
    })}
  </ul></nav>
})
SettingsNavigation.displayName = "SettingsNavigation"
