import { cn } from "@/lib/utils"

export function PublicRestaurantCardSkeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("overflow-hidden rounded-[var(--radius-public-xl)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] shadow-[var(--shadow-public-sm)]", className)}><div className="aspect-video animate-pulse bg-[var(--surface-public-muted)] motion-reduce:animate-none" /><div className="space-y-3 p-4"><div className="h-6 w-2/3 animate-pulse rounded bg-[var(--surface-public-muted)] motion-reduce:animate-none" /><div className="h-4 w-full animate-pulse rounded bg-[var(--surface-public-muted)] motion-reduce:animate-none" /><div className="h-11 w-full animate-pulse rounded-[var(--radius-public-lg)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" /></div></div>
}
