"use client"

import * as React from "react"
import { MetricCard, MetricDelta, MetricGroup, type MetricCardProps, type MetricDeltaProps } from "@/components/dashboard-ui"
import { cn } from "@/lib/utils"
import type { ReportComparison, ReportDataFreshness, ReportDataQuality, ReportMetricState } from "./reports-foundations"

const qualityLabels: Record<ReportDataQuality, string> = { complete: "Données complètes", partial: "Données partielles", estimated: "Données estimées", stale: "Données anciennes", unavailable: "Données indisponibles", unknown: "Qualité inconnue" }
const freshnessLabels: Record<ReportDataFreshness, string> = { live: "Temps réel", recent: "Données récentes", delayed: "Données retardées", historical: "Données historiques", unknown: "Fraîcheur inconnue" }

export interface DataQualityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> { quality: ReportDataQuality; label?: React.ReactNode }
export const DataQualityBadge = React.forwardRef<HTMLSpanElement, DataQualityBadgeProps>(({ className, label, quality, ...props }, ref) => <span ref={ref} data-quality={quality} className={cn("inline-flex min-h-6 items-center rounded-full bg-[var(--reports-quality-bg)] px-2 py-1 text-xs font-semibold text-[var(--reports-quality-fg)]", className)} {...props}>{label ?? qualityLabels[quality]}</span>)
DataQualityBadge.displayName = "DataQualityBadge"

export interface FreshnessIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> { freshness: ReportDataFreshness; label?: React.ReactNode; timestamp?: React.ReactNode }
export const FreshnessIndicator = React.forwardRef<HTMLSpanElement, FreshnessIndicatorProps>(({ className, freshness, label, timestamp, ...props }, ref) => <span ref={ref} data-freshness={freshness} className={cn("inline-flex flex-wrap items-center gap-1.5 text-xs text-[var(--dashboard-muted)]", className)} {...props}><span aria-hidden="true" className="size-2 rounded-full bg-[var(--reports-freshness-color)]" /><span>{label ?? freshnessLabels[freshness]}</span>{timestamp ? <time className="tabular-nums">{timestamp}</time> : null}</span>)
FreshnessIndicator.displayName = "FreshnessIndicator"

export interface ReportMetricCardProps extends MetricCardProps { quality?: ReportDataQuality; freshness?: ReportDataFreshness; state?: ReportMetricState; stateLabel?: React.ReactNode }
export const ReportMetricCard = React.forwardRef<HTMLElement, ReportMetricCardProps>(({ className, freshness, quality, state = "ready", stateLabel, ...props }, ref) => <MetricCard ref={ref} aria-busy={state === "loading" || undefined} className={cn("bg-[var(--reports-panel)]", className)} {...props} description={<>{props.description}{state !== "ready" && stateLabel ? <span className="mt-1 block">{stateLabel}</span> : null}{quality || freshness ? <span className="mt-2 flex flex-wrap gap-2">{quality ? <DataQualityBadge quality={quality} /> : null}{freshness ? <FreshnessIndicator freshness={freshness} /> : null}</span> : null}</>} />)
ReportMetricCard.displayName = "ReportMetricCard"

export interface ReportsSummaryProps extends React.HTMLAttributes<HTMLDivElement> { label?: string }
export const ReportsSummary = React.forwardRef<HTMLDivElement, ReportsSummaryProps>(({ className, label = "Indicateurs clés", ...props }, ref) => <MetricGroup ref={ref} aria-label={label} className={className} {...props} />)
ReportsSummary.displayName = "ReportsSummary"

export interface ReportsMetricDeltaProps extends Omit<MetricDeltaProps, "tone"> { comparison: ReportComparison }
export const ReportsMetricDelta = React.forwardRef<HTMLSpanElement, ReportsMetricDeltaProps>(({ comparison, ...props }, ref) => <MetricDelta ref={ref} tone={comparison === "positive" ? "positive" : comparison === "negative" ? "negative" : "neutral"} {...props} />)
ReportsMetricDelta.displayName = "ReportsMetricDelta"

