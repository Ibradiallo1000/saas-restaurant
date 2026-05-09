import { Skeleton } from "@/components/ui/skeleton"

export function SidebarSkeleton() {
  return (
    <aside className="relative hidden min-h-screen w-64 shrink-0 border-r border-border bg-sidebar p-4 md:block">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Skeleton className="h-10 w-10 rounded-xl bg-secondary/60" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32 bg-secondary/60" />
          <Skeleton className="h-3 w-20 bg-secondary/50" />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Skeleton className="mb-4 h-3 w-28 bg-secondary/50" />
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-xl bg-secondary/60" />
        ))}
      </div>

      <div className="absolute bottom-4 left-4 right-4">
        <Skeleton className="h-14 rounded-xl bg-secondary/60" />
      </div>
    </aside>
  )
}
