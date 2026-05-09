import { Skeleton } from "@/components/ui/skeleton"

function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-10 w-64 max-w-[70vw]" />
        <Skeleton className="h-4 w-80 max-w-[80vw]" />
      </div>
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
  )
}

function MetricGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-8 w-28" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function DashboardRouteSkeleton() {
  return (
    <div className="space-y-8 pb-20">
      <PageHeaderSkeleton />
      <MetricGridSkeleton />
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-secondary/10 p-6">
          <Skeleton className="h-6 w-56" />
        </div>
        <div className="h-[300px] p-6">
          <ChartSkeleton />
        </div>
      </div>
    </div>
  )
}

export function ManagerRouteSkeleton() {
  return (
    <div className="flex min-h-[70vh] gap-6">
      <aside className="hidden w-72 shrink-0 space-y-3 rounded-2xl border bg-card/50 p-4 shadow-sm lg:block">
        <Skeleton className="h-8 w-44" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-xl" />
        ))}
      </aside>
      <main className="flex-1 space-y-6">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border bg-card/50 shadow-sm">
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export function POSRouteSkeleton() {
  return (
    <div className="space-y-6 pb-20">
      <PageHeaderSkeleton />
      <div className="grid min-h-[calc(100vh-220px)] gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 18 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-2xl" />
                <Skeleton className="mx-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
        <aside className="rounded-2xl border bg-card shadow-sm">
          <Skeleton className="h-20 w-full rounded-b-none rounded-t-2xl" />
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

export function KitchenRouteSkeleton() {
  return (
    <div className="space-y-6 pb-20">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, column) => (
          <section key={column} className="min-h-[420px] rounded-2xl border bg-card/50 p-4 shadow-sm">
            <Skeleton className="h-6 w-36" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border bg-background p-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function AdminRouteSkeleton() {
  return (
    <div className="space-y-6 pb-20">
      <PageHeaderSkeleton />
      <MetricGridSkeleton />
      <div className="overflow-hidden rounded-2xl border bg-card/50 shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-10 w-64 rounded-xl" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid gap-4 p-4 md:grid-cols-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-9 w-24 justify-self-end rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="flex h-full min-h-[260px] items-end gap-3 rounded-xl bg-muted/20 p-4">
      {[44, 62, 38, 78, 55, 88, 68].map((height, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-t-xl"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}
