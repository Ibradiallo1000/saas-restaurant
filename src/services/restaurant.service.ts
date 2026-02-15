
'use client';

/**
 * @fileOverview Service gérant la création d'établissements par la Plateforme.
 */

import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  collection,
  query,
  where,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { COLLECTION_NAMES, ROLES, SUBSCRIPTION_STATUS } from '@/lib/constants';

export interface RestaurantData {
  name: string;
  slug: string;
  country: string;
  currency: string;
}

export class RestaurantService {
  constructor(private db: Firestore) {}

  /**
   * Crée un nouvel établissement et le rattache à un email de propriétaire.
   * Seul un SuperAdmin appelle cette fonction via la UI.
   */
  async createRestaurantForOwner(ownerEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const restaurantRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);

    // 1. Création de l'établissement
    // L'ownerId sera complété lors de la première connexion de l'Owner via son email
    await setDoc(restaurantRef, {
      id: restaurantId,
      ownerEmail: ownerEmail.toLowerCase(), // Utilisé pour le matching au login
      ...data,
      slug: data.slug.toLowerCase().trim().replace(/\s+/g, '-'),
      planId: 'trial_basic',
      active: true,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionStartDate: serverTimestamp(),
      subscriptionEndDate: trialEndDate.toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return restaurantId;
  }

  /**
   * Lors du login, si un utilisateur n'a pas de profil mais que son email 
   * matche un restaurant créé par la plateforme.
   */
  async linkUserToRestaurant(userId: string, email: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS),
      where('ownerEmail', '==', email.toLowerCase()),
      where('ownerId', '==', null) // Pas encore lié
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const restaurantDoc = snapshot.docs[0];
      const restaurantId = restaurantDoc.id;

      // 1. Lier le restaurant à l'ID de l'utilisateur
      await updateDoc(restaurantDoc.ref, {
        ownerId: userId,
        updatedAt: serverTimestamp()
      });

      // 2. Créer le profil User local
      await setDoc(doc(this.db, COLLECTION_NAMES.USERS, userId), {
        id: userId,
        restaurantId: restaurantId,
        role: ROLES.OWNER,
        email: email,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return restaurantId;
    }
    return null;
  }
}
