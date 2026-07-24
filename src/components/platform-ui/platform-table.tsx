import * as React from "react"
import { DashboardTableContainer } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { PlatformDensity, PlatformTableColumn } from "./platform-foundations"

export interface PlatformTableProps<Row> extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> { label: string; caption: React.ReactNode; columns: PlatformTableColumn<Row>[]; rows: Row[]; getRowKey: (row: Row, index: number) => React.Key; density?: PlatformDensity; loadingState?: React.ReactNode; emptyState?: React.ReactNode; errorState?: React.ReactNode }
export function PlatformTable<Row>({ caption, className, columns, density = "comfortable", emptyState, errorState, getRowKey, label, loadingState, rows, ...props }: PlatformTableProps<Row>) {
  if (errorState) return <>{errorState}</>
  if (loadingState) return <>{loadingState}</>
  if (!rows.length && emptyState) return <>{emptyState}</>
  return <DashboardTableContainer label={label} className={cn("border-[var(--platform-border)] bg-[var(--platform-panel)]", className)} {...props}><table><caption className="border-b border-[var(--platform-divider)] px-4 py-3 text-left text-xs text-[var(--dashboard-muted)]">{caption}</caption><thead className="bg-[var(--platform-muted)]"><tr>{columns.map((column) => <th key={column.id} scope="col" className={cn("px-4", density === "comfortable" ? "py-3" : "py-2", column.align === "right" && "text-right", column.align === "center" && "text-center", column.className)}>{column.header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--platform-divider)]">{rows.map((row, index) => <tr key={getRowKey(row, index)}>{columns.map((column) => <td key={column.id} className={cn("px-4", density === "comfortable" ? "py-3" : "py-2", column.align === "right" && "text-right", column.align === "center" && "text-center", column.numeric && "whitespace-nowrap tabular-nums", column.className)}>{column.cell(row)}</td>)}</tr>)}</tbody></table></DashboardTableContainer>
}

