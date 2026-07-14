import { PublicRestaurantCardSkeleton, PublicSurface } from "@/components/public-ui"

export default function MarketplaceLoading() {
  return <main className="min-h-screen bg-[var(--surface-public-canvas)] px-4 py-8 font-publicBody sm:px-6"><div className="mx-auto max-w-6xl space-y-6" role="status" aria-label="Chargement des restaurants"><PublicSurface level="muted" radius="xl" padding="comfortable" className="space-y-3"><div className="h-8 w-2/3 animate-pulse rounded bg-[var(--surface-public-card)] motion-reduce:animate-none" /><div className="h-4 w-full max-w-xl animate-pulse rounded bg-[var(--surface-public-card)] motion-reduce:animate-none" /></PublicSurface><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <PublicRestaurantCardSkeleton key={index} />)}</div><span className="sr-only">Chargement des restaurants...</span></div></main>
}
