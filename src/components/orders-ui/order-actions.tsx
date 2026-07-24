"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { OrderActionPresentation } from "./order-foundations"

export interface OrderActionBarProps extends React.HTMLAttributes<HTMLDivElement> { actions: OrderActionPresentation[]; ariaLabel?: string }
export const OrderActionBar = React.forwardRef<HTMLDivElement, OrderActionBarProps>(({ actions, ariaLabel = "Actions de la commande", className, ...props }, ref) => <div ref={ref} role="group" aria-label={ariaLabel} className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)} {...props}>{actions.map((action) => <Button key={action.id} type="button" variant={action.dangerous ? "destructive" : action.variant} className="min-h-[var(--target-dashboard-min)] min-w-0" disabled={action.disabled || action.loading} aria-busy={action.loading || undefined} data-confirmation-required={action.confirmationRequired || undefined} onClick={action.onSelect}>{action.icon ? <span aria-hidden="true">{action.icon}</span> : null}<span>{action.loading ? `${action.label}…` : action.label}</span></Button>)}</div>)
OrderActionBar.displayName = "OrderActionBar"

export interface OrderActionMenuProps { actions: OrderActionPresentation[]; label?: string; className?: string }
export function OrderActionMenu({ actions, className, label = "Autres actions" }: OrderActionMenuProps) { if (!actions.length) return null; return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className={cn("min-h-[var(--target-dashboard-min)] min-w-[var(--target-dashboard-min)]", className)} aria-label={label}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{actions.map((action) => <DropdownMenuItem key={action.id} disabled={action.disabled || action.loading} className={cn("min-h-10", action.dangerous && "text-[var(--data-negative)] focus:text-[var(--data-negative)]")} data-confirmation-required={action.confirmationRequired || undefined} onSelect={(event) => { event.preventDefault(); action.onSelect() }}>{action.icon}<span>{action.loading ? `${action.label}…` : action.label}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> }
