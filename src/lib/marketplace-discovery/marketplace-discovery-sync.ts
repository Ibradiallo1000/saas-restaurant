import { FieldPath, type DocumentSnapshot, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore"

import { buildMarketplaceOfferId, buildMarketplaceRestaurantCategoryOfferId, projectMarketplaceDishOffer, projectMarketplaceRestaurantCategoryOffer } from "./marketplace-discovery-core"
import {
  MARKETPLACE_DISH_OFFERS_COLLECTION,
  MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION,
  type MarketplaceCategorySource,
  type MarketplaceDishOfferDocument,
  type MarketplaceProductSource,
  type MarketplaceRestaurantCategoryOfferDocument,
  type MarketplaceRestaurantSource,
} from "./marketplace-discovery-types"

export interface MarketplaceSyncResult { offerId: string; outcome: "created-or-updated" | "disabled" | "deleted"; reason?: string }
export interface MarketplaceBatchSyncSummary { createdOrUpdated: number; disabled: number; deleted: number; skipped: number; errors: number }

export async function syncMarketplaceDishOffer(input: {
  db: Firestore
  restaurant: MarketplaceRestaurantSource
  product: MarketplaceProductSource
  category?: MarketplaceCategorySource | null
  now?: Date
}): Promise<MarketplaceSyncResult> {
  const offerId = buildMarketplaceOfferId(input.restaurant.id, input.product.id)
  const projection = projectMarketplaceDishOffer({ restaurant: input.restaurant, product: input.product, category: input.category, projectedAt: (input.now ?? new Date()).toISOString() })
  await input.db.collection(MARKETPLACE_DISH_OFFERS_COLLECTION).doc(offerId).set(projection, { merge: false })
  return { offerId, outcome: projection.discoverable ? "created-or-updated" : "disabled" }
}

export async function syncMarketplaceProductById(input: {
  db: Firestore
  restaurantId: string
  productId: string
  now?: Date
}): Promise<MarketplaceSyncResult> {
  const restaurantSnapshot = await input.db.collection("restaurants").doc(input.restaurantId).get()
  if (!restaurantSnapshot.exists) {
    return deleteMarketplaceDishOffer(input.db, input.restaurantId, input.productId)
  }

  const productSnapshot = await restaurantSnapshot.ref.collection("products").doc(input.productId).get()
  if (!productSnapshot.exists) {
    return deleteMarketplaceDishOffer(input.db, input.restaurantId, input.productId)
  }

  const restaurant = documentSource<MarketplaceRestaurantSource>(restaurantSnapshot)
  const product = documentSource<MarketplaceProductSource>(productSnapshot)
  const categoryId = typeof product.categoryId === "string" ? product.categoryId : null
  const categorySnapshot = categoryId ? await restaurantSnapshot.ref.collection("categories").doc(categoryId).get() : null
  const category = categorySnapshot?.exists ? documentSource<MarketplaceCategorySource>(categorySnapshot) : null
  return syncMarketplaceDishOffer({ db: input.db, restaurant, product, category, now: input.now })
}

export async function syncMarketplaceCategoryProducts(input: {
  db: Firestore
  restaurantId: string
  categoryId: string
  now?: Date
  batchSize?: number
}): Promise<MarketplaceBatchSyncSummary> {
  const summary = emptySummary()
  const restaurantSnapshot = await input.db.collection("restaurants").doc(input.restaurantId).get()
  if (!restaurantSnapshot.exists) return summary

  let cursor: QueryDocumentSnapshot | null = null
  while (true) {
    let productsQuery = restaurantSnapshot.ref
      .collection("products")
      .where("categoryId", "==", input.categoryId)
      .orderBy(FieldPath.documentId())
      .limit(normalizeBatchSize(input.batchSize))
    if (cursor) productsQuery = productsQuery.startAfter(cursor)
    const products = await productsQuery.get()
    if (products.empty) break
    cursor = products.docs.at(-1) ?? null
    for (const productSnapshot of products.docs) {
      try {
        addResult(summary, await syncMarketplaceProductById({ db: input.db, restaurantId: input.restaurantId, productId: productSnapshot.id, now: input.now }))
      } catch (error) {
        summary.errors += 1
        console.error(JSON.stringify({ event: "marketplace_category_product_sync_error", restaurantId: input.restaurantId, categoryId: input.categoryId, productId: productSnapshot.id, error: normalizeError(error) }))
      }
    }
    if (products.size < normalizeBatchSize(input.batchSize)) break
  }

  return summary
}

export async function syncMarketplaceRestaurantProducts(input: {
  db: Firestore
  restaurantId: string
  now?: Date
  batchSize?: number
}): Promise<MarketplaceBatchSyncSummary> {
  const summary = emptySummary()
  const restaurantSnapshot = await input.db.collection("restaurants").doc(input.restaurantId).get()
  if (!restaurantSnapshot.exists) {
    summary.deleted += await deleteMarketplaceRestaurantOffers(input.db, input.restaurantId, input.batchSize)
    return summary
  }

  const restaurant = documentSource<MarketplaceRestaurantSource>(restaurantSnapshot)
  if (restaurant.status !== "active" || restaurant.isActive === false || restaurant.deletedAt) {
    summary.disabled += await disableMarketplaceRestaurantOffers(input.db, input.restaurantId, input.batchSize)
    return summary
  }

  let cursor: QueryDocumentSnapshot | null = null
  while (true) {
    let productsQuery = restaurantSnapshot.ref.collection("products").orderBy(FieldPath.documentId()).limit(normalizeBatchSize(input.batchSize))
    if (cursor) productsQuery = productsQuery.startAfter(cursor)
    const products = await productsQuery.get()
    if (products.empty) break
    cursor = products.docs.at(-1) ?? null
    for (const productSnapshot of products.docs) {
      try {
        addResult(summary, await syncMarketplaceProductById({ db: input.db, restaurantId: input.restaurantId, productId: productSnapshot.id, now: input.now }))
      } catch (error) {
        summary.errors += 1
        console.error(JSON.stringify({ event: "marketplace_restaurant_product_sync_error", restaurantId: input.restaurantId, productId: productSnapshot.id, error: normalizeError(error) }))
      }
    }
    if (products.size < normalizeBatchSize(input.batchSize)) break
  }

  return summary
}

export async function deleteMarketplaceDishOffer(db: Firestore, restaurantId: string, productId: string): Promise<MarketplaceSyncResult> {
  const offerId = buildMarketplaceOfferId(restaurantId, productId)
  await db.collection(MARKETPLACE_DISH_OFFERS_COLLECTION).doc(offerId).delete()
  return { offerId, outcome: "deleted" }
}

export async function deleteMarketplaceRestaurantOffers(db: Firestore, restaurantId: string, batchSize = 200): Promise<number> {
  const limit = normalizeBatchSize(batchSize)
  let deleted = 0
  while (true) {
    const snapshot = await db.collection(MARKETPLACE_DISH_OFFERS_COLLECTION).where("restaurantId", "==", restaurantId).limit(limit).get()
    if (snapshot.empty) return deleted
    const batch = db.batch()
    snapshot.docs.forEach((document) => batch.delete(document.ref))
    await batch.commit()
    deleted += snapshot.size
  }
}

export async function syncMarketplaceRestaurantCategoryOffers(input: {
  db: Firestore
  restaurantId: string
  now?: Date
  batchSize?: number
}): Promise<MarketplaceBatchSyncSummary> {
  const summary = emptySummary()
  const limit = normalizeBatchSize(input.batchSize)
  const updatedAt = (input.now ?? new Date()).toISOString()
  const discoverableOffers: Array<MarketplaceDishOfferDocument & { id: string }> = []

  let offerCursor: QueryDocumentSnapshot | null = null
  while (true) {
    let offersQuery = input.db
      .collection(MARKETPLACE_DISH_OFFERS_COLLECTION)
      .where("restaurantId", "==", input.restaurantId)
      .where("discoverable", "==", true)
      .orderBy(FieldPath.documentId())
      .limit(limit)
    if (offerCursor) offersQuery = offersQuery.startAfter(offerCursor)
    const offers = await offersQuery.get()
    if (offers.empty) break
    offerCursor = offers.docs.at(-1) ?? null
    discoverableOffers.push(...offers.docs.map((document) => ({ id: document.id, ...(document.data() as MarketplaceDishOfferDocument) })))
    if (offers.size < limit) break
  }

  const desired = new Map<string, MarketplaceRestaurantCategoryOfferDocument>()
  const offersByMarketplaceCategory = new Map<string, Array<MarketplaceDishOfferDocument & { id: string }>>()

  for (const offer of discoverableOffers) {
    if (!offer.marketplaceCategoryId) continue
    const group = offersByMarketplaceCategory.get(offer.marketplaceCategoryId) ?? []
    group.push(offer)
    offersByMarketplaceCategory.set(offer.marketplaceCategoryId, group)
  }

  for (const [marketplaceCategoryId, offers] of offersByMarketplaceCategory.entries()) {
    const id = buildMarketplaceRestaurantCategoryOfferId(input.restaurantId, marketplaceCategoryId)
    desired.set(id, projectMarketplaceRestaurantCategoryOffer({ restaurantId: input.restaurantId, marketplaceCategoryId, offers, updatedAt }))
  }

  const existing = await input.db
    .collection(MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION)
    .where("restaurantId", "==", input.restaurantId)
    .get()
  const batch = input.db.batch()
  let pendingWrites = 0

  for (const [id, projection] of desired.entries()) {
    batch.set(input.db.collection(MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION).doc(id), projection, { merge: false })
    summary.createdOrUpdated += 1
    pendingWrites += 1
  }

  for (const document of existing.docs) {
    if (desired.has(document.id)) continue
    batch.delete(document.ref)
    summary.deleted += 1
    pendingWrites += 1
  }

  if (pendingWrites > 0) await batch.commit()
  else summary.skipped += 1

  return summary
}

export async function deleteMarketplaceRestaurantCategoryOffers(db: Firestore, restaurantId: string, batchSize = 200): Promise<number> {
  const limit = normalizeBatchSize(batchSize)
  let deleted = 0
  while (true) {
    const snapshot = await db.collection(MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION).where("restaurantId", "==", restaurantId).limit(limit).get()
    if (snapshot.empty) return deleted
    const batch = db.batch()
    snapshot.docs.forEach((document) => batch.delete(document.ref))
    await batch.commit()
    deleted += snapshot.size
  }
}

export async function disableMarketplaceRestaurantOffers(db: Firestore, restaurantId: string, batchSize = 200): Promise<number> {
  const limit = Math.max(1, Math.min(batchSize, 400))
  let updated = 0
  while (true) {
    const snapshot = await db.collection(MARKETPLACE_DISH_OFFERS_COLLECTION).where("restaurantId", "==", restaurantId).limit(limit).get()
    if (snapshot.empty) return updated
    const batch = db.batch()
    snapshot.docs.forEach((document) => batch.update(document.ref, { restaurantActive: false, discoverable: false, quality: "unavailable", projectedAt: new Date().toISOString() }))
    await batch.commit()
    updated += snapshot.size
  }
}

function documentSource<T extends { id: string }>(snapshot: QueryDocumentSnapshot | DocumentSnapshot): T {
  return { id: snapshot.id, ...snapshot.data() } as T
}

function emptySummary(): MarketplaceBatchSyncSummary {
  return { createdOrUpdated: 0, disabled: 0, deleted: 0, skipped: 0, errors: 0 }
}

function addResult(summary: MarketplaceBatchSyncSummary, result: MarketplaceSyncResult) {
  if (result.outcome === "created-or-updated") summary.createdOrUpdated += 1
  else if (result.outcome === "disabled") summary.disabled += 1
  else if (result.outcome === "deleted") summary.deleted += 1
}

function normalizeBatchSize(value = 200) {
  return Math.max(1, Math.min(value, 400))
}

function normalizeError(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }
}
