"use client"

import * as React from "react"
import { collection, doc, limit, query, where } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ChefHat, ClipboardList, Coffee, Search, ShoppingBag, Utensils } from "lucide-react"

import { useAuth, useCollection, useCollectionOnce, useDocOnce, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { getOptimizedImage } from "@/lib/image"
import { sortMenuCategories } from "@/lib/menu-category-order"
import CartDrawer from "./components/CartDrawer"
import CategoriesBar from "./components/CategoriesBar"
import CoverPage from "./components/CoverPage"
import DishCard from "./components/DishCard"
import ProductModal from "./components/ProductModal"
import PublicProductConfigurator from "./components/PublicProductConfigurator"
import {
  PublicBottomNavigation,
  PublicButton,
  PublicCategoryCardSkeleton,
  PublicEmptyState,
  PublicHeader,
  PublicPageShell,
  PublicProductCardSkeleton,
  PublicSearchField,
  SectionHeader,
} from "@/components/public-ui"
import { productNeedsConfigurator } from "@/lib/linked-option-groups"
import { buildMarketplaceIntentKey, claimMarketplaceIntent, MARKETPLACE_NAVIGATION_SOURCE, resolveMarketplaceProduct } from "@/lib/marketplace-offer-navigation"
import { getLatestTrackedOrder } from "./orderTrackingStorage"
import { useCart } from "./cart/CartContext"
import { ensurePublicFirebaseUser } from "./public-auth"
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
  marketplaceProductId,
  marketplaceCategoryId,
  navigationSource,
}: {
  slug: string
  tableId?: string | null
  sessionId?: string | null
  mode?: string | null
  orderId?: string | null
  marketplaceProductId?: string | null
  marketplaceCategoryId?: string | null
  navigationSource?: string | null
}) {
  const db = useFirestore()
  const auth = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const { addItem, count, items, restaurantId: cartRestaurantId, setRestaurantScope, syncCatalogAvailability } = useCart()

  const [clientReady, setClientReady] = React.useState(false)
  const [loadTimedOut, setLoadTimedOut] = React.useState(false)
  const [homeSearch, setHomeSearch] = React.useState("")
  const [cartOpen, setCartOpen] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState<"home" | "search" | "order" | "tracking">("home")
  const [tableSessionError, setTableSessionError] = React.useState("")
  const [activeCategoryId, setActiveCategoryId] = React.useState<string>("")
  const [selectedProduct, setSelectedProduct] = React.useState<any | null>(null)
  const [coverState, setCoverState] = React.useState<"checking" | "visible" | "exiting" | "hidden">("checking")
  const [dishReviewSummaries, setDishReviewSummaries] = React.useState<Record<string, { averageRating: number; reviewCount: number }>>({})
  const [restaurantReputation, setRestaurantReputation] = React.useState<{ averageRating: number | null; bayesianRating: number | null; reviewCount: number } | null>(null)
  const [hasRetriedRestaurantLookup, setHasRetriedRestaurantLookup] = React.useState(false)
  const categoriesSectionRef = React.useRef<HTMLDivElement>(null)
  const menuStartRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const cartTriggerRef = React.useRef<HTMLElement | null>(null)
  const productTriggerRef = React.useRef<HTMLElement | null>(null)
  const coverTransitionTimeoutRef = React.useRef<number | null>(null)
  const handledMarketplaceIntentsRef = React.useRef<Set<string>>(new Set())
  const previousActiveNavRef = React.useRef(activeNav)
  const isDineInContinuation = mode === "dine_in" && Boolean(tableId)
  const coverStorageKey = React.useMemo(() => `oordera:cover-seen:${slug}`, [slug])

  React.useEffect(() => () => {
    if (coverTransitionTimeoutRef.current !== null) {
      window.clearTimeout(coverTransitionTimeoutRef.current)
    }
  }, [])

  React.useEffect(() => {
    setClientReady(true)
  }, [])

  React.useEffect(() => {
    console.info("[PUBLIC_AUTH][BOOTSTRAP_STATE]", {
      hasUser: Boolean(user),
      uid: user?.uid ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      providerId: user?.providerId ?? null,
      providerData: user?.providerData.map((provider) => provider.providerId) ?? [],
    })
    if (auth.currentUser) return
    console.info("[PUBLIC_AUTH][SIGN_IN_ANONYMOUSLY_CALLED]")
    void ensurePublicFirebaseUser(auth)
      .then((firebaseUser) => {
        console.info("[PUBLIC_AUTH][SIGN_IN_ANONYMOUSLY_SUCCESS]", {
          uid: firebaseUser.uid,
          isAnonymous: firebaseUser.isAnonymous,
          providerId: firebaseUser.providerId,
          providerData: firebaseUser.providerData.map((provider) => provider.providerId),
        })
      })
      .catch((authError) => {
        console.error("[PUBLIC_AUTH][SIGN_IN_ANONYMOUSLY_ERROR]", authError)
        setTableSessionError("Impossible d’ouvrir une session client sécurisée.")
      })
  }, [auth, user])

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

  React.useEffect(() => {
    if (restaurantId) setRestaurantScope(restaurantId)
  }, [restaurantId, setRestaurantScope])
  const restaurantAcceptsMarketplaceIntent = Boolean(
    restaurant && restaurant.status === "active" && restaurant.isActive !== false && !restaurant.deletedAt
  )

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
      const hasSeenCover = navigationSource === MARKETPLACE_NAVIGATION_SOURCE || window.sessionStorage.getItem(coverStorageKey) === "true"
      setCoverState(hasSeenCover ? "hidden" : "visible")
    } catch {
      setCoverState(navigationSource === MARKETPLACE_NAVIGATION_SOURCE ? "hidden" : "visible")
    }
  }, [coverStorageKey, navigationSource, restaurant])

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
  } = useCollection(productsQuery)

  React.useEffect(() => {
    if (products !== null) syncCatalogAvailability(products || [])
  }, [products, syncCatalogAvailability])

  React.useEffect(() => {
    if (!selectedProduct || products === null) return
    const current = (products || []).find((product: any) => product.id === selectedProduct.id)
    if (current && current !== selectedProduct) setSelectedProduct(current)
    if (!current) setSelectedProduct(null)
  }, [products, selectedProduct])

  React.useEffect(() => {
    if (!restaurantId) {
      setRestaurantReputation(null)
      return
    }

    const controller = new AbortController()
    fetch(`/api/public/restaurants/${restaurantId}/restaurant-reputation`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { reputation: null })
      .then((payload) => {
        if (!controller.signal.aborted) {
          const reputation = payload?.reputation
          setRestaurantReputation(
            reputation && Number(reputation.reviewCount) > 0
              ? {
                  averageRating: typeof reputation.averageRating === "number" ? reputation.averageRating : null,
                  bayesianRating: typeof reputation.bayesianRating === "number" ? reputation.bayesianRating : null,
                  reviewCount: Number(reputation.reviewCount),
                }
              : null
          )
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setRestaurantReputation(null)
      })

    return () => controller.abort()
  }, [restaurantId])

  React.useEffect(() => {
    if (!restaurantId) {
      setDishReviewSummaries({})
      return
    }

    const controller = new AbortController()
    fetch(`/api/public/restaurants/${restaurantId}/dish-review-summaries`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { summaries: {} })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setDishReviewSummaries(payload?.summaries && typeof payload.summaries === "object" ? payload.summaries : {})
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setDishReviewSummaries({})
      })

    return () => controller.abort()
  }, [restaurantId])

  const marketplaceIntentActive = navigationSource === MARKETPLACE_NAVIGATION_SOURCE && Boolean(marketplaceProductId)
  const marketplaceCategoryIntentActive = navigationSource === MARKETPLACE_NAVIGATION_SOURCE && Boolean(marketplaceCategoryId)
  const listedMarketplaceProduct = React.useMemo(
    () => marketplaceIntentActive ? (products || []).find((product: any) => product.id === marketplaceProductId) ?? null : null,
    [marketplaceIntentActive, marketplaceProductId, products]
  )
  const targetedProductRef = useMemoFirebase(() => {
    if (!db || !restaurantId || !restaurantAcceptsMarketplaceIntent || !marketplaceIntentActive || !marketplaceProductId || products === null || listedMarketplaceProduct) return null
    return doc(db, "restaurants", restaurantId, "products", marketplaceProductId)
  }, [db, listedMarketplaceProduct, marketplaceIntentActive, marketplaceProductId, products, restaurantAcceptsMarketplaceIntent, restaurantId])
  const {
    data: targetedMarketplaceProduct,
    isLoading: isTargetedProductLoading,
    error: targetedProductError,
  } = useDocOnce<any>(targetedProductRef, PUBLIC_MENU_CACHE_TTL_MS)

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
    (cartRestaurantId !== restaurantId ||
      isProductsLoading ||
      isCategoriesLoading ||
      products === null ||
      categoriesData === null)

  const optimizedCategories = React.useMemo(() => {
    return sortMenuCategories((categoriesData || [])
      .filter((category: any) => category.isActive !== false)
      .map((category: any) => ({
        ...category,
        imageUrl: getOptimizedImage(category.imageUrl || "", 300),
      })))
  }, [categoriesData])

  const resolvedMarketplaceProduct = React.useMemo(() => {
    const resolution = resolveMarketplaceProduct({ productId: marketplaceProductId ?? "", loadedProducts: products || [], targetedProduct: targetedMarketplaceProduct })
    if (resolution.status !== "found") return null
    const product = resolution.product
    const category = optimizedCategories.find((item: any) => item.id === product.categoryId)
    return {
      ...product,
      imageUrl: getOptimizedImage(product.imageUrl || category?.imageUrl || "", 300),
      categoryName: category?.name || "",
    }
  }, [marketplaceProductId, optimizedCategories, products, targetedMarketplaceProduct])

  const catalogProducts = React.useMemo(() => {
    const current = products || []
    if (!resolvedMarketplaceProduct || current.some((product: any) => product.id === resolvedMarketplaceProduct.id)) return current
    return [...current, resolvedMarketplaceProduct]
  }, [products, resolvedMarketplaceProduct])

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

  const openCart = React.useCallback(() => {
    cartTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCartOpen(true)
  }, [])

  const closeCart = React.useCallback(() => {
    setCartOpen(false)
    window.requestAnimationFrame(() => cartTriggerRef.current?.focus({ preventScroll: true }))
  }, [])

  const handleOrderClick = () => {
    setActiveNav("order")
    openCart()
  }

  const handleSearchClick = () => {
    setActiveNav("search")
    if (activeNav === "search") searchInputRef.current?.focus({ preventScroll: true })
  }

  const clearSearchAndFocus = React.useCallback(() => {
    setHomeSearch("")
    searchInputRef.current?.focus({ preventScroll: true })
  }, [])

  React.useEffect(() => {
    const becameActive = activeNav === "search" && previousActiveNavRef.current !== "search"
    previousActiveNavRef.current = activeNav
    if (!becameActive) return

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeNav])

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

    openCart()
  }

  const handleCategorySelect = React.useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId)
  }, [])

  const handleOpenProduct = (product: any) => {
    productTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedProduct(product)
  }

  const marketplaceIntentLookupComplete = marketplaceIntentActive && products !== null && !isProductsLoading && !isTargetedProductLoading
  const marketplaceIntentUnavailable = marketplaceIntentLookupComplete && (
    !restaurantAcceptsMarketplaceIntent || Boolean(targetedProductError) || !resolvedMarketplaceProduct
  )

  React.useEffect(() => {
    if (!marketplaceIntentActive || !marketplaceProductId || !marketplaceIntentLookupComplete || coverState !== "hidden") return
    const intentKey = buildMarketplaceIntentKey(slug, marketplaceProductId)
    if (!claimMarketplaceIntent(handledMarketplaceIntentsRef.current, intentKey)) return
    if (!restaurantAcceptsMarketplaceIntent || !resolvedMarketplaceProduct) return
    if (resolvedMarketplaceProduct.categoryId && optimizedCategories.some((category: any) => category.id === resolvedMarketplaceProduct.categoryId)) {
      setActiveCategoryId(resolvedMarketplaceProduct.categoryId)
    }
    productTriggerRef.current = menuStartRef.current
    setSelectedProduct(resolvedMarketplaceProduct)
  }, [coverState, marketplaceIntentActive, marketplaceIntentLookupComplete, marketplaceProductId, optimizedCategories, resolvedMarketplaceProduct, restaurantAcceptsMarketplaceIntent, slug])

  React.useEffect(() => {
    if (!marketplaceCategoryIntentActive || !marketplaceCategoryId || coverState !== "hidden") return
    if (!optimizedCategories.some((category: any) => category.id === marketplaceCategoryId)) return
    setActiveCategoryId(marketplaceCategoryId)
  }, [coverState, marketplaceCategoryId, marketplaceCategoryIntentActive, optimizedCategories])

  const closeProduct = React.useCallback(() => {
    setSelectedProduct(null)
    window.requestAnimationFrame(() => productTriggerRef.current?.focus({ preventScroll: true }))
  }, [])

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

    if (coverTransitionTimeoutRef.current !== null) {
      window.clearTimeout(coverTransitionTimeoutRef.current)
    }
    coverTransitionTimeoutRef.current = window.setTimeout(() => {
      setCoverState("hidden")
      menuStartRef.current?.focus({ preventScroll: true })
      coverTransitionTimeoutRef.current = null
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
    closeProduct()
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
  const normalizedSearch = homeSearch.trim()
  const activeVisibleCategory = visibleCategories.find((category: any) => category.id === activeCategoryId)
  const searchResultCount = activeVisibleCategory
    ? (productsByCategory[activeVisibleCategory.id] || []).length
    : 0

  return (
    <div id="app-root" className="public-menu-page min-h-screen">
      <PublicHeader
        aria-hidden={coverIsMounted ? true : undefined}
        inert={coverIsMounted ? true : undefined}
        variant="menu"
        restaurantName={restaurant.name || "Restaurant"}
        logoUrl={restaurant.logoUrl || restaurant.logo ? getOptimizedImage(restaurant.logoUrl || restaurant.logo, 120) : null}
        themeAction={<ThemeToggle />}
        cartCount={count}
        onCartClick={openCart}
      />

      <div
        id="main-content"
        ref={menuStartRef}
        tabIndex={-1}
        aria-hidden={coverIsMounted ? true : undefined}
        inert={coverIsMounted ? true : undefined}
        className={`public-menu-content public-cover-transition outline-none transition-[opacity,transform,filter] motion-reduce:translate-y-0 motion-reduce:blur-0 ${
          menuIsOpening
            ? "translate-y-0 opacity-100 blur-0"
            : menuIsCovered
            ? "translate-y-8 opacity-80 blur-[2px]"
            : "translate-y-0 opacity-100 blur-0"
        }`}
      >
        {!coverIsMounted ? <h1 className="sr-only">{restaurant.name || "Restaurant"} — Menu</h1> : null}
        <PublicPageShell
          background="transparent"
          width="catalog"
          bottomReserve="navigation"
          innerContainer
          withGutters={false}
          className="pt-[calc(var(--public-shell-header-height)+var(--public-shell-safe-top)+var(--space-2))] sm:pt-[calc(var(--public-shell-header-height)+var(--public-shell-safe-top)+var(--space-3))]"
        >
          {marketplaceIntentUnavailable ? (
            <MarketplaceProductIntentNotice
              onViewMenu={() => {
                setActiveNav("home")
                categoriesSectionRef.current?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
              }}
              onReturn={() => router.push("/")}
            />
          ) : null}
          {activeNav === "search" && (
            <section className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8" aria-label="Recherche dans le menu">
              <div className="max-w-[var(--public-max-list)]">
                <PublicSearchField
                  value={homeSearch}
                  onChange={setHomeSearch}
                  onClear={clearSearchAndFocus}
                  inputRef={searchInputRef}
                  autoFocus
                  loading={isMenuLoading}
                  resultCount={normalizedSearch && !isMenuLoading && !productsError && !categoriesError ? searchResultCount : undefined}
                />
              </div>
            </section>
          )}
          <MainContent
            categories={visibleCategories}
            isLoading={isMenuLoading}
            hasError={Boolean(productsError || categoriesError)}
            productsByCategory={productsByCategory}
            dishReviewSummaries={dishReviewSummaries}
            tableError={tableSessionError}
            activeCategoryId={activeCategoryId}
            categoriesSectionRef={categoriesSectionRef}
            onCategorySelect={handleCategorySelect}
            onOpenProduct={handleOpenProduct}
            onAddedToCart={scrollToCategoriesSection}
            searchQuery={activeNav === "search" ? homeSearch : ""}
            onClearSearch={clearSearchAndFocus}
            searchInputRef={searchInputRef}
          />
        </PublicPageShell>

      </div>

      <PublicBottomNavigation
        aria-hidden={coverIsMounted ? true : undefined}
        inert={coverIsMounted ? true : undefined}
        variant="menu"
        activeId={activeNav}
        items={[
          { id: "home", label: "Menu", icon: <Utensils />, onSelect: handleHomeClick },
          { id: "search", label: "Recherche", icon: <Search />, onSelect: handleSearchClick },
          {
            id: "order",
            label: "Panier",
            icon: <ShoppingBag />,
            onSelect: handleOrderClick,
            badge: count,
            ariaLabel: count > 0 ? `Panier, ${count} article${count > 1 ? "s" : ""}` : "Panier",
          },
          { id: "tracking", label: "Suivi", icon: <ClipboardList />, onSelect: handleTrackingClick },
        ]}
      />

      <CartDrawer
        open={cartOpen}
        onClose={closeCart}
        restaurantId={restaurantId}
        tableContext={tableContext}
        activeOrderId={isDineInContinuation ? orderId : null}
      />

      {selectedProduct && productNeedsConfigurator(selectedProduct) ? (
        <PublicProductConfigurator
          product={selectedProduct}
          catalogProducts={catalogProducts}
          onClose={closeProduct}
          onAdded={() => {
            closeProduct()
            scrollToCategoriesSection()
          }}
        />
      ) : null}

      {selectedProduct && !productNeedsConfigurator(selectedProduct) ? (
        <ProductModal
          product={selectedProduct}
          onAddToCart={handleAddToCartGlobal}
          onClose={closeProduct}
        />
      ) : null}

      {coverIsMounted ? (
        <CoverPage
          restaurant={restaurant}
          reputation={restaurantReputation}
          isExiting={coverState === "exiting"}
          onEnterMenu={handleEnterMenu}
        />
      ) : null}
    </div>
  )
}

export default function PublicPage({
  slug,
  tableId,
  sessionId,
  mode,
  orderId,
  marketplaceProductId,
  marketplaceCategoryId,
  navigationSource,
}: {
  slug: string
  tableId?: string | null
  sessionId?: string | null
  mode?: string | null
  orderId?: string | null
  marketplaceProductId?: string | null
  marketplaceCategoryId?: string | null
  navigationSource?: string | null
}) {
  return (
    <PublicPageContent
      slug={slug}
      tableId={tableId}
      sessionId={sessionId}
      mode={mode}
      orderId={orderId}
      marketplaceProductId={marketplaceProductId}
      marketplaceCategoryId={marketplaceCategoryId}
      navigationSource={navigationSource}
    />
  )
}

function MarketplaceProductIntentNotice({ onReturn, onViewMenu }: { onReturn: () => void; onViewMenu: () => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6 lg:px-8">
      <div role="alert" className="rounded-[var(--radius-public-xl)] border border-[var(--border-public-default)] bg-[var(--surface-public-card)] p-4 shadow-[var(--shadow-public-xs)]">
        <h2 className="text-public-heading-3 font-public-bold text-[var(--text-primary)]">Ce plat n’est plus disponible</h2>
        <p className="mt-1 text-public-sm text-[var(--text-secondary)]">Le menu reste accessible avec les produits actuellement proposés par ce restaurant.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PublicButton variant="primary" size="compact" onClick={onViewMenu}>Voir le menu</PublicButton>
          <PublicButton variant="outline" size="compact" onClick={onReturn}>Retour à la Marketplace</PublicButton>
        </div>
      </div>
    </div>
  )
}

function MainContent({
  categories,
  isLoading,
  hasError,
  productsByCategory,
  dishReviewSummaries,
  tableError,
  activeCategoryId,
  categoriesSectionRef,
  onCategorySelect,
  onOpenProduct,
  onAddedToCart,
  searchQuery,
  onClearSearch,
  searchInputRef,
}: any) {
  // AUTO-SÉLECTION DE LA PREMIÈRE CATÉGORIE
  React.useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      onCategorySelect(categories[0].id)
    }
  }, [categories, activeCategoryId, onCategorySelect])

  if (hasError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8">
        <PublicEmptyState
          variant="error"
          title="Menu indisponible"
          description="Impossible de charger les produits pour le moment."
          icon={<ChefHat />}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-6 sm:pb-8">
        <div className="pt-3 sm:pt-4">
          <div className="mb-2 px-4 sm:px-6 lg:px-8">
            <div className="h-7 w-32 animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
          </div>
          <div className="no-scrollbar flex gap-2 overflow-hidden px-4 py-1 sm:gap-3 sm:px-6 lg:px-8">
            {Array.from({ length: 5 }).map((_, index) => (
              <PublicCategoryCardSkeleton key={index} />
            ))}
          </div>
        </div>

        <div className="px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
          <div className="mb-2 h-6 w-40 animate-pulse rounded-[var(--radius-public-sm)] bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
          <div className="grid w-full grid-cols-1 items-start gap-3 md:grid-cols-2 md:gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <PublicProductCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const currentCategory = categories.find((category: any) => category.id === activeCategoryId) ?? null
  const currentProducts = currentCategory ? productsByCategory[currentCategory.id] || [] : []
  const hasSearchQuery = Boolean(searchQuery.trim())
  const hasNoSearchResults = hasSearchQuery && (!currentCategory || currentProducts.length === 0)

  const clearEmptySearch = () => {
    onClearSearch()
    searchInputRef.current?.focus({ preventScroll: true })
  }

  const handleCategorySelect = (categoryId: string) => {
    onCategorySelect(categoryId)
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      
      <TableContextError error={tableError} />

      {/* CATÉGORIES BAR */}
      <div ref={categoriesSectionRef} className="mb-1 scroll-mt-24 pt-3 sm:pt-4">
        <CategoriesBar
          categories={categories}
          activeId={activeCategoryId}
          onSelect={handleCategorySelect}
        />
      </div>

      {/* PRODUITS (UNE SEULE CATÉGORIE) */}
      {hasNoSearchResults ? (
        <div className="px-4 pb-4 sm:px-6 lg:px-8">
          <PublicEmptyState
            title="Aucun produit trouvé"
            description="Essayez un autre terme ou effacez la recherche pour afficher le menu."
            variant="compact"
            primaryAction={<PublicButton variant="secondary" size="compact" onClick={clearEmptySearch}>Effacer la recherche</PublicButton>}
          />
        </div>
      ) : categories.length === 0 ? (
        <div className="px-4 pb-4 sm:px-6 lg:px-8">
          <PublicEmptyState
            title="Aucune catégorie disponible"
            description="Le menu ne contient aucune catégorie disponible pour le moment."
            icon={<Utensils />}
          />
        </div>
      ) : currentCategory ? (
        <div className="mb-4 px-4 sm:px-6 lg:px-8">
          <div className="mb-2">
            <SectionHeader
              title={currentCategory.name}
              icon={<Utensils />}
              variant="default"
              size="sm"
              headingAs="h2"
            />
          </div>

          <div className="grid w-full grid-cols-1 items-start gap-3 md:grid-cols-2 md:gap-4">
            {currentProducts.map((product: any) => (
              <DishCard
                key={product.id}
                product={product}
                ratingSummary={product.reviewsEnabled === true ? dishReviewSummaries[product.id] : null}
                onOpenDetails={() => onOpenProduct(product)}
                onAddedToCart={onAddedToCart}
              />
            ))}
          </div>

          {currentProducts.length === 0 && (
            <PublicEmptyState
              title="Aucun produit dans cette catégorie"
              description="Cette catégorie ne contient aucun produit disponible pour le moment."
              icon={<ChefHat />}
            />
          )}
        </div>
      ) : (
        <div className="px-4 pb-4 sm:px-6 lg:px-8">
          <PublicEmptyState
            title="Aucun produit disponible"
            description="Le menu ne contient aucun produit disponible pour le moment."
            icon={<ChefHat />}
          />
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

function CategoriesSkeleton() {
  return (
    <div className="no-scrollbar flex gap-2 overflow-hidden sm:gap-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <PublicCategoryCardSkeleton key={index} />
      ))}
    </div>
  )
}

function PublicLoadingSkeleton() {
  return (
    <div className="public-menu-page min-h-screen text-[var(--public-text-main)]">
      <div className="public-menu-content">
      <div className="relative flex h-[140px] items-end bg-muted p-4">
        <div className="absolute inset-0 animate-pulse bg-muted motion-reduce:animate-none" />
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
        <div className="mb-5 h-12 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
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
