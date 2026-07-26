"use client"

import * as React from "react"
import { collection, getDocs, limit, query, where } from "firebase/firestore"

import { useFirestore } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import { sortMenuCategories } from "@/lib/menu-category-order"

type CatalogCacheEntry = {
  products: any[]
  categories: any[]
}

type CatalogContextType = CatalogCacheEntry & {
  loading: boolean
  isLoadingVisible: boolean
  refreshCatalog: () => void
}

const catalogCache: Record<string, CatalogCacheEntry> = {}

const CatalogContext = React.createContext<CatalogContextType>({
  products: [],
  categories: [],
  loading: false,
  isLoadingVisible: false,
  refreshCatalog: () => {},
})

export function CatalogProvider({
  children,
  restaurantId,
}: {
  children: React.ReactNode
  restaurantId?: string | null
}) {
  const db = useFirestore()
  const cacheKey = restaurantId ? `catalog_${restaurantId}` : null
  const cachedCatalog = cacheKey ? catalogCache[cacheKey] : null
  const [products, setProducts] = React.useState<any[]>(cachedCatalog?.products ?? [])
  const [categories, setCategories] = React.useState<any[]>(cachedCatalog?.categories ?? [])
  const [loading, setLoading] = React.useState(Boolean(restaurantId && !cachedCatalog))
  const [version, setVersion] = React.useState(0)
  const isLoadingVisible = loading && products.length === 0 && categories.length === 0

  const refreshCatalog = React.useCallback(() => {
    if (cacheKey) {
      delete catalogCache[cacheKey]
    }
    setVersion((current) => current + 1)
  }, [cacheKey])

  React.useEffect(() => {
    if (!db || !restaurantId || !cacheKey) {
      setProducts([])
      setCategories([])
      setLoading(false)
      return
    }

    const cached = catalogCache[cacheKey]
    if (cached) {
      setProducts(cached.products)
      setCategories(cached.categories)
      setLoading(false)
      return
    }

    let cancelled = false
    const safeRestaurantId = restaurantId
    const safeCacheKey = cacheKey
    setLoading(true)

    async function loadCatalog() {
      const productsQuery = query(
        collection(
          db,
          COLLECTION_NAMES.RESTAURANTS,
          safeRestaurantId,
          COLLECTION_NAMES.PRODUCTS
        ),
        where("isActive", "==", true),
        limit(50)
      )
      const categoriesQuery = query(
        collection(
          db,
          COLLECTION_NAMES.RESTAURANTS,
          safeRestaurantId,
          "categories"
        ),
        limit(50)
      )

      const [productsSnapshot, categoriesSnapshot] = await Promise.all([
        getDocs(productsQuery),
        getDocs(categoriesQuery),
      ])

      const nextCatalog = {
        products: productsSnapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })),
        categories: sortMenuCategories(categoriesSnapshot.docs
          .map((document) => ({
            id: document.id,
            ...document.data(),
          }))
          .filter((category: any) => category.isActive !== false)),
      }

      catalogCache[safeCacheKey] = nextCatalog

      if (!cancelled) {
        setProducts(nextCatalog.products)
        setCategories(nextCatalog.categories)
        setLoading(false)
      }
    }

    loadCatalog().catch((error) => {
      console.error("Catalog load error:", error)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [cacheKey, db, restaurantId, version])

  const value = React.useMemo(
    () => ({
      products,
      categories,
      loading,
      isLoadingVisible,
      refreshCatalog,
    }),
    [products, categories, loading, isLoadingVisible, refreshCatalog]
  )

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog() {
  return React.useContext(CatalogContext)
}
