'use client';

/**
 * @fileOverview Service CRUD centralisé pour les catégories globales marketplace (marketplaceFoodCategories).
 * Toutes les opérations d'écriture passent par ce service.
 * Ne pas effectuer d'appels Firestore directs dans les composants UI.
 */

import {
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

import { COLLECTION_NAMES } from '@/lib/constants';
import { normalizeMarketplaceSearch } from '@/lib/marketplace-discovery/marketplace-discovery-core';
import {
  normalizeSlug,
  normalizeCategoryName,
  normalizeSortOrder,
  isValidIconKey,
  isValidActiveStatus,
  validateMarketplaceFoodCategory,
  type MarketplaceFoodCategoryInput,
} from '@/lib/marketplace-discovery/marketplace-food-category-validators';

export interface MarketplaceCategoryData {
  name: string;
  slug: string;
  iconKey?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  active: boolean;
}

export interface MarketplaceCategoryRecord {
  id: string;
  schemaVersion: 1;
  name: string;
  slug: string;
  normalizedName: string;
  icon: string | null;
  iconKey?: string | null;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  aliases: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export class MarketplaceCategoryService {
  private collectionRef;

  constructor(private db: Firestore) {
    this.collectionRef = collection(this.db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES);
  }

  /**
   * Liste toutes les catégories pour l'admin, triées par sortOrder puis nom.
   */
  async listAll(): Promise<MarketplaceCategoryRecord[]> {
    const q = query(
      this.collectionRef,
      orderBy('sortOrder', 'asc'),
      orderBy('name', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MarketplaceCategoryRecord, 'id'>),
    })) as MarketplaceCategoryRecord[];
  }

  /**
   * Récupère une catégorie par son ID.
   */
  async getById(id: string): Promise<MarketplaceCategoryRecord | null> {
    const ref = doc(this.collectionRef, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<MarketplaceCategoryRecord, 'id'>) } as MarketplaceCategoryRecord;
  }

  /**
   * Vérifie l'unicité d'un slug.
   * Retourne true si le slug est déjà utilisé par un autre document.
   */
  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const q = query(this.collectionRef, where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    if (excludeId) {
      return snap.docs.some((d) => d.id !== excludeId);
    }
    return true;
  }

  /**
   * Crée une nouvelle catégorie globale marketplace.
   * Le slug devient l'ID du document.
   * Valide les champs avant écriture.
   */
  async create(input: MarketplaceFoodCategoryInput): Promise<MarketplaceCategoryRecord> {
    const validation = validateMarketplaceFoodCategory(input);
    if (!validation.valid) {
      throw new Error(`Validation échouée : ${validation.errors.join('; ')}`);
    }

    const slug = validation.slug!;
    const name = normalizeCategoryName(input.name)!;
    const normalizedName = validation.normalizedName!;
    const sortOrder = validation.sortOrder ?? 0;
    const iconKey = input.iconKey && isValidIconKey(input.iconKey) ? input.iconKey : null;
    const imageUrl = typeof input.imageUrl === 'string' && input.imageUrl.trim() ? input.imageUrl.trim() : null;

    // Vérifier unicité du slug
    const slugTaken = await this.isSlugTaken(slug);
    if (slugTaken) {
      throw new Error(`Le slug "${slug}" est déjà utilisé.`);
    }

    const payload: DocumentData = {
      schemaVersion: 1,
      name,
      slug,
      normalizedName,
      icon: iconKey,
      iconKey,
      imageUrl,
      sortOrder,
      active: input.active === true,
      aliases: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = doc(this.collectionRef, slug);
    await setDoc(ref, payload);

    // Relecture pour retourner les données avec timestamps
    const created = await this.getById(slug);
    if (!created) throw new Error('Erreur lors de la création de la catégorie.');
    return created;
  }

  /**
   * Met à jour une catégorie existante.
   * Ne met pas à jour le slug (l'ID est figé).
   */
  async update(id: string, input: Partial<MarketplaceFoodCategoryInput>): Promise<MarketplaceCategoryRecord> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Catégorie "${id}" introuvable.`);

    const merged: MarketplaceFoodCategoryInput = {
      name: input.name ?? existing.name,
      slug: existing.slug, // Le slug ne change pas
      iconKey: input.iconKey !== undefined ? input.iconKey : (existing.iconKey ?? existing.icon ?? null),
      sortOrder: input.sortOrder ?? existing.sortOrder,
      active: input.active !== undefined ? input.active : existing.active,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl : (existing.imageUrl ?? ''),
    };

    // Valider avec les champs fusionnés
    const validation = validateMarketplaceFoodCategory(merged);
    if (!validation.valid) {
      throw new Error(`Validation échouée : ${validation.errors.join('; ')}`);
    }

    const name = normalizeCategoryName(merged.name)!;
    const sortOrder = validation.sortOrder ?? existing.sortOrder;
    const iconKey = merged.iconKey && isValidIconKey(merged.iconKey) ? merged.iconKey : null;
    const imageUrl = typeof merged.imageUrl === 'string' && merged.imageUrl.trim() ? merged.imageUrl.trim() : null;

    const ref = doc(this.collectionRef, id);
    await updateDoc(ref, {
      name,
      normalizedName: normalizeMarketplaceSearch(name),
      icon: iconKey,
      iconKey,
      imageUrl,
      sortOrder,
      active: merged.active === true,
      updatedAt: serverTimestamp(),
    });

    const updated = await this.getById(id);
    if (!updated) throw new Error('Erreur lors de la mise à jour de la catégorie.');
    return updated;
  }

  /**
   * Active ou désactive une catégorie.
   * Préférer la désactivation à la suppression.
   */
  async setActive(id: string, active: boolean): Promise<MarketplaceCategoryRecord> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Catégorie "${id}" introuvable.`);

    const ref = doc(this.collectionRef, id);
    await updateDoc(ref, {
      active,
      updatedAt: serverTimestamp(),
    });

    const updated = await this.getById(id);
    if (!updated) throw new Error('Erreur lors du changement de statut.');
    return updated;
  }

