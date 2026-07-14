"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, Store } from "lucide-react"

import { PublicBadge, PublicButton, PublicEmptyState, PublicRestaurantCard, PublicSearchField, PublicSurface, SectionHeader } from "@/components/public-ui"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export type PublicRestaurantSummary = {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  coverUrl?: string | null
  description?: string | null
  location?: string | null
  cuisineTypes: string[]
  services: string[]
}

export default function MarketplaceClient({ restaurants, loadError = false }: { restaurants: PublicRestaurantSummary[]; loadError?: boolean }) {
  const [search, setSearch] = React.useState("")
  const [service, setService] = React.useState<string | null>(null)
  const availableServices = React.useMemo(() => Array.from(new Set(restaurants.flatMap((restaurant) => restaurant.services))).sort((a, b) => a.localeCompare(b, "fr")), [restaurants])
  const filteredRestaurants = React.useMemo(() => {
    const normalizedSearch = normalizeSearch(search)
    return restaurants.filter((restaurant) => {
      const matchesService = !service || restaurant.services.includes(service)
      const haystack = normalizeSearch([restaurant.name, restaurant.description, restaurant.location, ...restaurant.cuisineTypes].filter(Boolean).join(" "))
      return matchesService && (!normalizedSearch || haystack.includes(normalizedSearch))
    })
  }, [restaurants, search, service])

  const reset = () => { setSearch(""); setService(null) }

  return (
    <div className="min-h-screen bg-[var(--surface-public-canvas)] font-publicBody text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border-public-subtle)] bg-[var(--surface-public-translucent)] backdrop-blur-xl pt-[var(--safe-top)]">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 rounded-[var(--radius-public-md)] font-public-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="Oordera, marketplace"><span className="flex size-9 items-center justify-center rounded-[var(--radius-public-md)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"><Store className="size-5" aria-hidden="true" /></span>Oordera</Link>
          <nav className="flex items-center gap-1" aria-label="Navigation Marketplace">
            <Link href="/landing" className="hidden h-10 items-center rounded-[var(--radius-public-md)] px-3 text-public-sm font-public-semibold text-[var(--text-secondary)] outline-none hover:bg-[var(--surface-public-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex">Découvrir Oordera</Link>
            <Link href="/login" className="hidden h-10 items-center rounded-[var(--radius-public-md)] px-3 text-public-sm font-public-bold text-[var(--text-primary)] outline-none hover:bg-[var(--surface-public-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex">Connexion</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <PublicSurface as="section" level="muted" radius="xl" padding="comfortable" className="mb-6 overflow-hidden">
          <PublicBadge label="Marketplace Oordera" variant="brand" />
          <h1 className="mt-3 max-w-2xl text-[28px] font-public-extrabold leading-[34px] sm:text-[40px] sm:leading-[46px]">Trouvez votre restaurant</h1>
          <p className="mt-2 max-w-2xl text-public-sm leading-5 text-[var(--text-secondary)] sm:text-public-md">Découvrez les restaurants disponibles et accédez directement à leur menu.</p>
        </PublicSurface>

        <section aria-labelledby="marketplace-results" className="space-y-5">
          <PublicSearchField value={search} onChange={setSearch} onClear={() => setSearch("")} resultCount={filteredRestaurants.length} label="Rechercher un restaurant" placeholder="Nom, cuisine ou localisation..." />

          {availableServices.length ? <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filtres de services">{[null, ...availableServices].map((value) => <button key={value || "all"} type="button" aria-pressed={service === value} onClick={() => setService(value)} className={`h-10 shrink-0 rounded-[var(--radius-public-full)] border px-4 text-public-sm font-public-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${service === value ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]" : "border-[var(--border-public-default)] bg-[var(--surface-public-card)] text-[var(--text-secondary)]"}`}>{value || "Tous"}</button>)}</div> : null}

          <SectionHeader id="marketplace-results" title="Restaurants" description={`${filteredRestaurants.length} restaurant${filteredRestaurants.length > 1 ? "s" : ""} disponible${filteredRestaurants.length > 1 ? "s" : ""}`} />

          {loadError ? <PublicEmptyState variant="error" title="Restaurants indisponibles" description="Impossible de charger les restaurants pour le moment." /> : restaurants.length === 0 ? <PublicEmptyState title="Aucun restaurant disponible pour le moment" description="Revenez prochainement pour découvrir les restaurants Oordera." icon={<Building2 />} /> : filteredRestaurants.length === 0 ? <PublicEmptyState title={search ? "Aucun restaurant ne correspond à votre recherche" : "Aucun restaurant ne correspond à ces filtres"} description="Modifiez votre recherche ou réinitialisez les filtres." primaryAction={<PublicButton variant="outline" onClick={reset}>{search ? "Effacer la recherche" : "Réinitialiser les filtres"}</PublicButton>} /> : <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredRestaurants.map((restaurant) => <PublicRestaurantCard key={restaurant.id} {...restaurant} href={`/${restaurant.slug}`} />)}</div>}
        </section>
      </main>
      <footer className="border-t border-[var(--border-public-subtle)] px-4 py-6 text-center text-public-sm text-[var(--text-muted)]"><Link href="/landing" className="font-public-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline">Vous êtes restaurateur ? Découvrez Oordera</Link></footer>
    </div>
  )
}

function normalizeSearch(value: string) { return value.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() }
