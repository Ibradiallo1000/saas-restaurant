import * as React from "react"
import { MetricCard, MetricGroup, type MetricCardProps } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { PlatformDataQuality } from "./platform-foundations"

const qualityLabels: Record<PlatformDataQuality, string> = { complete: "Complet", partial: "Partiel", estimated: "Estimé", placeholder: "Indicatif", stale: "Ancien", unavailable: "Indisponible", unknown: "Inconnu" }

export interface PlatformDataQualityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> { quality: PlatformDataQuality; label?: React.ReactNode }
export const PlatformDataQualityBadge = React.forwardRef<HTMLSpanElement, PlatformDataQualityBadgeProps>(({ className, label, quality, ...props }, ref) => <span ref={ref} data-quality={quality} className={cn("inline-flex min-h-6 items-center rounded-full border border-[var(--platform-quality-border)] bg-[var(--platform-quality-bg)] px-2 py-1 text-xs font-semibold text-[var(--platform-quality-fg)]", className)} {...props}>{label ?? qualityLabels[quality]}</span>)
PlatformDataQualityBadge.displayName = "PlatformDataQualityBadge"

export interface PlatformMetricCardProps extends MetricCardProps { quality?: PlatformDataQuality }
export const PlatformMetricCard = React.forwardRef<HTMLElement, PlatformMetricCardProps>(({ className, description, quality, ...props }, ref) => <MetricCard ref={ref} className={cn("border-[var(--platform-border)] bg-[var(--platform-panel)]", className)} description={<>{description}{quality ? <span className="mt-2 block"><PlatformDataQualityBadge quality={quality} /></span> : null}</>} {...props} />)
PlatformMetricCard.displayName = "PlatformMetricCard"

export const PlatformMetricGrid = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <MetricGroup ref={ref} className={className} {...props} />)
PlatformMetricGrid.displayName = "PlatformMetricGrid"

