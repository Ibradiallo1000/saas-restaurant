import * as React from "react"

import { cn } from "@/lib/utils"

export interface PublicCategoryCardSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const PublicCategoryCardSkeleton = React.forwardRef<
  HTMLDivElement,
  PublicCategoryCardSkeletonProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      "flex h-[100px] w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-public-lg)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] p-2 shadow-[var(--shadow-public-xs)] sm:h-[108px] sm:w-[84px]",
      className
    )}
    {...props}
  >
    <div className="size-[52px] animate-pulse rounded-[var(--radius-public-md)] bg-[var(--surface-public-muted)] motion-reduce:animate-none sm:size-[58px]" />
    <div className="h-3 w-12 animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
  </div>
))
PublicCategoryCardSkeleton.displayName = "PublicCategoryCardSkeleton"

export { PublicCategoryCardSkeleton }
