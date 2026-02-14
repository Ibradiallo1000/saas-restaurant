'use client';

/**
 * @fileOverview Service gérant les sessions de caisse.
 * Assure la traçabilité des ouvertures et clôtures de caisse par établissement.
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
import { COLLECTION_NAMES } from '@/lib/constants';

export class CashierService {
  constructor(private db: Firestore) {}

  /**
   * Ouvre une nouvelle session de caisse pour un utilisateur donné.
   * Vérifie d'abord qu'aucune session n'est déjà ouverte pour ce caissier.
   */
  async openShift(restaurantId: string, cashierId: string) {
    // SÉCURITÉ : Empêche l'ouverture de plusieurs sessions simultanées pour un même caissier
    const existing = await this.getCurrentSession(restaurantId, cashierId);
    if (existing) {
      throw new Error("Une session est déjà ouverte pour ce caissier. Veuillez la clôturer d'abord.");
    }

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

  /**
   * Clôture la session de caisse active et enregistre les totaux finaux.
   */
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

  /**
   * Récupère la session ouverte actuelle d'un caissier.
   */
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
