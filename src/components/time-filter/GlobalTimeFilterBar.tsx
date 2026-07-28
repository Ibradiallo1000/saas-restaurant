"use client"

import { useTimeFilter, type TimeFilterType } from "@/contexts/time-filter-context"
import { cn } from "@/lib/utils"

export function GlobalTimeFilterBar({ compact = false }: { compact?: boolean }) {
  const timeFilter = useTimeFilter()
  const options: Array<{ value: TimeFilterType; label: string }> = [
    { value: "today", label: "Aujourd’hui" },
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "custom", label: "Personnalisé" },
  ]

  return (
    <div className={cn("flex w-max min-w-full items-center gap-2 sm:min-w-0", !compact && "rounded-2xl border bg-card p-3 shadow-sm")}>
      <div className="flex shrink-0 rounded-xl border bg-background p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => timeFilter.setType(option.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-black transition",
              timeFilter.type === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {timeFilter.type === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={timeFilter.dateRange.start}
            onChange={(event) => timeFilter.setDateRange({ ...timeFilter.dateRange, start: event.target.value })}
            className="h-9 rounded-lg border bg-background px-2 text-xs font-bold"
          />
          <input
            type="date"
            value={timeFilter.dateRange.end}
            onChange={(event) => timeFilter.setDateRange({ ...timeFilter.dateRange, end: event.target.value })}
            className="h-9 rounded-lg border bg-background px-2 text-xs font-bold"
          />
        </div>
      ) : null}
    </div>
  )
}
