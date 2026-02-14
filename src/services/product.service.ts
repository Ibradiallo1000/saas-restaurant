'use client';

/**
 * @fileOverview Service gérant le catalogue de produits.
 * Source unique de vérité pour le POS et le menu QR.
 */

import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';

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
    const q = query(
      collection(this.db, COLLECTION_NAMES.PRODUCTS),
      where('restaurantId', '==', restaurantId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Récupère les suggestions du jour (Plats du Jour).
   */
  async getDailySpecials(restaurantId: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.PRODUCTS),
      where('restaurantId', '==', restaurantId),
      where('isDailySpecial', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /**
   * Met à jour le flag "Plat du Jour".
   */
  async toggleDailySpecial(productId: string, status: boolean) {
    const ref = doc(this.db, COLLECTION_NAMES.PRODUCTS, productId);
    await updateDoc(ref, {
      isDailySpecial: status,
      updatedAt: serverTimestamp()
    });
  }
}