/**
 * Vérifie toutes les références à une catégorie marketplace dans le système.
 * Retourne un objet détaillant les dépendances trouvées.
 */
async checkReferences(id: string): Promise<{
  hasReferences: boolean;
  projectedOffers: number;
  localCategories: number;
  products: number;
  details: string[];
}> {
  const result = {
    hasReferences: false,
    projectedOffers: 0,
    localCategories: 0,
    products: 0,
    details: [] as string[],
  };

  // 1. Offres projetées marketplaceRestaurantCategoryOffers
  const offersQuery = query(
    collection(this.db, COLLECTION_NAMES.MARKETPLACE_RESTAURANT_CATEGORY_OFFERS),
    where('marketplaceCategoryId', '==', id)
  );
  const offersSnap = await getDocs(offersQuery);
  result.projectedOffers = offersSnap.size;
  if (offersSnap.size > 0) {
    result.hasReferences = true;
    result.details.push(`${offersSnap.size} offre(s) projetée(s) dans marketplaceRestaurantCategoryOffers`);
  }

  // 2. Catégories locales restaurants (collection categories de chaque restaurant)
  // On lit les restaurants puis leurs sous-collections categories
  const restaurantsSnap = await getDocs(collection(this.db, COLLECTION_NAMES.RESTAURANTS));
  for (const restDoc of restaurantsSnap.docs) {
    const catQuery = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS, restDoc.id, 'categories'),
      where('marketplaceCategoryId', '==', id)
    );
    const catSnap = await getDocs(catQuery);
    result.localCategories += catSnap.size;
    if (catSnap.size > 0) {
      result.hasReferences = true;
      for (const c of catSnap.docs) {
        result.details.push(`Catégorie locale "${c.data().name || c.id}" (restaurant: ${restDoc.id})`);
      }
    }
  }

  // 3. Produits avec marketplaceCategoryId direct (dans la sous-collection products)
  for (const restDoc of restaurantsSnap.docs) {
    const prodQuery = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS, restDoc.id, 'products'),
      where('marketplaceCategoryId', '==', id)
    );
    const prodSnap = await getDocs(prodQuery);
    result.products += prodSnap.size;
    if (prodSnap.size > 0) {
      result.hasReferences = true;
      for (const p of prodSnap.docs) {
        result.details.push(`Produit "${p.data().name || p.id}" (restaurant: ${restDoc.id})`);
      }
    }
  }

  return result;
}

/**
 * Supprime une catégorie. Préférer la désactivation à la suppression.
 * Vérifie les références avant suppression sauf si force=true.
 * Bloque la suppression si la catégorie est active (sauf force).
 */
async delete(id: string, force = false): Promise<{ deleted: boolean; references?: Awaited<ReturnType<MarketplaceCategoryService['checkReferences']>> }> {
  const existing = await this.getById(id);
  if (!existing) throw new Error(`Catégorie "${id}" introuvable.`);

  if (existing.active && !force) {
    throw new Error(
      'Impossible de supprimer une catégorie active. Désactivez-la d\'abord ou utilisez force=true.'
    );
  }

  // Vérifier les références
  const references = await this.checkReferences(id);
  if (references.hasReferences) {
    if (!force) {
      throw new Error(
        `Impossible de supprimer : ${references.details.length} référence(s) existent. Désactivez d'abord ou utilisez force=true.`
      );
    }
    // En force=true, les références orphelines restent (prévenir dans le résultat)
  }

  const ref = doc(this.collectionRef, id);
  await deleteDoc(ref);

  return {
    deleted: true,
    ...(references.hasReferences ? { references } : {}),
  };
}

  /**
   * Réordonne une catégorie.
   */
  async setSortOrder(id: string, sortOrder: number): Promise<MarketplaceCategoryRecord> {
    const normalized = normalizeSortOrder(sortOrder);
    if (normalized === null) {
      throw new Error(`L'ordre d'affichage doit être un entier entre 0 et 9999.`);
    }

    const existing = await this.getById(id);
    if (!existing) throw new Error(`Catégorie "${id}" introuvable.`);

    const ref = doc(this.collectionRef, id);
    await updateDoc(ref, {
      sortOrder: normalized,
      updatedAt: serverTimestamp(),
    });

    const updated = await this.getById(id);
    if (!updated) throw new Error('Erreur lors du réordonnancement.');
    return updated;
  }
}
