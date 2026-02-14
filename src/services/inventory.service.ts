'use client';

/**
 * @fileOverview Service gérant les stocks et l'inventaire.
 * Assure le décompte automatique des ingrédients lors des ventes.
 */

import { 
  Firestore, 
  doc, 
  getDocs, 
  collection, 
  query, 
  where, 
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';

export class InventoryService {
  constructor(private db: Firestore) {}

  /**
   * Décrémente les niveaux de stock pour tous les articles d'inventaire liés à un produit.
   * Utilise une transaction pour éviter les valeurs négatives ou incohérentes.
   */
  async decrementStockForProduct(restaurantId: string, productId: string, quantity: number) {
    // Récupération des ingrédients d'inventaire liés à ce produit via l'ID
    const inventoryRef = collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.INVENTORY);
    const q = query(inventoryRef, where('linkedProductIds', 'array-contains', productId));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    // Transaction atomique pour la mise à jour des quantités
    await runTransaction(this.db, async (transaction) => {
      for (const inventoryDoc of snapshot.docs) {
        const docRef = inventoryDoc.ref;
        const currentData = inventoryDoc.data();
        
        // Empêche les stocks négatifs (sécurité supplémentaire)
        const newQuantity = Math.max(0, (currentData.quantity || 0) - quantity);
        
        transaction.update(docRef, {
          quantity: newQuantity,
          updatedAt: serverTimestamp()
        });
      }
    });
  }
}
