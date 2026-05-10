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
  getDoc,
  setDoc,
  serverTimestamp,
  limit,
  orderBy,
  Timestamp,
  updateDoc,
  type DocumentData,
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

const PLAN_PRICES: Record<string, number> = {
  trial: 0,
  basic: 15000,
  pro: 35000,
  business: 75000,
  custom: 0,
};

export function getPlanPrice(plan: string) {
  return PLAN_PRICES[plan] ?? 0;
}

export async function updateSubscriptionPlan(
  db: Firestore,
  restaurantId: string,
  plan: string
) {
  const ref = await getSubscriptionRef(db, restaurantId);
  await updateDoc(ref, {
    plan,
    planId: plan,
    updatedAt: serverTimestamp(),
  });
}

export async function setSubscriptionCurrentPeriodEnd(
  db: Firestore,
  restaurantId: string,
  endDate: Date
) {
  const ref = await getSubscriptionRef(db, restaurantId);
  await updateDoc(ref, {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodEnd: Timestamp.fromDate(endDate),
    endDate: Timestamp.fromDate(endDate),
    updatedAt: serverTimestamp(),
  });
}

export async function activateGracePeriod(
  db: Firestore,
  restaurantId: string,
  graceEndDate: Date
) {
  const ref = await getSubscriptionRef(db, restaurantId);
  await updateDoc(ref, {
    status: SUBSCRIPTION_STATUS.GRACE,
    graceEndsAt: Timestamp.fromDate(graceEndDate),
    updatedAt: serverTimestamp(),
  });
}

export async function grantLifetimeAccess(db: Firestore, restaurantId: string) {
  const ref = await getSubscriptionRef(db, restaurantId);
  await updateDoc(ref, {
    status: SUBSCRIPTION_STATUS.LIFETIME,
    isManual: true,
    updatedAt: serverTimestamp(),
  });
}

export async function suspendSubscription(db: Firestore, restaurantId: string) {
  const ref = await getSubscriptionRef(db, restaurantId);
  await updateDoc(ref, {
    status: SUBSCRIPTION_STATUS.SUSPENDED,
    updatedAt: serverTimestamp(),
  });
}

async function getSubscriptionRef(db: Firestore, restaurantId: string) {
  const q = query(
    collection(db, COLLECTION_NAMES.SUBSCRIPTIONS),
    where('restaurantId', '==', restaurantId),
    orderBy('endDate', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);

  if (!snap.empty) return snap.docs[0].ref;

  const ref = doc(collection(db, COLLECTION_NAMES.SUBSCRIPTIONS));
  await setDoc(ref, {
    restaurantId,
    plan: 'trial',
    planId: 'trial',
    status: SUBSCRIPTION_STATUS.TRIAL,
    startDate: serverTimestamp(),
    endDate: Timestamp.fromDate(new Date()),
    currentPeriodEnd: Timestamp.fromDate(new Date()),
    isTrial: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies DocumentData);

  const created = await getDoc(ref);
  if (!created.exists()) throw new Error('Abonnement introuvable.');

  return ref;
}
