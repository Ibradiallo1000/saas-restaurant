
'use client';

/**
 * @fileOverview Service gérant la création d'établissements et le cycle de vie des restaurants.
 */

import { 
  Firestore, 
  doc, 
  setDoc, 
  serverTimestamp, 
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  runTransaction
} from 'firebase/firestore';
import { COLLECTION_NAMES, ROLES } from '@/lib/constants';
import { SubscriptionService } from './subscription.service';

export interface RestaurantData {
  name: string;
  slug: string;
  country: string;
  currency: string;
}

export class RestaurantService {
  private subscriptionService: SubscriptionService;

  constructor(private db: Firestore) {
    this.subscriptionService = new SubscriptionService(db);
  }

  /**
   * Provisionnement complet d'un restaurant (Étape SuperAdmin).
   * Crée l'entité établissement et initialise l'abonnement d'essai.
   */
  async createRestaurantForOwner(ownerEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();

    await runTransaction(this.db, async (transaction) => {
      // 1. Création du restaurant
      const restaurantRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
      transaction.set(restaurantRef, {
        id: restaurantId,
        ownerEmail: ownerEmail.toLowerCase(),
        ...data,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Initialisation de l'abonnement Trial (via service externe mais transactionnel)
      // Note: Les écritures dans une transaction Firestore doivent être faites via l'objet transaction
      const subId = crypto.randomUUID();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const subRef = doc(this.db, COLLECTION_NAMES.SUBSCRIPTIONS, subId);
      transaction.set(subRef, {
        restaurantId,
        planId: 'trial',
        status: 'active',
        startDate: serverTimestamp(),
        endDate: endDate,
        isTrial: true,
        createdAt: serverTimestamp()
      });
    });

    return restaurantId;
  }

  /**
   * Handshake (Invitation) : Lie un utilisateur authentifié à son restaurant provisionné.
   * Se déclenche au premier login de l'adresse email invitée.
   */
  async linkUserToRestaurant(userId: string, email: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS),
      where('ownerEmail', '==', email.toLowerCase()),
      where('ownerId', '==', null)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const restaurantDoc = snapshot.docs[0];
      const restaurantId = restaurantDoc.id;

      // Utilisation d'une transaction pour lier l'UID et créer le profil utilisateur
      await runTransaction(this.db, async (transaction) => {
        // Lier l'ownerId au restaurant
        transaction.update(restaurantDoc.ref, {
          ownerId: userId,
          updatedAt: serverTimestamp()
        });

        // Créer le document utilisateur (users collection)
        const userRef = doc(this.db, COLLECTION_NAMES.USERS, userId);
        transaction.set(userRef, {
          id: userId,
          restaurantId: restaurantId,
          role: ROLES.OWNER,
          email: email.toLowerCase(),
          active: true,
          mustChangePassword: true, // Flag pour forcer le changement au premier login
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      return restaurantId;
    }
    return null;
  }
}
