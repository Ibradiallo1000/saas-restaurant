'use client';

/**
 * @fileOverview Service gérant les sessions de caisse.
 * Assure la traçabilité des ouvertures, clôtures et validations par le management.
 */

import { 
  Firestore, 
  doc, 
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
import { COLLECTION_NAMES, SESSION_STATUS } from '@/lib/constants';

export class CashierService {
  constructor(private db: Firestore) {}

  /**
   * Ouvre une nouvelle session de caisse.
   * État initial: 'opened'
   */
  async openShift(restaurantId: string, cashierId: string) {
    const existing = await this.getCurrentSession(restaurantId, cashierId);
    if (existing) {
      throw new Error("Une session est déjà ouverte pour ce caissier.");
    }

    const sessionData = {
      restaurantId,
      cashierId,
      openedAt: serverTimestamp(),
      status: SESSION_STATUS.OPENED,
      totalCash: 0,
      totalMobileMoney: 0,
      totalSales: 0,
    };
    return await addDoc(collection(this.db, COLLECTION_NAMES.CASHIER_SESSIONS), sessionData);
  }

  /**
   * Clôture la session par le caissier.
   * État: 'closed' (En attente de validation manager)
   */
  async closeShift(sessionId: string, totals: { cash: number, mobileMoney: number }) {
    const sessionRef = doc(this.db, COLLECTION_NAMES.CASHIER_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      closedAt: serverTimestamp(),
      totalCash: totals.cash,
      totalMobileMoney: totals.mobileMoney,
      totalSales: totals.cash + totals.mobileMoney,
      status: SESSION_STATUS.CLOSED,
    });
  }

  /**
   * Validation de la session par un manager ou propriétaire.
   * État final: 'validated'
   */
  async validateShift(sessionId: string, validatorId: string) {
    const sessionRef = doc(this.db, COLLECTION_NAMES.CASHIER_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      validatedAt: serverTimestamp(),
      validatedBy: validatorId,
      status: SESSION_STATUS.VALIDATED,
    });
  }

  /**
   * Récupère la session active.
   */
  async getCurrentSession(restaurantId: string, cashierId: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.CASHIER_SESSIONS),
      where('restaurantId', '==', restaurantId),
      where('cashierId', '==', cashierId),
      where('status', '==', SESSION_STATUS.OPENED),
      orderBy('openedAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
}
