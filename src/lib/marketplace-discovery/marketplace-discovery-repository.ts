import { FieldPath, type Firestore, type Query } from "firebase-admin/firestore"

import {
  MARKETPLACE_DISH_OFFERS_COLLECTION,
  MARKETPLACE_FOOD_CATEGORIES_COLLECTION,
  MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION,
  type MarketplaceDishOfferDocument,
  type MarketplaceDiscoveryPage,
  type MarketplaceDiscoveryQuery,
  type MarketplaceFoodCategoryDocument,
  type MarketplaceRestaurantCategoryOfferDocument,
  type MarketplaceRestaurantCategoryOfferPage,
  type MarketplaceRestaurantCategoryOfferQuery,
} from "./marketplace-discovery-types"
import { decodeMarketplaceCursor, encodeMarketplaceCursor, normalizeMarketplaceSearch } from "./marketplace-discovery-core"

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 30

export class MarketplaceDishRepository {
  constructor(private readonly db: Firestore) {}

  async listOffers(input: MarketplaceDiscoveryQuery = {}): Promise<MarketplaceDiscoveryPage> {
    const pageSize = Math.max(1, Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE))
    const order = input.order ?? "name"
    if (order !== "name" && (input.categoryId || input.restaurantId || input.normalizedPrefix)) {
      throw new Error("Recent and popular queries do not accept additional filters in schema version 1")
    }
    const sortField = order === "recent" ? "createdAt" : order === "popular" ? "orderCount" : "normalizedName"
    const direction = order === "name" ? "asc" : "desc"
    let query: Query = this.db.collection(MARKETPLACE_DISH_OFFERS_COLLECTION).where("discoverable", "==", true)
    if (input.categoryId) query = query.where("marketplaceCategoryId", "==", input.categoryId)
    if (input.restaurantId) query = query.where("restaurantId", "==", input.restaurantId)
    const prefix = normalizeMarketplaceSearch(input.normalizedPrefix)
    if (prefix) {
      query = query.where("normalizedName", ">=", prefix).where("normalizedName", "<=", `${prefix}\uf8ff`)
    }
    query = query.orderBy(sortField, direction).orderBy(FieldPath.documentId(), direction).limit(pageSize + 1)
    if (input.cursor) {
      const cursor = decodeMarketplaceCursor(input.cursor)
      query = query.startAfter(cursor.sortValue, cursor.offerId)
    }
    const snapshot = await query.get()
    const visible = snapshot.docs.slice(0, pageSize)
    const offers = visible.map((document) => ({ id: document.id, ...(document.data() as MarketplaceDishOfferDocument) }))
    const last = visible.at(-1)
    const nextCursor = snapshot.docs.length > pageSize && last
      ? encodeMarketplaceCursor({ sortValue: last.get(sortField) as string | number, offerId: last.id })
      : null
    return { offers, nextCursor }
  }

  async listActiveCategories(limit = 20): Promise<Array<MarketplaceFoodCategoryDocument & { id: string }>> {
    const boundedLimit = Math.max(1, Math.min(limit, 50))
    const snapshot = await this.db.collection(MARKETPLACE_FOOD_CATEGORIES_COLLECTION)
      .where("active", "==", true).orderBy("sortOrder", "asc").orderBy(FieldPath.documentId(), "asc").limit(boundedLimit).get()
    return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as MarketplaceFoodCategoryDocument) }))
  }

  async listRestaurantCategoryOffers(input: MarketplaceRestaurantCategoryOfferQuery): Promise<MarketplaceRestaurantCategoryOfferPage> {
    const pageSize = Math.max(1, Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE))
    try {
      let query = this.db.collection(MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION)
        .where("discoverable", "==", true)
        .where("marketplaceCategoryId", "==", input.categoryId)
        .orderBy("productCount", "desc")
        .orderBy(FieldPath.documentId(), "desc")
        .limit(pageSize + 1)
      if (input.cursor) {
        const cursor = decodeMarketplaceCursor(input.cursor)
        query = query.startAfter(cursor.sortValue, cursor.offerId)
      }
      const snapshot = await query.get()
      const visible = snapshot.docs.slice(0, pageSize)
      const offers = visible.map((document) => ({ id: document.id, ...(document.data() as MarketplaceRestaurantCategoryOfferDocument) }))
      const last = visible.at(-1)
      const nextCursor = snapshot.docs.length > pageSize && last
        ? encodeMarketplaceCursor({ sortValue: Number(last.get("productCount") ?? 0), offerId: last.id })
        : null
      return { offers, nextCursor }
    } catch (error) {
      if (!isMissingIndexError(error)) throw error
    }

    const snapshot = await this.db.collection(MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION)
      .where("discoverable", "==", true)
      .where("marketplaceCategoryId", "==", input.categoryId)
      .limit(pageSize + 1)
      .get()
    const offers = snapshot.docs
      .map((document) => ({ id: document.id, ...(document.data() as MarketplaceRestaurantCategoryOfferDocument) }))
      .sort((a, b) => b.productCount - a.productCount || b.id.localeCompare(a.id))
      .slice(0, pageSize)
    return { offers, nextCursor: null }
  }
}

function isMissingIndexError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === 9
}
