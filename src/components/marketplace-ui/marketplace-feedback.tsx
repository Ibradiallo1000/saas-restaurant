import * as React from "react"
import { AlertTriangle, CloudOff, Loader2, SearchX, WifiOff } from "lucide-react"

import { PublicEmptyState } from "@/components/public-ui"
import type { MarketplaceFeedbackState } from "./marketplace-foundations"

export interface MarketplaceFeedbackProps {
  state: MarketplaceFeedbackState
  title: string
  description?: string
  action?: React.ReactNode
  headingAs?: "h1" | "h2" | "h3"
}

const icons: Record<MarketplaceFeedbackState, React.ReactNode> = {
  loading: <Loader2 className="animate-spin motion-reduce:animate-none" />,
  empty: <SearchX />,
  error: <AlertTriangle />,
  offline: <WifiOff />,
  stale: <CloudOff />,
  unavailable: <CloudOff />,
}

export function MarketplaceFeedback({ action, description, headingAs = "h2", state, title }: MarketplaceFeedbackProps) {
  if (state === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex min-h-32 items-center justify-center gap-3 rounded-[var(--radius-public-xl)] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-muted)] p-6 text-public-sm font-public-semibold text-[var(--text-secondary)]">
        <span aria-hidden="true" className="[&_svg]:size-5">{icons.loading}</span>{title}
      </div>
    )
  }
  return <PublicEmptyState variant={state === "error" ? "error" : "default"} title={title} description={description} icon={icons[state]} primaryAction={action} headingAs={headingAs} />
}
