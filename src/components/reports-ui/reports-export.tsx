"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ReportExportPresentation } from "./reports-foundations"

export interface ReportsExportMenuProps { items: ReportExportPresentation[]; label?: string; className?: string }
export function ReportsExportMenu({ className, items, label = "Exporter" }: ReportsExportMenuProps) {
  const available = items.filter((item) => typeof item.onSelect === "function")
  if (!available.length) return null
  return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" className={className}><Download aria-hidden="true" />{label}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{available.map((item) => <DropdownMenuItem key={item.id} disabled={item.disabled} className="min-h-[var(--target-dashboard-min)]" onSelect={(event) => { event.preventDefault(); item.onSelect() }}><span><span className="block font-medium">{item.label}</span>{item.description ? <span className="block text-xs text-[var(--dashboard-muted)]">{item.description}</span> : null}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
}

