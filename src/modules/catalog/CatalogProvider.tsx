"use client"

import * as React from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"

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

    const safeRestaurantId = restaurantId
    const safeCacheKey = cacheKey
    const cached = catalogCache[safeCacheKey]
    if (!cached) setLoading(true)
    let productsReady = false
    let categoriesReady = false
    let nextProducts = cached?.products ?? []
    let nextCategories = cached?.categories ?? []
    const publish = () => {
      catalogCache[safeCacheKey] = { products: nextProducts, categories: nextCategories }
      setProducts(nextProducts)
      setCategories(nextCategories)
      if (productsReady && categoriesReady) setLoading(false)
    }

    const productsQuery = query(
        collection(
          db,
          COLLECTION_NAMES.RESTAURANTS,
          safeRestaurantId,
          COLLECTION_NAMES.PRODUCTS
        ),
        where("isActive", "==", true)
      )
    const categoriesQuery = query(
        collection(
          db,
          COLLECTION_NAMES.RESTAURANTS,
          safeRestaurantId,
          "categories"
        )
      )

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      productsReady = true
      nextProducts = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))
      publish()
    }, (error) => {
      console.error("Catalog products listener error:", error)
      productsReady = true
      publish()
    })
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      categoriesReady = true
      nextCategories = sortMenuCategories(snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
          .filter((category: any) => category.isActive !== false))
      publish()
    }, (error) => {
      console.error("Catalog categories listener error:", error)
      categoriesReady = true
      publish()
    })

    return () => {
      unsubscribeProducts()
      unsubscribeCategories()
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
