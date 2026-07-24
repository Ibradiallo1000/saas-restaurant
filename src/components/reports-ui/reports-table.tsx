"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { DashboardTableContainer, DashboardToolbar } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { ReportDensity, ReportSortPresentation, ReportTableColumnPresentation } from "./reports-foundations"

export interface ReportsTableProps<Row> extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: string; caption: React.ReactNode; description?: string; columns: ReportTableColumnPresentation<Row>[]; rows: Row[]; getRowKey: (row: Row, index: number) => React.Key
  sort?: ReportSortPresentation; onSortChange?: (sort: ReportSortPresentation) => void; density?: ReportDensity; loadingState?: React.ReactNode; emptyState?: React.ReactNode; errorState?: React.ReactNode
}
export function ReportsTable<Row>({ caption, className, columns, density = "comfortable", emptyState, errorState, getRowKey, label, loadingState, onSortChange, rows, sort, ...props }: ReportsTableProps<Row>) {
  if (errorState) return <>{errorState}</>; if (loadingState) return <>{loadingState}</>; if (!rows.length && emptyState) return <>{emptyState}</>
  return <DashboardTableContainer label={label} className={cn("bg-[var(--reports-table)]", className)} {...props}><table><caption className="border-b border-[var(--reports-divider)] px-4 py-3 text-left text-xs font-medium text-[var(--dashboard-muted)]">{caption}</caption><thead className="border-b border-[var(--reports-divider)] bg-[var(--reports-muted)]"><tr>{columns.map((column) => { const active = sort?.columnId === column.id; const direction = active ? sort.direction : "none"; return <th key={column.id} scope="col" aria-sort={column.sortable ? direction : undefined} className={cn("px-4 text-left", density === "comfortable" ? "py-3" : "py-2", column.align === "right" && "text-right", column.align === "center" && "text-center", column.className)}>{column.sortable && onSortChange ? <button type="button" className="dashboard-focus-visible inline-flex min-h-[var(--target-dashboard-min)] items-center gap-1 rounded px-1" onClick={() => onSortChange({ columnId: column.id, direction: !active || direction === "none" ? "ascending" : direction === "ascending" ? "descending" : "none" })}>{column.header}{direction === "ascending" ? <ArrowUp aria-hidden="true" className="size-3.5" /> : direction === "descending" ? <ArrowDown aria-hidden="true" className="size-3.5" /> : <ChevronsUpDown aria-hidden="true" className="size-3.5" />}</button> : column.header}</th>})}</tr></thead><tbody className="divide-y divide-[var(--reports-divider)]">{rows.map((row, index) => <tr key={getRowKey(row, index)}>{columns.map((column) => <td key={column.id} className={cn("px-4", density === "comfortable" ? "py-3" : "py-2", column.align === "right" && "text-right", column.align === "center" && "text-center", column.numeric && "whitespace-nowrap tabular-nums", column.className)}>{column.cell(row)}</td>)}</tr>)}</tbody></table></DashboardTableContainer>
}

export interface ReportsTableToolbarProps extends React.HTMLAttributes<HTMLDivElement> { filters?: React.ReactNode; search?: React.ReactNode; actions?: React.ReactNode; count?: React.ReactNode }
export const ReportsTableToolbar = React.forwardRef<HTMLDivElement, ReportsTableToolbarProps>(({ actions, className, count, filters, search, ...props }, ref) => <DashboardToolbar ref={ref} className={className} {...props}><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{search}{filters}</div><div className="flex flex-wrap items-center gap-2">{count ? <span className="text-xs tabular-nums text-[var(--dashboard-muted)]">{count}</span> : null}{actions}</div></DashboardToolbar>)
ReportsTableToolbar.displayName = "ReportsTableToolbar"
