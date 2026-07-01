"use client"

import * as React from "react"
import { collection, doc, limit, query, where } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ChefHat, ClipboardList, Coffee, Search, ShoppingBag, Utensils } from "lucide-react"

import { useCollectionOnce, useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { getOptimizedImage } from "@/lib/image"
import CartDrawer from "./components/CartDrawer"
import CategoriesBar from "./components/CategoriesBar"
import DishCard from "./components/DishCard"
import Header from "./components/Header"
import HeroSection from "./components/HeroSection"
import ProductModal from "./components/ProductModal"
import PublicSectionTitle from "./components/PublicSectionTitle"
import PublicProductConfigurator from "./components/PublicProductConfigurator"
import { productNeedsConfigurator } from "@/lib/linked-option-groups"
import StickyCartBar from "./components/StickyCartBar"
import { getLatestTrackedOrder } from "./orderTrackingStorage"
import { useCart } from "./cart/CartContext"
import {
  type ActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"

const PUBLIC_MENU_CACHE_TTL_MS = 5 * 60 * 1000

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
  const categoriesSectionRef = React.useRef<HTMLDivElement>(null)
  const isDineInContinuation = mode === "dine_in" && Boolean(tableId)

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

  const restaurantQuery = useMemoFirebase(() => {
    if (!db || !slug) return null
    return query(collection(db, "restaurants"), where("slug", "==", slug), limit(1))
  }, [db, slug])

  const {
    data: restaurants,
    isLoading: isRestaurantDocLoading,
    error: restaurantError,
  } = useCollectionOnce(restaurantQuery, PUBLIC_MENU_CACHE_TTL_MS)
  const restaurant = restaurants?.[0] ?? null

  const restaurantId = restaurant?.id

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

  React.useEffect(() => {
    const primary = restaurant?.theme?.primary || "#f97316"
    const secondary = restaurant?.theme?.secondary || "#1f2937"

    document.documentElement.style.setProperty("--color-primary", primary)
    document.documentElement.style.setProperty("--color-secondary", secondary)
  }, [restaurant?.theme?.primary, restaurant?.theme?.secondary])

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
    restaurants === null

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

  return (
    <div id="app-root" className="public-menu-page min-h-screen pb-36 md:pb-32">
      <div id="main-content" className="public-menu-content">
        <Header
          restaurant={restaurant}
          cartCount={count}
          onCartClick={() => setCartOpen(true)}
        />
        <HeroSection restaurant={restaurant} table={tableContext} />

        <main className="relative z-10 -mt-5 rounded-t-[1.75rem] border-t border-[var(--public-card-border)] bg-transparent pt-5 sm:-mt-8 sm:rounded-t-[2rem] sm:pt-6 lg:-mt-10 lg:mx-auto lg:max-w-7xl lg:rounded-[2rem] lg:border">
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

        <StickyCartBar onClick={() => setCartOpen(true)} />

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
      </div>

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
    <div className="mx-auto w-full max-w-6xl pb-28 sm:pb-32 lg:pb-36">
      
      <TableContextError error={tableError} />

      {/* CATÉGORIES BAR */}
      <div ref={categoriesSectionRef} className="mb-4 scroll-mt-20">
        <CategoriesBar
          categories={categories}
          activeId={activeCategoryId}
          onSelect={onCategorySelect}
        />
      </div>

      {/* PRODUITS (UNE SEULE CATÉGORIE) */}
      {currentCategory && (
        <div className="mb-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-3">
            <PublicSectionTitle title={currentCategory.name} />
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 rounded-[1.75rem] border border-[var(--public-card-border)] bg-[var(--public-card-bg)] px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_18px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl md:bottom-5 md:left-1/2 md:right-auto md:w-[min(32rem,calc(100vw-2rem))] md:-translate-x-1/2 md:px-4">
      {active === "search" && (
        <div className="mx-auto mb-2 max-w-md">
          <div className="relative">
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Rechercher un plat..."
              className="h-12 w-full rounded-2xl border border-[var(--public-card-border)] bg-[var(--public-card-bg)] pl-4 pr-11 text-sm font-semibold text-[var(--public-text-main)] outline-none backdrop-blur focus:border-[var(--public-orange)] focus:ring-4 focus:ring-[var(--public-orange)]/10"
              autoFocus
            />
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--public-orange)]" />
          </div>
        </div>
      )}

      <div className="mx-auto grid h-12 max-w-md grid-cols-4 gap-1">
        {[
          { id: "home" as const, label: "Menu", icon: Utensils, onClick: onHome },
          { id: "order" as const, label: "Commande", icon: ShoppingBag, onClick: onOrder },
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
                  ? "bg-[var(--public-orange-soft)] text-[var(--public-orange)]"
                  : "text-[var(--public-text-muted)] hover:bg-[var(--public-orange-soft)] hover:text-[var(--public-text-main)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.id === "order" && count > 0 && (
                <span
                  className={`absolute -top-1 right-3 min-w-[18px] rounded-full px-1 py-0.5 text-[9px] font-black sm:right-5 ${
                    isActive
                      ? "bg-white text-[var(--public-orange)] dark:bg-[#24170d]"
                      : "bg-[var(--public-orange)] text-white"
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
