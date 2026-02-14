'use client';

import { 
  Firestore, 
  doc, 
  setDoc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  updateDoc,
  query,
  where,
  getDocs,
  limit,
  orderBy
} from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';

export class CashierService {
  constructor(private db: Firestore) {}

  async openShift(restaurantId: string, cashierId: string) {
    const sessionData = {
      restaurantId,
      cashierId,
      openedAt: serverTimestamp(),
      status: 'open',
      totalCash: 0,
      totalMobileMoney: 0,
      totalSales: 0,
    };
    return await addDoc(collection(this.db, COLLECTION_NAMES.CASHIER_SESSIONS), sessionData);
  }

  async closeShift(sessionId: string, totals: { cash: number, mobileMoney: number }) {
    const sessionRef = doc(this.db, COLLECTION_NAMES.CASHIER_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      closedAt: serverTimestamp(),
      totalCash: totals.cash,
      totalMobileMoney: totals.mobileMoney,
      totalSales: totals.cash + totals.mobileMoney,
      status: 'closed',
    });
  }

  async getCurrentSession(restaurantId: string, cashierId: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.CASHIER_SESSIONS),
      where('restaurantId', '==', restaurantId),
      where('cashierId', '==', cashierId),
      where('status', '==', 'open'),
      orderBy('openedAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
}
