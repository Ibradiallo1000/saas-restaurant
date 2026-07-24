"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardFilters, DashboardToolbar } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"

export interface OrdersToolbarProps extends React.HTMLAttributes<HTMLDivElement> { search?: React.ReactNode; filters?: React.ReactNode; sort?: React.ReactNode; period?: React.ReactNode; refresh?: React.ReactNode; count?: React.ReactNode; secondaryActions?: React.ReactNode }
export const OrdersToolbar = React.forwardRef<HTMLDivElement, OrdersToolbarProps>(({ className, count, filters, period, refresh, search, secondaryActions, sort, ...props }, ref) => {
  const hasFilters = Boolean(search || filters || sort || period)
  return <DashboardToolbar ref={ref} aria-label="Outils des commandes" className={cn("min-w-0 flex-col items-stretch sm:flex-row sm:items-center", !hasFilters && "sm:justify-end", className)} {...props}>{hasFilters ? <DashboardFilters className="grid w-full grid-cols-1 sm:flex">{search ? <div className="min-w-0 flex-1">{search}</div> : null}{filters}{sort}{period}</DashboardFilters> : null}{count || refresh || secondaryActions ? <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:justify-end">{count ? <output className="text-sm font-semibold tabular-nums text-[var(--dashboard-muted)]">{count}</output> : null}{refresh}{secondaryActions}</div> : null}</DashboardToolbar>
})
OrdersToolbar.displayName = "OrdersToolbar"

export interface OrdersStatusTabItem { id: string; label: string; count?: number; disabled?: boolean }
export interface OrdersStatusTabsProps extends Omit<React.ComponentPropsWithoutRef<typeof Tabs>, "onValueChange"> { items: OrdersStatusTabItem[]; value: string; onValueChange: (value: string) => void; ariaLabel: string }
export const OrdersStatusTabs = React.forwardRef<React.ElementRef<typeof Tabs>, OrdersStatusTabsProps>(({ ariaLabel, className, items, onValueChange, value, ...props }, ref) => <Tabs ref={ref} value={value} onValueChange={onValueChange} className={cn("min-w-0", className)} {...props}><div className="overflow-x-auto pb-1"><TabsList aria-label={ariaLabel} className="h-auto min-w-max justify-start gap-1 bg-[var(--order-surface-muted)] p-1">{items.map((item) => <TabsTrigger key={item.id} value={item.id} disabled={item.disabled} className="min-h-[var(--target-dashboard-min)] gap-2 px-3 data-[state=active]:bg-[var(--order-surface)] data-[state=active]:text-[var(--dashboard-title)]">{item.label}{item.count != null ? <span aria-label={`${item.count} commandes`} className="min-w-6 rounded-full bg-[var(--dashboard-section)] px-1.5 py-0.5 text-xs tabular-nums">{item.count}</span> : null}</TabsTrigger>)}</TabsList></div></Tabs>)
OrdersStatusTabs.displayName = "OrdersStatusTabs"

export interface OrdersFiltersProps extends React.HTMLAttributes<HTMLDivElement> { search?: React.ReactNode; status?: React.ReactNode; payment?: React.ReactNode; channel?: React.ReactNode; period?: React.ReactNode; overdue?: React.ReactNode; sort?: React.ReactNode; activeCount?: number; onReset?: () => void; resetLabel?: string }
export const OrdersFilters = React.forwardRef<HTMLDivElement, OrdersFiltersProps>(({ activeCount = 0, channel, className, onReset, overdue, payment, period, resetLabel = "Réinitialiser", search, sort, status, ...props }, ref) => <div ref={ref} aria-label="Filtres des commandes" className={cn("grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center", className)} {...props}>{search}{status}{payment}{channel}{period}{overdue}{sort}{onReset ? <Button type="button" variant="ghost" className="min-h-[var(--target-dashboard-min)]" disabled={activeCount === 0} onClick={onReset}>{resetLabel}{activeCount > 0 ? <span className="ml-1 tabular-nums" aria-label={`${activeCount} filtres actifs`}>({activeCount})</span> : null}</Button> : null}</div>)
OrdersFilters.displayName = "OrdersFilters"
