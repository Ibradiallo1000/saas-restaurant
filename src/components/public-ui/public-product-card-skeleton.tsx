import * as React from "react"

import { cn } from "@/lib/utils"

export interface PublicProductCardSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const PublicProductCardSkeleton = React.forwardRef<
  HTMLDivElement,
  PublicProductCardSkeletonProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      "grid min-h-24 w-full grid-cols-[72px_minmax(0,1fr)] gap-2 overflow-hidden rounded-[var(--radius-public-xl)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] p-2 shadow-[var(--shadow-public-sm)] sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-3 sm:p-3",
      className
    )}
    {...props}
  >
    <div className="size-[72px] animate-pulse rounded-[var(--radius-public-lg)] bg-[var(--surface-public-muted)] motion-reduce:animate-none sm:size-20" />
    <div className="flex min-w-0 flex-col gap-1.5 py-0.5">
      <div className="h-[18px] w-3/4 animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
      <div className="h-3 w-full animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
      <div className="h-3 w-2/3 animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <div className="h-4 w-20 animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
        <div className="h-10 w-[76px] animate-pulse rounded-[var(--radius-public-lg)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
      </div>
    </div>
  </div>
))
PublicProductCardSkeleton.displayName = "PublicProductCardSkeleton"

export { PublicProductCardSkeleton }
