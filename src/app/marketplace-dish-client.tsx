"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ChefHat, LayoutGrid, MapPin, Moon, Search, Store, Sun, Utensils } from "lucide-react"

import {
  MarketplaceCategoryRail,
  MarketplaceContainer,
  MarketplaceFeedback,
  MarketplaceLayout,
  MarketplacePublicFooter,
  type MarketplaceCategoryPresentation,
} from "@/components/marketplace-ui"
import { PublicPrice } from "@/components/public-ui"
import { useTheme } from "@/contexts/theme-context"
import type { PlatformPublicFooter } from "@/types"
import type { MarketplaceDishHomeViewModel, MarketplaceRestaurantCardPresentation } from "./marketplace-dish-view-model"

const RESTAURANTS_PER_PAGE = 10

export interface MarketplaceDishClientProps {
  model: MarketplaceDishHomeViewModel
  loadError?: boolean
  marketplaceHeroCoverImageUrl?: string | null
  platformLogoUrl?: string | null
  platformName?: string
  publicFooter: PlatformPublicFooter
}

export default function MarketplaceDishClient({ loadError = false, marketplaceHeroCoverImageUrl = null, model, platformLogoUrl = null, platformName = "Oordera", publicFooter }: MarketplaceDishClientProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [activeCategoryId, setActiveCategoryId] = React.useState(model.selectedCategoryId)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [navigating, startTransition] = React.useTransition()

  const navigate = (updates: Record<string, string | null>, mode: "push" | "replace" = "push") => {
    const params = new URLSearchParams()
    const nextCategory = updates.category === undefined ? activeCategoryId : updates.category
    const nextCursor = updates.cursor === undefined ? null : updates.cursor
    if (nextCategory) params.set("category", nextCategory)
    if (nextCursor) params.set("cursor", nextCursor)
    const href = params.size ? `/?${params.toString()}` : "/"
    if (mode === "replace" && typeof window !== "undefined") {
      window.history.replaceState(null, "", href)
      return
    }
    startTransition(() => router.push(href))
  }

  const selectCategory = (category: MarketplaceCategoryPresentation) => {
    if (category.id === activeCategoryId) return
    setActiveCategoryId(category.id)
    navigate({ category: category.id, cursor: null }, "replace")
  }

  const normalizedQuery = normalizeSearch(query)
  const activeRestaurants = React.useMemo(() => activeCategoryId ? model.restaurantsByCategory[activeCategoryId] ?? [] : model.restaurants, [activeCategoryId, model.restaurants, model.restaurantsByCategory])
  const activeCategoryLabel = React.useMemo(() => model.categories.find((category) => category.id === activeCategoryId)?.label ?? null, [activeCategoryId, model.categories])
  const categories = React.useMemo(() => model.categories.map((category) => ({ ...category, active: category.id === activeCategoryId })), [activeCategoryId, model.categories])
  const allRestaurants = React.useMemo(() => dedupeRestaurants(Object.values(model.restaurantsByCategory).flat()), [model.restaurantsByCategory])

  const visibleRestaurants = React.useMemo(() => {
    if (!normalizedQuery) return activeRestaurants

    const categoryMatches = model.categories
      .filter((category) => normalizeSearch(category.label).includes(normalizedQuery))
      .flatMap((category) => model.restaurantsByCategory[category.id] ?? [])
    const dishMatches = model.searchableDishes
      .filter((dish) => normalizeSearch([dish.name, dish.categoryLabel].filter(Boolean).join(" ")).includes(normalizedQuery))
      .map((dish) => findRestaurantForDish(dish.restaurantId, dish.marketplaceCategoryId, model.restaurantsByCategory, allRestaurants))
      .filter((restaurant): restaurant is MarketplaceRestaurantCardPresentation => Boolean(restaurant))
    const dishFirstResults = dedupeRestaurants([...categoryMatches, ...dishMatches])
    if (dishFirstResults.length) return dishFirstResults

    return allRestaurants.filter((restaurant) => {
      return normalizeSearch([
        restaurant.name,
        restaurant.locationLabel,
        restaurant.productCountLabel,
        restaurant.minimumPriceLabel,
      ].filter(Boolean).join(" ")).includes(normalizedQuery)
    })
  }, [activeRestaurants, allRestaurants, model.categories, model.restaurantsByCategory, model.searchableDishes, normalizedQuery])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [activeCategoryId, normalizedQuery])

  const totalRestaurants = visibleRestaurants.length
  const totalPages = Math.max(1, Math.ceil(totalRestaurants / RESTAURANTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = totalRestaurants ? (safeCurrentPage - 1) * RESTAURANTS_PER_PAGE + 1 : 0
  const pageEnd = Math.min(safeCurrentPage * RESTAURANTS_PER_PAGE, totalRestaurants)
  const paginatedRestaurants = React.useMemo(
    () => visibleRestaurants.slice((safeCurrentPage - 1) * RESTAURANTS_PER_PAGE, safeCurrentPage * RESTAURANTS_PER_PAGE),
    [safeCurrentPage, visibleRestaurants]
  )
  const paginationItems = React.useMemo(() => buildPaginationItems(safeCurrentPage, totalPages), [safeCurrentPage, totalPages])

  return (
    <MarketplaceLayout aria-busy={navigating || undefined}>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)]/95 pt-[var(--marketplace-safe-top)] shadow-[var(--shadow-public-xs)] backdrop-blur-xl">
        <MarketplaceContainer className="flex min-h-16 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 rounded-[var(--radius-public-md)] font-public-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="Oordera, accueil Marketplace">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--brand-primary)]/15 bg-[var(--brand-primary-soft)] p-1 text-[var(--brand-primary)] shadow-[var(--shadow-public-xs)]">
              {platformLogoUrl ? <img src={platformLogoUrl} alt="" className="size-full rounded-full object-cover" /> : <Utensils className="size-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 truncate text-[21px] tracking-normal text-[var(--text-primary)]">Oordera</span>
          </Link>
          <MarketplaceThemeSwitch />
        </MarketplaceContainer>
      </header>

      <MarketplaceContainer as="main" className="space-y-3 pb-[max(var(--space-16),var(--marketplace-safe-bottom))] pt-[calc(var(--marketplace-safe-top)+4rem)] sm:space-y-5">
        {/* ✅ 1. Bannière réduite : h-[185px] sm:h-[230px] lg:h-[270px] */}
        <section className="relative -mx-[var(--marketplace-gutter-x)] h-[185px] overflow-hidden rounded-b-[28px] border-b border-[var(--brand-primary)]/15 bg-[linear-gradient(135deg,rgb(var(--brand-primary-rgb)/0.18),rgb(255_255_255/0.94)_48%,rgb(var(--brand-primary-rgb)/0.12))] shadow-[var(--shadow-public-md)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgb(15_23_42),rgb(2_6_23)_72%)] sm:mx-0 sm:h-[230px] sm:rounded-b-[32px] lg:h-[270px]">
          {marketplaceHeroCoverImageUrl ? (
            <img src={marketplaceHeroCoverImageUrl} alt="" className="absolute inset-0 size-full object-cover object-center" />
          ) : null}
          <div aria-hidden="true" className={`absolute inset-0 ${marketplaceHeroCoverImageUrl ? "bg-[linear-gradient(90deg,rgb(0_0_0/0.54),rgb(0_0_0/0.18)_54%,rgb(0_0_0/0.06)),linear-gradient(180deg,rgb(0_0_0/0.08),rgb(0_0_0/0.34))]" : "bg-[linear-gradient(90deg,rgb(var(--brand-primary-rgb)/0.18),transparent_62%),linear-gradient(180deg,rgb(255_255_255/0.10),rgb(255_255_255/0.38))] dark:bg-[linear-gradient(90deg,rgb(0_0_0/0.30),transparent_62%),linear-gradient(180deg,rgb(255_255_255/0.02),rgb(0_0_0/0.18))]"}`} />
          <div className="relative flex h-full flex-col justify-center gap-4 px-[var(--marketplace-gutter-x)] sm:max-w-[34rem] sm:gap-5 sm:px-7 lg:px-9">
            <h1 className={`max-w-[18rem] text-[24px] font-public-bold leading-[30px] tracking-normal sm:max-w-[28rem] sm:text-[34px] sm:leading-[40px] ${marketplaceHeroCoverImageUrl ? "text-white drop-shadow-[0_2px_14px_rgb(0_0_0/0.45)]" : "text-[var(--text-primary)] dark:text-white"}`}>Qu'avez-vous envie de déguster aujourd'hui ?</h1>
            {/* ✅ 2. Champ de recherche élargi */}
            <label className="relative block w-full max-w-[18rem] sm:max-w-[22rem] lg:max-w-[24rem]">
              <span className="sr-only">Rechercher un restaurant, un plat ou une cuisine</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-[var(--brand-primary)] dark:text-white/80" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un plat ou une cuisine..."
                className="h-11 w-full rounded-[var(--radius-public-xl)] border border-white/65 bg-white/72 pl-12 pr-4 text-[13px] font-public-semibold text-[var(--text-primary)] shadow-[var(--shadow-public-md)] outline-none backdrop-blur-md transition-[border-color,box-shadow,background-color] placeholder:text-[var(--text-secondary)]/70 focus:border-white/90 focus:bg-white/86 focus:shadow-[var(--shadow-public-md)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 dark:border-white/14 dark:bg-slate-950/42 dark:text-white dark:placeholder:text-white/48 dark:focus:bg-slate-950/58 sm:text-public-sm"
              />
            </label>
          </div>
        </section>

        {model.categories.length ? (
          <section aria-labelledby="marketplace-categories" className="space-y-3 rounded-[24px] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)]/70 p-3 shadow-[var(--shadow-public-xs)] dark:bg-white/[0.03]">
            <div>
              <h2 id="marketplace-categories" className="flex items-center gap-2 text-public-heading-3 font-public-bold">
                <LayoutGrid aria-hidden="true" className="size-5 text-[var(--brand-primary)]" />
                <span>Catégories</span>
              </h2>
            </div>
            <MarketplaceCategoryRail categories={categories} onSelect={selectCategory} />
          </section>
        ) : (
          <MarketplaceFeedback state="empty" title="Aucune catégorie active" description="Les catégories marketplace apparaîtront ici dès qu’elles seront activées par la plateforme." />
        )}

        <section aria-labelledby="marketplace-restaurants" className="w-full min-w-0 max-w-[calc(100vw-(var(--marketplace-gutter-x)*2))] space-y-3 rounded-[24px] border border-[var(--marketplace-border-subtle)] bg-[linear-gradient(180deg,rgb(255_255_255/0.82),rgb(var(--brand-primary-rgb)/0.035))] p-3 shadow-[var(--shadow-public-xs)] dark:bg-[linear-gradient(180deg,rgb(255_255_255/0.045),rgb(255_255_255/0.02))]">
          <div className="space-y-1.5">
            {/* ✅ 4. Catégorie active en pastille */}
            <h2
              id="marketplace-restaurants"
              className="flex min-w-0 flex-wrap items-center gap-2 break-words text-public-heading-3 font-public-bold"
            >
              <Store
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--brand-primary)]"
              />

              <span className="min-w-0">
                {normalizedQuery ? "Résultats" : "Restaurants"}
              </span>

              {!normalizedQuery && activeCategoryLabel ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[11px] font-public-extrabold text-[var(--brand-primary)]">
                  {activeCategoryLabel}
                </span>
              ) : null}
            </h2>
            <div className="flex items-center justify-between gap-3 text-[11px] font-public-semibold text-[var(--text-muted)] sm:text-xs">
              <span>{totalRestaurants} restaurant{totalRestaurants > 1 ? "s" : ""} trouvé{totalRestaurants > 1 ? "s" : ""}</span>
              {totalRestaurants ? <span>Affichage {pageStart}–{pageEnd}</span> : null}
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-[var(--radius-public-lg)] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)]/80 p-1.5 shadow-[var(--shadow-public-xs)] dark:bg-white/[0.035]">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="min-h-9 rounded-[var(--radius-public-full)] px-3 text-xs font-public-bold text-[var(--text-secondary)] transition hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-40"
              >
                Précédent
              </button>
              <div className="flex min-w-0 items-center justify-center gap-1">
                {paginationItems.map((item, index) => item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-xs font-public-bold text-[var(--text-muted)]">...</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    aria-current={item === safeCurrentPage ? "page" : undefined}
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-public-extrabold transition ${item === safeCurrentPage ? "bg-[var(--brand-primary)] text-white shadow-[0_8px_18px_rgb(var(--brand-primary-rgb)/0.22)]" : "text-[var(--text-secondary)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className="min-h-9 rounded-[var(--radius-public-full)] px-3 text-xs font-public-bold text-[var(--text-secondary)] transition hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          ) : null}

          {loadError ? (
            <MarketplaceFeedback state="unavailable" title="Restaurants indisponibles" description="Les projections marketplace ne sont pas accessibles dans cet environnement." />
          ) : totalRestaurants ? (
            <div key={`${activeCategoryId ?? "all"}-${normalizedQuery}-${safeCurrentPage}`} className="grid min-w-0 animate-in fade-in slide-in-from-bottom-1 grid-cols-1 gap-2.5 duration-200 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedRestaurants.map((restaurant) => <MarketplaceRestaurantCard key={restaurant.id} restaurant={restaurant} />)}
            </div>
          ) : (
            <MarketplaceFeedback state="empty" title="Aucun restaurant trouvé" description="Essayez une autre recherche ou changez de catégorie." />
          )}
        </section>
      </MarketplaceContainer>
      <MarketplacePublicFooter footer={publicFooter} logoUrl={platformLogoUrl} platformName={platformName} />
    </MarketplaceLayout>
  )
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("fr")
}

function MarketplaceThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div
      role="group"
      aria-label="Sélecteur jour nuit"
      className="relative grid h-9 w-[74px] grid-cols-2 rounded-full border border-[var(--marketplace-border-subtle)] bg-white/55 p-1 shadow-[var(--shadow-public-xs)] backdrop-blur-md dark:border-white/10 dark:bg-white/10"
    >
      <span
        aria-hidden="true"
        className={`absolute left-1 top-1 size-7 rounded-full bg-[var(--brand-primary)] shadow-[0_8px_18px_rgb(var(--brand-primary-rgb)/0.28)] transition-transform duration-300 ease-out ${isDark ? "translate-x-[36px]" : "translate-x-0"}`}
      />
      <button
        type="button"
        aria-label="Activer le mode clair"
        aria-pressed={!isDark}
        onClick={() => setTheme("light")}
        className={`relative z-10 flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${!isDark ? "text-white" : "text-[var(--text-secondary)] hover:text-[var(--brand-primary)] dark:text-white/62"}`}
      >
        <Sun aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Activer le mode sombre"
        aria-pressed={isDark}
        onClick={() => setTheme("dark")}
        className={`relative z-10 flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${isDark ? "text-white" : "text-[var(--text-secondary)] hover:text-[var(--brand-primary)] dark:text-white/62"}`}
      >
        <Moon aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

