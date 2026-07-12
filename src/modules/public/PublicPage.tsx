"use client"

import * as React from "react"
import { collection, doc, limit, query, where } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ChefHat, ClipboardList, Coffee, Search, ShoppingBag, Utensils } from "lucide-react"

import { useCollectionOnce, useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { getOptimizedImage } from "@/lib/image"
import CartDrawer from "./components/CartDrawer"
import CategoriesBar from "./components/CategoriesBar"
import CoverPage from "./components/CoverPage"
import DishCard from "./components/DishCard"
import ProductModal from "./components/ProductModal"
import PublicSectionTitle from "./components/PublicSectionTitle"
import PublicProductConfigurator from "./components/PublicProductConfigurator"
import PublicMenuHeader from "./components/PublicMenuHeader"
import { productNeedsConfigurator } from "@/lib/linked-option-groups"
import { getLatestTrackedOrder } from "./orderTrackingStorage"
import { useCart } from "./cart/CartContext"
import {
  type ActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"

const PUBLIC_MENU_CACHE_TTL_MS = 5 * 60 * 1000
const COVER_TRANSITION_MS = 720
const COVER_REDUCED_MOTION_MS = 180

function PublicPageContent({
  slug,
  tableId,
  sessionId,
  mode,
  orderId,
}: {
  slug: string
  tableId?: string | null
  sessionId?: string | null
  mode?: string | null
  orderId?: string | null
}) {
  const db = useFirestore()
  const router = useRouter()
  const { addItem, count, items } = useCart()

  const [clientReady, setClientReady] = React.useState(false)
  const [loadTimedOut, setLoadTimedOut] = React.useState(false)
  const [homeSearch, setHomeSearch] = React.useState("")
  const [cartOpen, setCartOpen] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState<"home" | "search" | "order" | "tracking">("home")
  const [tableSessionError, setTableSessionError] = React.useState("")
  const [activeTableSession, setActiveTableSession] = React.useState<ActiveTableSession | null>(null)
  const [activeCategoryId, setActiveCategoryId] = React.useState<string>("")
  const [selectedProduct, setSelectedProduct] = React.useState<any | null>(null)
  const [coverState, setCoverState] = React.useState<"checking" | "visible" | "exiting" | "hidden">("checking")
  const [hasRetriedRestaurantLookup, setHasRetriedRestaurantLookup] = React.useState(false)
  const categoriesSectionRef = React.useRef<HTMLDivElement>(null)
  const menuStartRef = React.useRef<HTMLDivElement>(null)
  const isDineInContinuation = mode === "dine_in" && Boolean(tableId)
  const coverStorageKey = React.useMemo(() => `oordera:cover-seen:${slug}`, [slug])

  React.useEffect(() => {
    setClientReady(true)
  }, [])

  React.useEffect(() => {
    if (!clientReady) return

    setLoadTimedOut(false)
    const timeout = window.setTimeout(() => {
      setLoadTimedOut(true)
    }, 8000)

    return () => window.clearTimeout(timeout)
  }, [clientReady, slug])

  React.useEffect(() => {
    setHasRetriedRestaurantLookup(false)
  }, [slug])

  const restaurantQuery = useMemoFirebase(() => {
    if (!db || !slug) return null
    return query(collection(db, "restaurants"), where("slug", "==", slug), limit(1))
  }, [db, slug])

  const {
    data: restaurants,
    isLoading: isRestaurantDocLoading,
    error: restaurantError,
    refetch: refetchRestaurant,
  } = useCollectionOnce(restaurantQuery, PUBLIC_MENU_CACHE_TTL_MS)
  const restaurant = restaurants?.[0] ?? null

  const restaurantId = restaurant?.id

  const shouldRetryRestaurantLookup =
    !isRestaurantDocLoading &&
    !restaurantError &&
    restaurants !== null &&
    restaurants.length === 0 &&
    !hasRetriedRestaurantLookup

  React.useEffect(() => {
    if (!shouldRetryRestaurantLookup) return

    setHasRetriedRestaurantLookup(true)
    refetchRestaurant()
  }, [refetchRestaurant, shouldRetryRestaurantLookup])

  React.useLayoutEffect(() => {
    if (!restaurant) return

    try {
      const hasSeenCover = window.sessionStorage.getItem(coverStorageKey) === "true"
      setCoverState(hasSeenCover ? "hidden" : "visible")
    } catch {
      setCoverState("visible")
    }
  }, [coverStorageKey, restaurant])

  const tableRef = useMemoFirebase(() => {
    if (!db || !restaurantId || !tableId) return null
    return doc(db, "restaurants", restaurantId, "tables", tableId)
  }, [db, restaurantId, tableId])
  const { data: tableContext } = useDocOnce<RestaurantTableRecord>(tableRef)

  React.useEffect(() => {
    if (!tableId || tableContext || !restaurantId) {
      setTableSessionError("")
      return
    }

    const timeout = window.setTimeout(() => {
      setTableSessionError("Table introuvable ou indisponible")
    }, 1200)

    return () => window.clearTimeout(timeout)
  }, [restaurantId, tableContext, tableId])

  React.useEffect(() => {
    if (!restaurantId || !tableContext?.id) {
      setActiveTableSession(null)
      return
    }

    let cancelled = false

    ensureActiveTableSession(restaurantId, tableContext.id)
      .then((session) => {
        if (!cancelled) {
          setActiveTableSession(session)
          setTableSessionError("")
        }
      })
      .catch((error) => {
        console.error("table session error", error)
        if (!cancelled) {
          setActiveTableSession(null)
          setTableSessionError(
            error instanceof Error
              ? error.message
              : "Table introuvable ou indisponible"
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [restaurantId, tableContext?.id])

  const productsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, "products"),
      where("isActive", "==", true),
      limit(50)
    )
  }, [db, restaurantId])

  const {
    data: products,
    isLoading: isProductsLoading,
    error: productsError,
  } = useCollectionOnce(productsQuery, PUBLIC_MENU_CACHE_TTL_MS)

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(collection(db, "restaurants", restaurantId, "categories"), limit(50))
  }, [db, restaurantId])

  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
    error: categoriesError,
  } = useCollectionOnce(categoriesQuery, PUBLIC_MENU_CACHE_TTL_MS)

  const isRestaurantLoading =
    !clientReady ||
    isRestaurantDocLoading ||
    restaurants === null ||
    shouldRetryRestaurantLookup

  const isMenuLoading =
    Boolean(restaurantId) &&
    (isProductsLoading ||
      isCategoriesLoading ||
      products === null ||
      categoriesData === null)

  const optimizedCategories = React.useMemo(() => {
    return (categoriesData || [])
      .filter((category: any) => category.isActive !== false)
      .map((category: any) => ({
        ...category,
        imageUrl: getOptimizedImage(category.imageUrl || "", 300),
      }))
  }, [categoriesData])

  const productsByCategory = React.useMemo(() => {
    if (!products) return {}

    const categoriesById = new Map(
      optimizedCategories.map((category: any) => [category.id, category])
    )

    const map: Record<string, any[]> = {}

    products.forEach((product: any) => {
      if (product.isActive === false) return

      const category = categoriesById.get(product.categoryId)
      const categoryId = product.categoryId || "uncategorized"
      const enrichedProduct = {
        ...product,
        imageUrl: getOptimizedImage(product.imageUrl || category?.imageUrl || "", 300),
        categoryName: category?.name || "",
      }

      if (!map[categoryId]) map[categoryId] = []
      map[categoryId].push(enrichedProduct)
      
      // 🔥 TRI PAR POPULARITÉ À L'INTÉRIEUR DE CHAQUE CATÉGORIE
      map[categoryId].sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
    })

    return map
  }, [products, optimizedCategories])

  const visibleCategories = React.useMemo(() => {
    const categories = optimizedCategories
    const search = homeSearch.trim().toLowerCase()

    if (!search) return categories

    const matchingCategoryIds = new Set<string>()

    Object.entries(productsByCategory).forEach(([categoryId, categoryProducts]) => {
      const hasMatch = categoryProducts.some((product: any) => {
        return (
          product.name?.toLowerCase().includes(search) ||
          product.description?.toLowerCase().includes(search)
        )
      })

      if (hasMatch) matchingCategoryIds.add(categoryId)
    })

    return categories.filter((category: any) => {
      return (
        category.name?.toLowerCase().includes(search) ||
        matchingCategoryIds.has(category.id)
      )
    })
  }, [optimizedCategories, homeSearch, productsByCategory])

  const handleHomeClick = () => {
    setActiveNav("home")
    setHomeSearch("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleOrderClick = () => {
    setActiveNav("order")
    setCartOpen(true)
  }

  const handleSearchClick = () => {
    setActiveNav("search")
  }

  const handleTrackingClick = () => {
    setActiveNav("tracking")
    if (!restaurantId) return

    const latestTracking = getLatestTrackedOrder(restaurantId)

    if (latestTracking?.orderId) {
      router.push(
        `/order/${restaurantId}/${latestTracking.orderId}${latestTracking.tableSessionId ? `?tableSessionId=${latestTracking.tableSessionId}` : ""}`
      )
      return
    }

    setCartOpen(true)
  }

  const handleCategorySelect = (categoryId: string) => {
    setActiveCategoryId(categoryId)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleOpenProduct = (product: any) => {
    setSelectedProduct(product)
  }

  const handleEnterMenu = React.useCallback(() => {
    if (coverState !== "visible") return

    try {
      window.sessionStorage.setItem(coverStorageKey, "true")
    } catch {
      // sessionStorage can be unavailable in some private browsing contexts.
    }

    setCoverState("exiting")

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const delay = prefersReducedMotion ? COVER_REDUCED_MOTION_MS : COVER_TRANSITION_MS

    window.setTimeout(() => {
      setCoverState("hidden")
      menuStartRef.current?.focus({ preventScroll: true })
    }, delay)
  }, [coverState, coverStorageKey])

  const scrollToCategoriesSection = React.useCallback(() => {
    const section = categoriesSectionRef.current
    if (!section) return

    const y = section.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" })
  }, [])

  function handleAddToCartGlobal(item: any) {
    addItem(item)
    setSelectedProduct(null)
    scrollToCategoriesSection()
  }

  React.useEffect(() => {
    if (coverState !== "visible" && coverState !== "exiting") return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [coverState])

  if (isRestaurantLoading && !loadTimedOut) {
    return <PublicLoadingSkeleton />
  }

  if (isRestaurantLoading && loadTimedOut) {
    return <PublicFallbackMessage message="Chargement du restaurant trop long" />
  }

  if (restaurantError) {
    return <PublicFallbackMessage message="Impossible de charger ce restaurant" />
  }

  if (!restaurant) {
    return <PublicFallbackMessage message="Slug non trouve" />
  }

  const coverIsMounted = coverState === "visible" || coverState === "exiting"
  const menuIsOpening = coverState === "exiting"
  const menuIsCovered = coverState === "visible" || coverState === "checking"

  return (
    <div
      id="app-root"
      className="public-menu-page min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
    >
      <PublicMenuHeader
        restaurant={restaurant}
        cartCount={count}
        onCartClick={() => setCartOpen(true)}
      />

      <div
        id="main-content"
        ref={menuStartRef}
        tabIndex={-1}
        aria-hidden={coverIsMounted ? true : undefined}
        inert={coverIsMounted ? true : undefined}
        className={`public-menu-content public-cover-transition pt-[calc(3.75rem+env(safe-area-inset-top))] outline-none transition-[opacity,transform,filter] motion-reduce:translate-y-0 motion-reduce:blur-0 ${
          menuIsOpening
            ? "translate-y-0 opacity-100 blur-0"
            : menuIsCovered
            ? "translate-y-8 opacity-80 blur-[2px]"
            : "translate-y-0 opacity-100 blur-0"
        }`}
      >
        <main className="relative z-10 bg-transparent pt-2 sm:pt-3 lg:mx-auto lg:max-w-7xl">
          <MenuWelcomeWithTable table={tableContext} />
          <MainContent
            categories={visibleCategories}
            isLoading={isMenuLoading}
            hasError={Boolean(productsError || categoriesError)}
            productsByCategory={productsByCategory}
            tableError={tableSessionError}
            activeCategoryId={activeCategoryId}
            categoriesSectionRef={categoriesSectionRef}
            onCategorySelect={handleCategorySelect}
            onOpenProduct={handleOpenProduct}
            onAddedToCart={scrollToCategoriesSection}
          />
        </main>

      </div>

      <PublicBottomNavigation
        active={activeNav}
        count={count}
        searchValue={homeSearch}
        onHome={handleHomeClick}
        onSearch={handleSearchClick}
        onSearchChange={setHomeSearch}
        onOrder={handleOrderClick}
        onTracking={handleTrackingClick}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantId={restaurantId}
        tableContext={tableContext}
        activeTableSession={activeTableSession}
        activeOrderId={isDineInContinuation ? orderId : null}
      />

      {selectedProduct && productNeedsConfigurator(selectedProduct) ? (
        <PublicProductConfigurator
          product={selectedProduct}
          catalogProducts={products || []}
          onClose={() => setSelectedProduct(null)}
          onAdded={() => {
            setSelectedProduct(null)
            scrollToCategoriesSection()
          }}
        />
      ) : null}

      {selectedProduct && !productNeedsConfigurator(selectedProduct) ? (
        <ProductModal
          product={selectedProduct}
          onAddToCart={handleAddToCartGlobal}
          onClose={() => setSelectedProduct(null)}
        />
      ) : null}

      {coverIsMounted ? (
        <CoverPage
          restaurant={restaurant}
          isExiting={coverState === "exiting"}
          onEnterMenu={handleEnterMenu}
        />
      ) : null}
    </div>
  )
}

async function ensureActiveTableSession(
  restaurantId: string,
  tableId: string
): Promise<ActiveTableSession> {
  const response = await fetch(`/api/restaurants/${restaurantId}/table-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || "Impossible de preparer la session de table")
  }

  return response.json()
}

export default function PublicPage({
  slug,
  tableId,
  sessionId,
  mode,
  orderId,
}: {
  slug: string
  tableId?: string | null
  sessionId?: string | null
  mode?: string | null
  orderId?: string | null
}) {
  return (
    <PublicPageContent
      slug={slug}
      tableId={tableId}
      sessionId={sessionId}
      mode={mode}
      orderId={orderId}
    />
  )
}

function MainContent({
  categories,
  isLoading,
  hasError,
  productsByCategory,
  tableError,
  activeCategoryId,
  categoriesSectionRef,
  onCategorySelect,
  onOpenProduct,
  onAddedToCart,
}: any) {

  // AUTO-SÉLECTION DE LA PREMIÈRE CATÉGORIE
  React.useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      onCategorySelect(categories[0].id)
    }
  }, [categories, activeCategoryId, onCategorySelect])

  // FILTRE : UNE SEULE CATÉGORIE À LA FOIS
  const filteredCategories = React.useMemo(() => {
    if (!activeCategoryId) return []
    return categories.filter((c: any) => c.id === activeCategoryId)
  }, [categories, activeCategoryId])

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-6 sm:pb-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mb-4 h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="mb-6 h-10 animate-pulse rounded-full bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-card px-6 py-14 text-center shadow-sm">
          <ChefHat className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
          <h2 className="text-base font-black">Menu indisponible</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Impossible de charger les produits
          </p>
        </div>
      </div>
    )
  }

  const currentCategory = filteredCategories[0]

  return (
    <div className="mx-auto w-full max-w-6xl pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      
      <TableContextError error={tableError} />

      {/* CATÉGORIES BAR */}
      <div ref={categoriesSectionRef} className="mb-1 scroll-mt-24 pt-3 sm:pt-4">
        <CategoriesBar
          categories={categories}
          activeId={activeCategoryId}
          onSelect={onCategorySelect}
        />
      </div>

      {/* PRODUITS (UNE SEULE CATÉGORIE) */}
      {currentCategory && (
        <div className="mb-4 px-4 sm:px-6 lg:px-8">
          <div className="mb-2">
            <PublicSectionTitle title={currentCategory.name} />
          </div>

          <div className="flex flex-col gap-2 sm:gap-2.5">
            {(productsByCategory[currentCategory.id] || []).map((product: any) => (
              <DishCard
                key={product.id}
                product={product}
                onOpenDetails={() => onOpenProduct(product)}
                onAddedToCart={onAddedToCart}
              />
            ))}
          </div>

          {(productsByCategory[currentCategory.id] || []).length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun produit disponible dans cette catégorie
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function MenuWelcome() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-0 sm:px-6 lg:px-8">
      <p className="text-[22px] font-black leading-tight text-[var(--public-text-main)] sm:text-[23px]">
        Bonjour 👋
      </p>
      <p className="mt-0.5 text-[13.5px] font-semibold leading-snug text-[var(--public-text-muted)] sm:text-[15px]">
        Qu&apos;avez-vous envie de manger aujourd&apos;hui ?
      </p>
    </section>
  )
}

function MenuWelcomeWithTable({ table }: { table?: RestaurantTableRecord | null }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-0 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[22px] font-black leading-tight text-[var(--public-text-main)] sm:text-[23px]">
          Bonjour 👋
        </p>

        {table ? (
          <span className="shrink-0 rounded-full border border-[var(--brand-primary)]/15 bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[11px] font-black leading-none text-[var(--brand-primary)]">
            🪑 {table.name || table.id}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[13.5px] font-semibold leading-snug text-[var(--public-text-muted)] sm:text-[15px]">
        Qu&apos;avez-vous envie de manger aujourd&apos;hui ?
      </p>
    </section>
  )
}

function TableContextError({ error }: { error: string }) {
  if (!error) return null

  return (
    <div className="mb-5 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-center">
        <div className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 shadow-sm">
          {error}
        </div>
      </div>
    </div>
  )
}

function MenuState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl bg-card px-6 py-14 text-center text-card-foreground shadow-sm">
      <ChefHat className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
      <h2 className="text-base font-black">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function PublicBottomNavigation({
  active,
  count,
  searchValue,
  onHome,
  onSearch,
  onSearchChange,
  onOrder,
  onTracking,
}: {
  active: "home" | "search" | "order" | "tracking"
  count: number
  searchValue: string
  onHome: () => void
  onSearch: () => void
  onSearchChange: (value: string) => void
  onOrder: () => void
  onTracking: () => void
}) {
  const [badgePulse, setBadgePulse] = React.useState(false)
  const previousCountRef = React.useRef(count)

  React.useEffect(() => {
    if (count > previousCountRef.current) {
      setBadgePulse(true)
      const timeout = window.setTimeout(() => setBadgePulse(false), 450)
      previousCountRef.current = count
      return () => window.clearTimeout(timeout)
    }

    previousCountRef.current = count
  }, [count])

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-2xl border-t border-[var(--public-card-border)] bg-[var(--bg-card)] px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-6px_18px_rgba(15,23,42,0.07)] md:px-4">
      {active === "search" && (
        <div className="mx-auto mb-2 max-w-md">
          <div className="relative">
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Rechercher un plat..."
              className="h-12 w-full rounded-2xl border border-[var(--public-card-border)] bg-[var(--public-card-bg)] pl-4 pr-11 text-sm font-semibold text-[var(--public-text-main)] outline-none backdrop-blur focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/10"
              autoFocus
            />
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--brand-primary)]" />
          </div>
        </div>
      )}

      <div className="mx-auto grid h-12 max-w-md grid-cols-4 gap-1">
        {[
          { id: "home" as const, label: "Menu", icon: Utensils, onClick: onHome },
          { id: "order" as const, label: "Panier", icon: ShoppingBag, onClick: onOrder },
          { id: "tracking" as const, label: "Suivi", icon: ClipboardList, onClick: onTracking },
          { id: "search" as const, label: "Recherche", icon: Search, onClick: onSearch },
        ].map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex h-full flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-black transition-all ${
                isActive
                  ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
                  : "text-[var(--public-text-muted)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--public-text-main)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.id === "order" && count > 0 && (
                <span
                  className={`absolute -top-1 right-3 min-w-[18px] rounded-full px-1 py-0.5 text-[9px] font-black transition-transform duration-300 sm:right-5 ${
                    badgePulse ? "scale-125" : "scale-100"
                  } ${
                    isActive
                      ? "bg-white text-[var(--brand-primary)] dark:bg-slate-950/80"
                      : "bg-[var(--brand-primary)] text-white"
                  }`}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function CategoriesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl bg-card shadow-sm">
          <div className="aspect-[4/3] animate-pulse bg-muted" />
          <div className="flex items-center justify-between p-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-8 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PublicLoadingSkeleton() {
  return (
    <div className="public-menu-page min-h-screen text-[var(--public-text-main)]">
      <div className="public-menu-content">
      <div className="relative flex h-[140px] items-end bg-muted p-4">
        <div className="absolute inset-0 animate-pulse bg-muted" />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-card shadow-sm" />
          <div>
            <p className="text-lg font-black">Preparation de votre table...</p>
            <p className="text-xs font-semibold text-muted-foreground">
              Nous ouvrons votre session et recuperons le menu. Merci de patienter quelques secondes.
            </p>
          </div>
        </div>
      </div>
      <main className="px-4 py-5">
        <div className="mb-5 h-12 animate-pulse rounded-xl bg-muted" />
        <CategoriesSkeleton />
      </main>
      </div>
    </div>
  )
}

function PublicFallbackMessage({ message }: { message: string }) {
  return (
    <div className="public-menu-page mx-auto flex min-h-screen w-full items-center justify-center px-4 text-[var(--public-text-main)]">
      <div className="space-y-4 text-center">
        <Coffee className="mx-auto h-16 w-16 text-muted-foreground/60" />
        <h2 className="text-xl font-semibold">{message}</h2>
      </div>
    </div>
  )
}
