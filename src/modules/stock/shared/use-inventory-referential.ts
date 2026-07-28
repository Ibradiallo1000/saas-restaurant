"use client"

import * as React from "react"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"

import {
  STOCK_V2_COLLECTIONS,
  activeInventoryArticles,
  automaticInventoryArticles,
  inventoryReferentialCollection,
  normalizeInventoryArticle,
  supplyEligibleInventoryArticles,
  type InventoryBalanceV2,
  type InventoryCostV2,
  type InventoryOperationV2,
} from "./inventory-referential"

type Options = {
  includeCosts?: boolean
  includeOperations?: boolean
}

export function useInventoryReferential(
  restaurantId: string | null | undefined,
  options: Options = {}
) {
  const db = useFirestore()
  const validRestaurantId = restaurantId?.trim() || ""
  const articlesQuery = useMemoFirebase(
    () =>
      db && validRestaurantId
        ? inventoryReferentialCollection(db, validRestaurantId, STOCK_V2_COLLECTIONS.articles)
        : null,
    [db, validRestaurantId]
  )
  const balancesQuery = useMemoFirebase(
    () =>
      db && validRestaurantId
        ? inventoryReferentialCollection(db, validRestaurantId, STOCK_V2_COLLECTIONS.balances)
        : null,
    [db, validRestaurantId]
  )
  const costsQuery = useMemoFirebase(
    () =>
      db && validRestaurantId && options.includeCosts
        ? inventoryReferentialCollection(db, validRestaurantId, STOCK_V2_COLLECTIONS.costs)
        : null,
    [db, validRestaurantId, options.includeCosts]
  )
  const operationsQuery = useMemoFirebase(
    () =>
      db && validRestaurantId && options.includeOperations
        ? inventoryReferentialCollection(db, validRestaurantId, STOCK_V2_COLLECTIONS.operations)
        : null,
    [db, validRestaurantId, options.includeOperations]
  )

  const articleResult = useCollection<Record<string, unknown>>(articlesQuery)
  const balanceResult = useCollection<InventoryBalanceV2>(balancesQuery)
  const costResult = useCollection<InventoryCostV2>(costsQuery)
  const operationResult = useCollection<InventoryOperationV2>(operationsQuery)

  const articles = React.useMemo(
    () =>
      (articleResult.data || []).map((article) =>
        normalizeInventoryArticle(article.id, article)
      ),
    [articleResult.data]
  )
  const balances = balanceResult.data || []
  const balanceByArticle = React.useMemo(
    () =>
      new Map(
        balances.map((balance) => [
          balance.articleId || balance.id,
          Number(balance.quantity || 0),
        ])
      ),
    [balances]
  )

  return {
    articles,
    activeArticles: React.useMemo(() => activeInventoryArticles(articles), [articles]),
    automaticArticles: React.useMemo(() => automaticInventoryArticles(articles), [articles]),
    supplyArticles: React.useMemo(() => supplyEligibleInventoryArticles(articles), [articles]),
    balances,
    balanceByArticle,
    costs: costResult.data || [],
    operations: operationResult.data || [],
    isLoading:
      articleResult.isLoading ||
      balanceResult.isLoading ||
      (options.includeCosts ? costResult.isLoading : false) ||
      (options.includeOperations ? operationResult.isLoading : false),
    error:
      articleResult.error ||
      balanceResult.error ||
      (options.includeCosts ? costResult.error : null) ||
      (options.includeOperations ? operationResult.error : null),
  }
}
