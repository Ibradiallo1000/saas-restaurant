import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface OperationalStationIdentityProps {
  restaurantName?: string | null
  restaurantLogoUrl?: string | null
  subtitle: string
  fallbackIcon: LucideIcon
  compact?: boolean
}

export function OperationalStationIdentity({
  compact = false,
  fallbackIcon: FallbackIcon,
  restaurantLogoUrl,
  restaurantName,
  subtitle,
}: OperationalStationIdentityProps) {
  return (
    <span className={cn("flex min-w-0 items-center", compact ? "gap-2" : "gap-2.5")}>
      {restaurantLogoUrl ? (
        <img
          src={restaurantLogoUrl}
          alt={restaurantName || "Restaurant"}
          className={cn(
            "shrink-0 object-cover ring-1 ring-border",
            compact ? "size-9 rounded-xl min-[360px]:size-10" : "size-9 rounded-2xl"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center bg-[var(--brand-primary)] text-white shadow-sm",
            compact ? "size-9 rounded-xl min-[360px]:size-10" : "size-9 rounded-2xl"
          )}
        >
          <FallbackIcon className="size-5" aria-hidden="true" />
        </span>
      )}

      <span className="min-w-0">
        <span className="block truncate text-sm font-black leading-tight">
          {restaurantName || "Restaurant"}
        </span>
        <span
          className={cn(
            "text-[10px] font-black uppercase tracking-wide text-muted-foreground",
            compact ? "hidden min-[390px]:block" : "block"
          )}
        >
          {subtitle}
        </span>
      </span>
    </span>
  )
}

export interface OperationalMetric {
  id: string
  label: string
  value: React.ReactNode
  tone?: "normal" | "positive" | "warning" | "critical"
}

const metricToneClasses: Record<NonNullable<OperationalMetric["tone"]>, string> = {
  normal: "text-[var(--dashboard-value)]",
  positive: "text-[var(--data-positive)]",
  warning: "text-[var(--data-warning)]",
  critical: "text-[var(--data-negative)]",
}

export function OperationalMetricStrip({
  items,
  label,
  className,
}: {
  items: OperationalMetric[]
  label: string
  className?: string
}) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-[var(--radius-dashboard-card)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] px-4 py-3 shadow-[var(--shadow-dashboard-surface)]"
        >
          <dt className="truncate text-xs font-semibold text-[var(--dashboard-muted)]">
            {item.label}
          </dt>
          <dd
            className={cn(
              "shrink-0 text-xl font-black tabular-nums",
              metricToneClasses[item.tone ?? "normal"]
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
