'use client';

/**
 * @fileOverview Service gérant les plans et abonnements SaaS (version clean).
 */

import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  limit,
  orderBy,
  Timestamp
} from 'firebase/firestore';

import { COLLECTION_NAMES, SUBSCRIPTION_STATUS } from '@/lib/constants';

// ===============================
// 📦 TYPES
// ===============================

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: {
    maxUsers: number;
    aiEnabled: boolean;
    advancedReports: boolean;
    multiBranch: boolean;
  };
}

export interface Subscription {
  id: string;
  restaurantId: string;
  planId: string;
  status: string;
  startDate: Timestamp;
  endDate: Timestamp;
  isTrial: boolean;
  graceEndsAt?: Timestamp;
}

// ===============================
// 🚀 SERVICE
// ===============================

export class SubscriptionService {
  constructor(private db: Firestore) {}

  // ===============================
  // 📋 GET PLANS
  // ===============================
  async getPlans(): Promise<Plan[]> {
    const snap = await getDocs(query(collection(this.db, COLLECTION_NAMES.PLANS), limit(20)));
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as Plan));
  }

  // ===============================
  // 🔥 GET ACTIVE SUBSCRIPTION (FIX PRINCIPAL)
  // ===============================
  async getActiveSubscription(restaurantId: string): Promise<Subscription | null> {
    const q = query(
      collection(this.db, COLLECTION_NAMES.SUBSCRIPTIONS),
      where('restaurantId', '==', restaurantId),
      where('status', '==', SUBSCRIPTION_STATUS.ACTIVE),
      orderBy('endDate', 'desc'),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) return null;

    return {
      id: snap.docs[0].id,
      ...snap.docs[0].data()
    } as Subscription;
  }

  // ===============================
  // ⚡ GET CURRENT SUB (fallback / debug)
  // ===============================
  async getCurrentSubscription(restaurantId: string): Promise<Subscription | null> {
    const q = query(
      collection(this.db, COLLECTION_NAMES.SUBSCRIPTIONS),
      where('restaurantId', '==', restaurantId),
      orderBy('endDate', 'desc'),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) return null;

    return {
      id: snap.docs[0].id,
      ...snap.docs[0].data()
    } as Subscription;
  }

  // ===============================
  // 🎁 INIT TRIAL (AUTO CREATION)
  // ===============================
  async initializeTrial(restaurantId: string) {
    const subId = crypto.randomUUID();

    const now = new Date();
    const endDate = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000 // 30 jours
    );

    const subRef = doc(this.db, COLLECTION_NAMES.SUBSCRIPTIONS, subId);

    await setDoc(subRef, {
      restaurantId,
      planId: 'trial',
      status: SUBSCRIPTION_STATUS.ACTIVE,
      startDate: serverTimestamp(),
      endDate: Timestamp.fromDate(endDate),
      isTrial: true,
      createdAt: serverTimestamp()
    });
  }

  // ===============================
  // ⛔ CHECK EXPIRED
  // ===============================
  isExpired(subscription: Subscription | null): boolean {
    if (!subscription) return true;

    return subscription.endDate.toDate() < new Date();
  }

  // ===============================
  // 🧠 ACCESS LEVEL (ULTRA UTILE UI)
  // ===============================
  getAccessLevel(subscription: Subscription | null): 'active' | 'expired' | 'grace' | 'blocked' {
    if (!subscription) return 'blocked';

    const now = new Date();

    if (subscription.status === SUBSCRIPTION_STATUS.SUSPENDED) {
      return 'blocked';
    }

    if (subscription.graceEndsAt) {
  const graceDate = subscription.graceEndsAt.toDate();

  if (graceDate > now) {
    return 'grace';
  }
}

    return 'active';
  }
}