function dedupeRestaurants(restaurants: MarketplaceRestaurantCardPresentation[]) {
  const seen = new Set<string>()
  return restaurants.filter((restaurant) => {
    if (seen.has(restaurant.restaurantId)) return false
    seen.add(restaurant.restaurantId)
    return true
  })
}

function buildPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const items: Array<number | "ellipsis"> = []
  let previousPage = 0

  Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)
    .forEach((page) => {
      if (previousPage && page - previousPage > 1) items.push("ellipsis")
      items.push(page)
      previousPage = page
    })

  return items
}

function findRestaurantForDish(
  restaurantId: string,
  marketplaceCategoryId: string | null,
  restaurantsByCategory: Record<string, MarketplaceRestaurantCardPresentation[]>,
  allRestaurants: MarketplaceRestaurantCardPresentation[]
) {
  if (marketplaceCategoryId) {
    const categoryRestaurant = restaurantsByCategory[marketplaceCategoryId]?.find((restaurant) => restaurant.restaurantId === restaurantId)
    if (categoryRestaurant) return categoryRestaurant
  }
  return allRestaurants.find((restaurant) => restaurant.restaurantId === restaurantId) ?? null
}

function MarketplaceRestaurantCard({ restaurant }: { restaurant: MarketplaceRestaurantCardPresentation }) {
  return (
    <article className="group w-full max-w-full min-w-0 overflow-hidden rounded-[18px] border border-[var(--marketplace-border-subtle)] bg-[var(--marketplace-surface-card)] shadow-[var(--shadow-public-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/40 hover:shadow-[var(--shadow-public-md)] active:scale-[0.99] dark:bg-white/[0.045] dark:ring-1 dark:ring-white/5 motion-reduce:transform-none">
      <Link href={restaurant.href} className="relative flex min-h-[106px] w-full min-w-0 gap-2.5 overflow-hidden p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
        <div className="relative size-[88px] shrink-0 overflow-hidden rounded-[14px] bg-[var(--marketplace-surface-media)] sm:size-28">
          {restaurant.imageUrl ? (
            <img src={restaurant.imageUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none" />
          ) : (
            <div className="flex size-full items-center justify-center text-[var(--text-muted)]"><ChefHat className="size-8" aria-hidden="true" /></div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/30 to-transparent" aria-hidden="true" />
          <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-white/90 bg-white shadow-[var(--shadow-public-sm)]">
            {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" className="size-full object-cover" /> : <Store className="size-4 text-[var(--brand-primary)]" aria-hidden="true" />}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <h2 className="min-w-0 truncate text-public-sm font-public-extrabold leading-5 text-[var(--text-primary)] sm:text-public-md">{restaurant.name}</h2>
            <PublicPrice value={restaurant.minimumPriceLabel} role="card" className="max-w-[92px] justify-end truncate text-right text-[13px] font-public-extrabold text-[var(--brand-primary)]" />
          </div>
          <div className="min-w-0 space-y-0.5">
            {restaurant.locationLabel ? (
              <p className="flex min-w-0 items-center gap-1 truncate text-[11px] font-public-semibold leading-4 text-[var(--text-muted)]"><MapPin className="size-3 shrink-0" aria-hidden="true" />{restaurant.locationLabel}</p>
            ) : null}
            <p className={`inline-flex min-h-4 max-w-full items-center gap-1.5 rounded-full px-2 text-[10px] font-public-extrabold ${restaurant.isOpenNow ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>
              <span className={`size-1.5 rounded-full ${restaurant.isOpenNow ? "bg-emerald-500" : "bg-slate-400"}`} />
              <span className="truncate">{restaurant.isOpenNow ? restaurant.statusDetail : restaurant.statusLabel}</span>
            </p>
          </div>
          <div className="mt-auto min-w-0 pr-[94px] pt-1.5">
            <p className="truncate text-[11px] font-public-bold leading-4 text-[var(--text-secondary)]">{restaurant.productCountLabel}</p>
          </div>
        </div>
        <span className="absolute bottom-2.5 right-2.5 inline-flex min-h-7 max-w-[90px] items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[var(--radius-public-full)] bg-[var(--brand-primary)] px-2.5 text-[10px] font-public-bold text-[var(--action-primary-fg)] shadow-[0_8px_18px_rgb(var(--brand-primary-rgb)/0.24)] transition-transform group-active:scale-[0.97]">
          Voir le menu
          <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
        </span>
      </Link>
    </article>
  )
}