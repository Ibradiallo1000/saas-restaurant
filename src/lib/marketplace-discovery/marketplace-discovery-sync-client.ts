/**
 * @fileoverview Client-side marketplace sync service.
 * Uses firebase/firestore client SDK (compatible with Firebase Spark, no Cloud Functions).
 * Reuses projection logic from marketplace-discovery-core.ts (plain objects, no admin SDK).
 *
 * After save:
 *  1. project & write the dish offer → marketplaceDishOffers
 *  2. rebuild all restaurant category offers → marketplaceRestaurantCategoryOffers
 *  3. delete stale projections for products / categories no longer mapped
 */

import {
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  writeBatch,
  limit,
} from "firebase/firestore";

import { COLLECTION_NAMES } from "@/lib/constants";
import {
  buildMarketplaceOfferId,
  buildMarketplaceRestaurantCategoryOfferId,
  evaluateMarketplaceDishPublishability,
  projectMarketplaceDishOffer,
  projectMarketplaceRestaurantCategoryOffer,
} from "./marketplace-discovery-core";
import type {
  MarketplaceCategorySource,
  MarketplaceDishOfferDocument,
  MarketplaceProductSource,
  MarketplaceRestaurantSource,
} from "./marketplace-discovery-types";

const MARKETPLACE_DISH_OFFERS = "marketplaceDishOffers";
const MARKETPLACE_RESTAURANT_CATEGORY_OFFERS = "marketplaceRestaurantCategoryOffers";

// ────────────────────────────────────────────
//  Utils – snapshot → plain object
// ────────────────────────────────────────────

function snapshotData<T>(snap: { id: string; data(): Record<string, unknown> }): T {
  return { id: snap.id, ...snap.data() } as T;
}

function nullableString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function firstString(value: unknown, ...alternatives: unknown[]): string | null {
  for (const v of [value, ...alternatives]) {
    const s = nullableString(v);
    if (s) return s;
  }
  return null;
}

// ────────────────────────────────────────────
//  Read source data (client-safe reads)
// ────────────────────────────────────────────

async function readRestaurantSource(
  db: Firestore,
  restaurantId: string
): Promise<MarketplaceRestaurantSource | null> {
  const snap = await getDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId));
  if (!snap.exists()) return null;
  return snapshotData<MarketplaceRestaurantSource>(snap);
}

async function readProductSource(
  db: Firestore,
  restaurantId: string,
  productId: string
): Promise<MarketplaceProductSource | null> {
  const snap = await getDoc(
    doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PRODUCTS, productId)
  );
  if (!snap.exists()) return null;
  return snapshotData<MarketplaceProductSource>(snap);
}

async function readCategorySource(
  db: Firestore,
  restaurantId: string,
  categoryId: string | null
): Promise<MarketplaceCategorySource | null> {
  if (!categoryId) return null;
  const snap = await getDoc(
    doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "categories", categoryId)
  );
  if (!snap.exists()) return null;
  return snapshotData<MarketplaceCategorySource>(snap);
}

// ────────────────────────────────────────────
//  1. Synchroniser une offre plat unique
// ────────────────────────────────────────────

export async function syncDishOffer(
  db: Firestore,
  restaurantId: string,
  productId: string
): Promise<{ offerId: string; discoverable: boolean }> {
  const restaurant = await readRestaurantSource(db, restaurantId);
  if (!restaurant) {
    // Restaurant supprimé → supprimer l'offre
    const offerId = buildMarketplaceOfferId(restaurantId, productId);
    await deleteDoc(doc(db, MARKETPLACE_DISH_OFFERS, offerId));
    return { offerId, discoverable: false };
  }

  const product = await readProductSource(db, restaurantId, productId);
  if (!product) {
    // Produit supprimé → supprimer l'offre
    const offerId = buildMarketplaceOfferId(restaurantId, productId);
    await deleteDoc(doc(db, MARKETPLACE_DISH_OFFERS, offerId));
    return { offerId, discoverable: false };
  }

  const categoryId = nullableString(product.categoryId);
  const category = await readCategorySource(db, restaurantId, categoryId);

  // Résoudre la marketplaceCategoryId : priorité au produit, sinon héritage de la catégorie
  const resolvedMarketplaceCategoryId =
    nullableString(product.marketplaceCategoryId) ||
    (category ? nullableString((category as any).marketplaceCategoryId) : null);

  // Publishability check
  const publishability = evaluateMarketplaceDishPublishability({
    restaurant,
    product,
    category,
  });

  const projectedAt = new Date().toISOString();
  const projection = projectMarketplaceDishOffer({
    restaurant,
    product,
    category,
    projectedAt,
  });

  const offerId = buildMarketplaceOfferId(restaurantId, productId);

  // ── Guard : pas de marketplaceCategoryId → supprimer toute projection existante ──
  if (!resolvedMarketplaceCategoryId) {
    const existingSnap = await getDoc(doc(db, MARKETPLACE_DISH_OFFERS, offerId));
    if (existingSnap.exists()) {
      await deleteDoc(doc(db, MARKETPLACE_DISH_OFFERS, offerId));
    }
    return { offerId, discoverable: false };
  }

  const payload = {
    ...projection,
    marketplaceCategoryId: resolvedMarketplaceCategoryId,
    discoverable: publishability.discoverable && Boolean(resolvedMarketplaceCategoryId),
  };

  await setDoc(doc(db, MARKETPLACE_DISH_OFFERS, offerId), payload);

  return { offerId, discoverable: publishability.discoverable };
}

