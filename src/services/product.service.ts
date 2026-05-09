'use client';

/**
 * @fileOverview Service gérant le catalogue de produits.
 * Source unique de vérité pour le POS et le menu QR.
 */

import { 
  Firestore, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { restaurantProductRef, restaurantProductsRef } from '@/lib/restaurant-firestore-paths';

export interface ProductInput {
  menuId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isDailySpecial?: boolean;
}

export class ProductService {
  constructor(private db: Firestore) {}

  /**
   * Récupère tous les produits d'un restaurant.
   */
  async getProducts(restaurantId: string) {
    if (!restaurantId) return [];

    const q = query(
      restaurantProductsRef(this.db, restaurantId),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Récupère les suggestions du jour (Plats du Jour).
   */
  async getDailySpecials(restaurantId: string) {
    if (!restaurantId) return [];

    const q = query(
      restaurantProductsRef(this.db, restaurantId),
      where('isDailySpecial', '==', true),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Met à jour le flag "Plat du Jour".
   */
  async toggleDailySpecial(restaurantId: string, productId: string, status: boolean) {
    if (!restaurantId || !productId) return;

    const ref = restaurantProductRef(this.db, restaurantId, productId);
    await updateDoc(ref, {
      isDailySpecial: status,
      updatedAt: serverTimestamp()
    });
  }
}
