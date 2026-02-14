'use client';

import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { COLLECTION_NAMES, ROLES } from '@/lib/constants';

export interface RestaurantData {
  name: string;
  slug: string;
  country: string;
  currency: string;
}

export class RestaurantService {
  constructor(private db: Firestore) {}

  async createRestaurant(userId: string, userEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const restaurantRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
    const userRef = doc(this.db, COLLECTION_NAMES.USERS, userId);

    // 1. Création du restaurant
    await setDoc(restaurantRef, {
      id: restaurantId,
      ...data,
      slug: data.slug.toLowerCase().trim().replace(/\s+/g, '-'),
      planId: 'trial_basic',
      active: true,
      trialStartDate: serverTimestamp(),
      trialEndDate: trialEndDate.toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Mise à jour de l'utilisateur
    await setDoc(userRef, {
      id: userId,
      restaurantId,
      role: ROLES.OWNER,
      email: userEmail,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return restaurantId;
  }

  async getRestaurantBySlug(slug: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS), 
      where('slug', '==', slug),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }
}
