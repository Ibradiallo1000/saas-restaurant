"use client"

import * as React from "react"
import { collection } from "firebase/firestore"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useInventoryReferential } from "./shared/use-inventory-referential"
import { buildPosStockAvailabilityMap } from "./pos-stock-availability"

export function usePosStockAvailability(
  restaurantId: string | null | undefined,
  products: readonly { id: string; stockArticleId?: string | null }[]
) {
  const db = useFirestore()
  const validRestaurantId = restaurantId?.trim() || ""
  const inventory = useInventoryReferential(validRestaurantId)
  const associationsQuery = useMemoFirebase(
    () =>
      db && validRestaurantId
        ? collection(
            db,
            "restaurants",
            validRestaurantId,
            "stockAutomaticAssociationsV2"
          )
        : null,
    [db, validRestaurantId]
  )
  const associationResult = useCollection<{
    productId?: string
    articleId?: string
    status?: string
  }>(associationsQuery)

  const availabilityByProduct = React.useMemo(
    () =>
      buildPosStockAvailabilityMap({
        products,
        associations: associationResult.data || [],
        articles: inventory.articles,
        balances: inventory.balances,
      }),
    [associationResult.data, inventory.articles, inventory.balances, products]
  )

  return {
    availabilityByProduct,
    isLoading: inventory.isLoading || associationResult.isLoading,
    error: inventory.error || associationResult.error,
  }
}
