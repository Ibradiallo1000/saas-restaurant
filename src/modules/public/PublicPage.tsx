"use client"

import * as React from "react"
import { collection, doc, limit, query, where } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ChefHat, ClipboardList, Coffee, Home, Search, ShoppingBag } from "lucide-react"

import { useCollectionOnce, useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { getOptimizedImage } from "@/lib/image"
import { formatPrice } from "@/lib/pricing"
import CartDrawer from "./components/CartDrawer"
import CategoriesBar from "./components/CategoriesBar"
import DishCard from "./components/DishCard"
import Header from "./components/Header"
import HeroSection from "./components/HeroSection"
import ProductModal from "./components/ProductModal"
import StickyCartBar from "./components/StickyCartBar"
import { useCart } from "./cart/CartContext"
import {
  type ActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"

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
  const isDineInContinuation = mode === "dine_in" && Boolean(tableId)

  React.useEffect(() => {
    setClientReady(true)
  }, [])

  React.useEffect(() => {
    console.log("CART STATE", items)
  }, [items])

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
  } = useCollectionOnce(restaurantQuery)
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
    return query(collection(db, "restaurants", restaurantId, "products"), limit(50))
  }, [db, restaurantId])

  const {
    data: products,
    isLoading: isProductsLoading,
    error: productsError,
  } = useCollectionOnce(productsQuery)

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(collection(db, "restaurants", restaurantId, "categories"), limit(50))
  }, [db, restaurantId])

  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
    error: categoriesError,
  } = useCollectionOnce(categoriesQuery)

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
    return (categoriesData || []).map((category: any) => ({
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

    const latestOrderId = window.localStorage.getItem(`restaurant_latest_order_${restaurantId}`)

    if (latestOrderId) {
      const latestTableSessionId = window.localStorage.getItem(`restaurant_latest_table_session_${restaurantId}`)
      router.push(
        `/order/${restaurantId}/${latestOrderId}${latestTableSessionId ? `?tableSessionId=${latestTableSessionId}` : ""}`
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

  function handleAddToCartGlobal(item: any) {
    addItem(item)
    setSelectedProduct(null)
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
    <div id="app-root" className="app-background min-h-screen pb-32 text-foreground md:pb-28">
      <div id="main-content">
        <Header
          restaurant={restaurant}
          cartCount={count}
          onCartClick={() => setCartOpen(true)}
        />
        <HeroSection restaurant={restaurant} />

        <main className="relative z-10 -mt-5 rounded-t-[1.75rem] bg-background pt-5 shadow-md sm:-mt-8 sm:rounded-t-[2rem] sm:pt-6 lg:-mt-10 lg:mx-auto lg:max-w-7xl lg:rounded-[2rem] lg:shadow-xl">
          <MainContent
            categories={visibleCategories}
            isLoading={isMenuLoading}
            hasError={Boolean(productsError || categoriesError)}
            productsByCategory={productsByCategory}
            table={tableContext}
            tableError={tableSessionError}
            activeCategoryId={activeCategoryId}
            onCategorySelect={handleCategorySelect}
            onOpenProduct={handleOpenProduct}
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

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onAddToCart={handleAddToCartGlobal}
          onClose={() => setSelectedProduct(null)}
        />
      )}
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
  table,
  tableError,
  activeCategoryId,
  onCategorySelect,
  onOpenProduct,
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
    <div className="mx-auto w-full max-w-6xl pb-6 sm:pb-8 lg:pb-10">
      
      <div className="px-4 sm:px-6 lg:px-8">
        <TableContextBanner table={table} error={tableError} />
      </div>

      {/* CATÉGORIES BAR */}
      <div className="mb-4">
        <CategoriesBar
          categories={categories}
          activeId={activeCategoryId}
          onSelect={onCategorySelect}
        />
      </div>

      {/* PRODUITS (UNE SEULE CATÉGORIE) */}
      {currentCategory && (
        <div className="mb-6 px-4 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-xl font-black text-[var(--color-primary)] sm:text-2xl">
            {currentCategory.name}
          </h2>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(productsByCategory[currentCategory.id] || []).map((product: any) => (
              <DishCard
                key={product.id}
                product={product}
                onOpenDetails={() => onOpenProduct(product)}
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

function TableContextBanner({
  table,
  error,
}: {
  table: RestaurantTableRecord | null
  error: string
}) {
  if (!table && !error) return null

  return (
    <div className="mb-4 rounded-2xl border bg-card px-4 py-3 text-sm font-bold shadow-sm sm:px-5">
      {table ? (
        <span>Commande sur place - {table.name || table.id}</span>
      ) : (
        <span className="text-red-600">{error}</span>
      )}
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_35px_rgba(15,23,42,0.1)] backdrop-blur md:bottom-4 md:left-1/2 md:right-auto md:w-[min(32rem,calc(100vw-2rem))] md:-translate-x-1/2 md:rounded-2xl md:border md:px-4 md:shadow-2xl">
      {active === "search" && (
        <div className="mx-auto mb-2 max-w-md">
          <div className="relative">
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Rechercher un plat..."
              className="h-12 w-full rounded-xl border bg-card pl-4 pr-11 text-sm font-semibold text-card-foreground outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
              autoFocus
            />
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-primary)]" />
          </div>
        </div>
      )}

      <div className="mx-auto grid h-12 max-w-md grid-cols-4 gap-1">
        {[
          { id: "home" as const, label: "Accueil", icon: Home, onClick: onHome },
          { id: "search" as const, label: "Recherche", icon: Search, onClick: onSearch },
          { id: "order" as const, label: "Commande", icon: ShoppingBag, onClick: onOrder },
          { id: "tracking" as const, label: "Suivi", icon: ClipboardList, onClick: onTracking },
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
                  ? "text-[var(--color-primary)]"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.id === "order" && count > 0 && (
                <span
                  className={`absolute -top-1 right-3 min-w-[18px] rounded-full px-1 py-0.5 text-[9px] font-black sm:right-5 ${
                    isActive
                      ? "bg-primary-foreground text-[var(--color-primary)]"
                      : "bg-[var(--color-primary)] text-white"
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
    <div className="app-background min-h-screen text-foreground">
      <div className="relative flex h-[140px] items-end bg-muted p-4">
        <div className="absolute inset-0 animate-pulse bg-muted" />
        <div className="relative flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-card shadow-sm" />
          <div>
            <p className="text-lg font-black">Chargement</p>
            <p className="text-xs font-semibold text-muted-foreground">
              Preparation du menu...
            </p>
          </div>
        </div>
      </div>
      <main className="px-4 py-5">
        <div className="mb-5 h-12 animate-pulse rounded-xl bg-muted" />
        <CategoriesSkeleton />
      </main>
    </div>
  )
}

function PublicFallbackMessage({ message }: { message: string }) {
  return (
    <div className="app-background mx-auto flex min-h-screen w-full items-center justify-center px-4 text-foreground">
      <div className="space-y-4 text-center">
        <Coffee className="mx-auto h-16 w-16 text-muted-foreground/60" />
        <h2 className="text-xl font-semibold">{message}</h2>
      </div>
    </div>
  )
}
