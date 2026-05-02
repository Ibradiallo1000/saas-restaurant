'use client';

import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';

export class LoyaltyService {
  constructor(private db: Firestore) {}

  /**
   * Updates or creates a customer profile and adds loyalty points.
   */
  async recordVisit(restaurantId: string, phone: string, name: string, amount: number) {
    const customerId = phone.replace(/[^\d+]/g, "") || `${Date.now()}`;
    const customerRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.CUSTOMERS,
      customerId
    );
    
    // Simple rule: 1 point per 10 currency units spent
    const pointsToAdd = Math.floor(amount / 10);

    await setDoc(customerRef, {
      restaurantId,
      phone,
      name,
      visits: increment(1),
      totalSpent: increment(amount),
      loyaltyPoints: increment(pointsToAdd),
      lastVisit: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}
