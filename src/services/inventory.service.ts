'use client';

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
   * Decrements stock for a specific product's linked inventory items.
   */
  async decrementStockForProduct(restaurantId: string, productId: string, quantity: number) {
    // Find inventory items linked to this product
    const inventoryRef = collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.INVENTORY);
    const q = query(inventoryRef, where('linkedProductIds', 'array-contains', productId));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    await runTransaction(this.db, async (transaction) => {
      for (const inventoryDoc of snapshot.docs) {
        const docRef = inventoryDoc.ref;
        const currentData = inventoryDoc.data();
        const newQuantity = Math.max(0, (currentData.quantity || 0) - quantity);
        
        transaction.update(docRef, {
          quantity: newQuantity,
          updatedAt: serverTimestamp()
        });
      }
    });
  }
}
