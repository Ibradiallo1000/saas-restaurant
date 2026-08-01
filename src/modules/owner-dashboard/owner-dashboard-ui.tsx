import * as React from "react"
import { AlertTriangle, CheckCircle2, HelpCircle, Sparkles } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { OwnerMetricQuality } from "./owner-dashboard-metrics"

const qualityPresentation: Record<
  OwnerMetricQuality,
  { label: string; detail: string; icon: React.ComponentType<{ className?: string }> }
> = {
  complete: {
    label: "Donnée complète",
    detail: "Toutes les données disponibles sont incluses.",
    icon: CheckCircle2,
  },
  estimated: {
    label: "Estimation",
    detail: "La valeur utilise les informations disponibles.",
    icon: Sparkles,
  },
  partial: {
    label: "Donnée partielle",
    detail: "Certaines commandes ne sont pas incluses.",
    icon: AlertTriangle,
  },
  unavailable: {
    label: "Indisponible",
    detail: "Aucune donnée exploitable n’est disponible.",
    icon: HelpCircle,
  },
}

export function OwnerDataQualityBadge({ quality }: { quality: OwnerMetricQuality }) {
  const presentation = qualityPresentation[quality]
  const Icon = presentation.icon

  return (
    <span
      title={presentation.detail}
      aria-label={`${presentation.label}. ${presentation.detail}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        quality === "partial" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
        quality === "estimated" && "border-blue-500/40 text-blue-700 dark:text-blue-300",
        quality === "unavailable" && "border-muted-foreground/30 text-muted-foreground",
        quality === "complete" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{presentation.label}</span>
    </span>
  )
}

export function OwnerDashboardSkeleton() {
  return (
    <main className="space-y-4" aria-label="Chargement de la vue d’ensemble" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-56" /></div>
        <Skeleton className="h-11 w-64" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2 md:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </main>
  )
}