// ────────────────────────────────────────────
//  2. Synchroniser tous les produits d'une catégorie locale
// ────────────────────────────────────────────

export async function syncCategoryOffers(
  db: Firestore,
  restaurantId: string,
  categoryId: string
): Promise<{ synced: number }> {
  let synced = 0;

  const productsQuery = query(
    collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PRODUCTS),
    where("categoryId", "==", categoryId),
    limit(100)
  );
  const productSnaps = await getDocs(productsQuery);

  for (const productSnap of productSnaps.docs) {
    try {
      await syncDishOffer(db, restaurantId, productSnap.id);
      synced++;
    } catch (error) {
      console.error(
        `[marketplace-sync-client] Erreur sync produit ${productSnap.id}:`,
        error
      );
    }
  }

  return { synced };
}

// ────────────────────────────────────────────
//  3. Reconstruire les catégories marketplace du restaurant
// ────────────────────────────────────────────

export async function rebuildRestaurantCategoryOffers(
  db: Firestore,
  restaurantId: string
): Promise<{ createdOrUpdated: number; deleted: number }> {
  const now = new Date().toISOString();
  let createdOrUpdated = 0;
  let deleted = 0;

  // Lire toutes les offres découvrables de ce restaurant
  const offersQuery = query(
    collection(db, MARKETPLACE_DISH_OFFERS),
    where("restaurantId", "==", restaurantId),
    where("discoverable", "==", true),
    where("schemaVersion", "==", 1),
    limit(200)
  );
  const offerSnaps = await getDocs(offersQuery);
  const discoverableOffers = offerSnaps.docs.map((d) => ({
    id: d.id,
    ...(d.data() as MarketplaceDishOfferDocument),
  }));

  // Grouper par marketplaceCategoryId
  const offersByCategory = new Map<
    string,
    Array<MarketplaceDishOfferDocument & { id: string }>
  >();
  for (const offer of discoverableOffers) {
    if (!offer.marketplaceCategoryId) continue;
    const group = offersByCategory.get(offer.marketplaceCategoryId) ?? [];
    group.push(offer);
    offersByCategory.set(offer.marketplaceCategoryId, group);
  }

  // Nouvelles projections souhaitées
  const desired = new Map<string, Record<string, unknown>>();
  for (const [marketplaceCategoryId, offers] of offersByCategory) {
    const id = buildMarketplaceRestaurantCategoryOfferId(
      restaurantId,
      marketplaceCategoryId
    );
    const projection = projectMarketplaceRestaurantCategoryOffer({
      restaurantId,
      marketplaceCategoryId,
      offers,
      updatedAt: now,
    });
    desired.set(id, projection as unknown as Record<string, unknown>);
  }

  // Lire les projections existantes pour ce restaurant
  const existingQuery = query(
    collection(db, MARKETPLACE_RESTAURANT_CATEGORY_OFFERS),
    where("restaurantId", "==", restaurantId),
    where("discoverable", "==", true),
    where("schemaVersion", "==", 1),
    limit(200)
  );
  const existingSnaps = await getDocs(existingQuery);
  const existingIds = new Map<string, string>();
  existingSnaps.docs.forEach((d) => existingIds.set(d.id, d.id));

  // Batch write : créer/mettre à jour les nouvelles + supprimer les obsolètes
  const batch = writeBatch(db);
  let pendingWrites = 0;

  for (const [id, projection] of desired) {
    batch.set(doc(db, MARKETPLACE_RESTAURANT_CATEGORY_OFFERS, id), projection);
    createdOrUpdated++;
    pendingWrites++;
  }

  for (const existingId of existingIds.keys()) {
    if (desired.has(existingId)) continue;
    batch.delete(doc(db, MARKETPLACE_RESTAURANT_CATEGORY_OFFERS, existingId));
    deleted++;
    pendingWrites++;
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }

  return { createdOrUpdated, deleted };
}

