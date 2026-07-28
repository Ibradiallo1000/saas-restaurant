import type { Firestore } from "firebase/firestore"
import { collection, getDocs } from "firebase/firestore"

export const STOCK_V2_COLLECTIONS = {
  articles: "stockItemsV2",
  balances: "stockBalancesV2",
  costs: "stockItemCostsV2",
  operations: "stockOperationsV2",
} as const

export type InventoryArticleV2 = {
  id: string
  restaurantId: string
  name: string
  baseUnit?: string
  trackingMode: "CONTROLLED" | "AUTOMATIC_SIMPLE" | "NONE"
  status: "active" | "archived"
  lowStockThreshold?: number
  outOfStockThreshold?: number
  [key: string]: unknown
}

export type InventoryBalanceV2 = {
  id: string
  articleId?: string
  restaurantId?: string
  quantity?: number
  [key: string]: unknown
}

export type InventoryCostV2 = {
  id: string
  articleId?: string
  referenceCost?: number
  [key: string]: unknown
}

export type InventoryOperationV2 = {
  id: string
  articleId: string
  type?: string
  variation?: number
  unit?: string
  occurredAt?: any
  [key: string]: unknown
}

export function assertInventoryRestaurantId(restaurantId: string | null | undefined): asserts restaurantId is string {
  if (!restaurantId?.trim()) {
    throw new Error("restaurantId est requis pour charger le référentiel Articles V2.")
  }
}

export function inventoryReferentialCollection(
  db: Firestore,
  restaurantId: string,
  collectionName: (typeof STOCK_V2_COLLECTIONS)[keyof typeof STOCK_V2_COLLECTIONS]
) {
  assertInventoryRestaurantId(restaurantId)
  return collection(db, "restaurants", restaurantId, collectionName)
}

export function normalizeInventoryArticle(
  id: string,
  data: Record<string, unknown>
): InventoryArticleV2 {
  return {
    ...data,
    id,
    restaurantId: String(data.restaurantId ?? ""),
    name: String(data.name ?? ""),
    baseUnit: data.baseUnit ? String(data.baseUnit) : undefined,
    trackingMode:
      data.trackingMode === "AUTOMATIC_SIMPLE" || data.trackingMode === "NONE"
        ? data.trackingMode
        : "CONTROLLED",
    status: data.status === "archived" ? "archived" : "active",
  }
}

export function activeInventoryArticles(articles: readonly InventoryArticleV2[]) {
  return articles.filter((article) => article.status === "active")
}

export function supplyEligibleInventoryArticles(articles: readonly InventoryArticleV2[]) {
  return activeInventoryArticles(articles).filter(
    (article) => article.trackingMode !== "NONE"
  )
}

export function automaticInventoryArticles(articles: readonly InventoryArticleV2[]) {
  return activeInventoryArticles(articles).filter(
    (article) => article.trackingMode === "AUTOMATIC_SIMPLE"
  )
}

export function prioritizeSupplierArticles<T extends { id: string }>(
  articles: readonly T[],
  supplierArticleIds: readonly string[] = []
) {
  const preferredIds = new Set(supplierArticleIds)
  return [
    ...articles.filter((article) => preferredIds.has(article.id)),
    ...articles.filter((article) => !preferredIds.has(article.id)),
  ]
}

export async function listInventoryArticlesForRestaurant(
  db: Firestore,
  restaurantId: string
) {
  const snapshot = await getDocs(
    inventoryReferentialCollection(db, restaurantId, STOCK_V2_COLLECTIONS.articles)
  )
  return snapshot.docs.map((entry) =>
    normalizeInventoryArticle(entry.id, entry.data())
  )
}

export function stockTrackingModeLabel(mode: InventoryArticleV2["trackingMode"]) {
  if (mode === "AUTOMATIC_SIMPLE") return "Automatique"
  if (mode === "CONTROLLED") return "Contrôle manuel"
  return "Non suivi"
}

export function stockUnitLabel(unit: string | undefined, quantity?: number) {
  if (unit === "unit") return quantity === 1 ? "pièce" : "pièces"
  if (unit === "piece") return quantity === 1 ? "pièce" : "pièces"
  if (unit === "bottle" || unit === "bouteille") {
    return quantity === 1 ? "bouteille" : "bouteilles"
  }
  if (unit === "kg") return "kg"
  if (unit === "g") return "g"
  if (unit === "l") return quantity === 1 ? "litre" : "litres"
  if (unit === "ml") return "ml"
  return "unité"
}
