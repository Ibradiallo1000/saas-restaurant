"use client"

import * as React from "react"
import { collection, doc, query } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ChefHat, ClipboardList, Coffee, Home, ShoppingBag } from "lucide-react"

import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { getOptimizedImage } from "@/lib/image"

import CartDrawer from "./components/CartDrawer"
import CategoriesGrid from "./components/CategoriesGrid"
import CategoryModal from "./components/CategoryModal"
import Header from "./components/Header"
import HeroSection from "./components/HeroSection"
import SearchBar from "./components/SearchBar"
import StickyCartBar from "./components/StickyCartBar"
import { useCart } from "./cart/CartContext"

function PublicPageContent({ slug }: { slug: string }) {
  const db = useFirestore()
  const router = useRouter()
  const { count } = useCart()

  const [clientReady, setClientReady] = React.useState(false)
  const [loadTimedOut, setLoadTimedOut] = React.useState(false)
  const [homeSearch, setHomeSearch] = React.useState("")
  const [modalSearch, setModalSearch] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<any | null>(null)
  const [cartOpen, setCartOpen] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState<"home" | "order" | "tracking">("home")

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

  const slugRef = useMemoFirebase(() => {
    if (!db || !slug) return null
    return doc(db, "restaurantSlugs", slug)
  }, [db, slug])

  const { data: slugData, isLoading: isSlugLoading, error: slugError } = useDoc(slugRef)
  const mappedRestaurantId = slugData?.restaurantId

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !mappedRestaurantId) return null
    return doc(db, "restaurants", mappedRestaurantId)
  }, [db, mappedRestaurantId])

  const {
    data: restaurant,
    isLoading: isRestaurantDocLoading,
    error: restaurantError,
  } = useDoc(restaurantRef)

  const restaurantId = restaurant?.id

  React.useEffect(() => {
    const primary = restaurant?.theme?.primary || "#f97316"
    const secondary = restaurant?.theme?.secondary || "#1f2937"

    document.documentElement.style.setProperty("--color-primary", primary)
    document.documentElement.style.setProperty("--color-secondary", secondary)
  }, [restaurant?.theme?.primary, restaurant?.theme?.secondary])

  const productsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(collection(db, "restaurants", restaurantId, "products"))
  }, [db, restaurantId])

  const {
    data: products,
    isLoading: isProductsLoading,
    error: productsError,
  } = useCollection(productsQuery)

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(collection(db, "restaurants", restaurantId, "categories"))
  }, [db, restaurantId])

  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
    error: categoriesError,
  } = useCollection(categoriesQuery)

  const isRestaurantLoading =
    !clientReady ||
    isSlugLoading ||
    Boolean(slugData && !restaurantRef) ||
    Boolean(mappedRestaurantId && isRestaurantDocLoading)

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

  const modalProducts = React.useMemo(() => {
    if (!selectedCategory) return []

    const categoryProducts = productsByCategory[selectedCategory.id] || []
    const search = modalSearch.trim().toLowerCase()

    if (!search) return categoryProducts

    return categoryProducts.filter((product: any) => {
      return (
        product.name?.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      )
    })
  }, [modalSearch, productsByCategory, selectedCategory])

  const handleHomeClick = () => {
    setActiveNav("home")
    setSelectedCategory(null)
    setHomeSearch("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleOrderClick = () => {
    setActiveNav("order")
    setCartOpen(true)
  }

  const handleTrackingClick = () => {
    setActiveNav("tracking")
    if (!restaurantId) return

    const latestOrderId = window.localStorage.getItem(`restaurant_latest_order_${restaurantId}`)

    if (latestOrderId) {
      router.push(`/order/${restaurantId}/${latestOrderId}`)
      return
    }

    setCartOpen(true)
  }

  const handleCategorySelect = (category: any) => {
    setSelectedCategory(category)
    setModalSearch("")
  }

  if (isRestaurantLoading && !loadTimedOut) {
    return <PublicLoadingSkeleton />
  }

  if (isRestaurantLoading && loadTimedOut) {
    return <PublicFallbackMessage message="Chargement du restaurant trop long" />
  }

  if (slugError || restaurantError) {
    return <PublicFallbackMessage message="Impossible de charger ce restaurant" />
  }

  if (!slugData || !mappedRestaurantId) {
    return <PublicFallbackMessage message="Slug non trouve" />
  }

  if (!restaurant) {
    return <PublicFallbackMessage message="Restaurant non trouve" />
  }

  return (
    <div id="app-root" className="app-background min-h-screen pb-32 text-foreground">
      <div id="main-content">
        <Header
          restaurant={restaurant}
          cartCount={count}
          onCartClick={() => setCartOpen(true)}
        />
        <HeroSection restaurant={restaurant} />

        <main className="-mt-4 rounded-t-3xl bg-background pt-4 shadow-md">
          <div className="mx-auto w-full max-w-5xl px-4 pb-5">
            <div className="mb-5">
              <SearchBar value={homeSearch} onChange={setHomeSearch} />
            </div>

            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[20px] font-black uppercase tracking-[0.18em] text-[var(--color-primary)]">
                    Menu
                  </p>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {visibleCategories.length}
                </span>
              </div>

              {productsError || categoriesError ? (
                <div className="rounded-2xl bg-card px-6 py-14 text-center text-card-foreground shadow-sm">
                  <ChefHat className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
                  <h2 className="text-base font-black">
                    Menu indisponible
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Impossible de charger les categories et les plats.
                  </p>
                </div>
              ) : isMenuLoading ? (
                <CategoriesSkeleton />
              ) : visibleCategories.length > 0 ? (
                <CategoriesGrid
                  categories={visibleCategories}
                  onSelect={handleCategorySelect}
                />
              ) : (
                <div className="rounded-2xl bg-card px-6 py-14 text-center text-card-foreground shadow-sm">
                  <ChefHat className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
                  <h2 className="text-base font-black">
                    Aucune categorie trouvee
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Essayez une autre recherche.
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>

        <StickyCartBar onClick={() => setCartOpen(true)} />

        <PublicBottomNavigation
          active={activeNav}
          count={count}
          onHome={handleHomeClick}
          onOrder={handleOrderClick}
          onTracking={handleTrackingClick}
        />
      </div>

      {selectedCategory && (
        <CategoryModal
          category={selectedCategory}
          products={modalProducts}
          search={modalSearch}
          onSearchChange={setModalSearch}
          onClose={() => setSelectedCategory(null)}
          onOpenProduct={() => undefined}
        />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantId={restaurantId}
      />
    </div>
  )
}

export default function PublicPage({ slug }: { slug: string }) {
  return <PublicPageContent slug={slug} />
}

export function PublicBottomNavigation({
  active,
  count,
  onHome,
  onOrder,
  onTracking,
}: {
  active: "home" | "order" | "tracking"
  count: number
  onHome: () => void
  onOrder: () => void
  onTracking: () => void
}) {
  const items = [
    { id: "home" as const, label: "Accueil", icon: Home, onClick: onHome },
    { id: "order" as const, label: "Commande", icon: ShoppingBag, onClick: onOrder },
    { id: "tracking" as const, label: "Suivi", icon: ClipboardList, onClick: onTracking },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[70px] border-t bg-background/95 px-4 pb-2 pt-2 shadow-[0_-16px_35px_rgba(15,23,42,0.1)]">
      <div className="mx-auto grid h-full max-w-md grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex h-full flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-black transition-all ${
                isActive
                  ? "scale-105 bg-[var(--color-primary)] text-white shadow-lg"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              {item.id === "order" && count > 0 && (
                <span
                  className={`absolute -top-1 right-4 min-w-[18px] rounded-full px-1 py-0.5 text-[9px] font-black ${
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
