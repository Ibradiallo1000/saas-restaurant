'use client';

/**
 * @fileOverview Service gérant la création d'établissements et le cycle de vie des restaurants.
 * Implémente l'architecture "Orchestration Atomique par Isolation Client".
 */

import { 
  Firestore, 
  doc, 
  serverTimestamp, 
  runTransaction, 
  Timestamp
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
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
   * Provisionnement ATOMIQUE d'un restaurant par le SuperAdmin.
   * Utilise une instance Firebase secondaire pour créer le compte Auth sans déconnecter l'Admin.
   */
  async createRestaurantForOwner(ownerEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();
    const tempPassword = this.generateSecurePassword(32);
    
    const tempAppName = `provisioning-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    let newUserUid: string | null = null;

    try {
      // 1. Création du compte Firebase Authentication (Isolé)
      const userCredential = await createUserWithEmailAndPassword(tempAuth, ownerEmail, tempPassword);
      newUserUid = userCredential.user.uid;

      // 2. TRANSACTION FIRESTORE ATOMIQUE
      await runTransaction(this.db, async (transaction) => {
        const restaurantRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
        const userRef = doc(this.db, COLLECTION_NAMES.USERS, newUserUid!);
        const subId = crypto.randomUUID();
        const subRef = doc(this.db, COLLECTION_NAMES.SUBSCRIPTIONS, subId);

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // Trial 30 jours

        transaction.set(restaurantRef, {
          id: restaurantId,
          ownerId: newUserUid,
          ownerEmail: ownerEmail.toLowerCase(),
          ...data,
          active: true,
          subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
          subscriptionEndDate: Timestamp.fromDate(endDate),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByPlatform: true
        });

        transaction.set(userRef, {
          id: newUserUid,
          email: ownerEmail.toLowerCase(),
          role: ROLES.OWNER,
          restaurantId: restaurantId,
          active: true,
          mustChangePassword: true,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        transaction.set(subRef, {
          id: subId,
          restaurantId,
          planId: 'trial',
          status: SUBSCRIPTION_STATUS.ACTIVE,
          startDate: serverTimestamp(),
          endDate: Timestamp.fromDate(endDate),
          isTrial: true,
          createdAt: serverTimestamp()
        });
      });

      // 3. Email de réinitialisation de mot de passe
      await sendPasswordResetEmail(tempAuth, ownerEmail);
      await signOut(tempAuth);

    } catch (error: any) {
      console.error("Échec critique du provisioning:", error);
      throw error;
    } finally {
      await deleteApp(tempApp);
    }

    return restaurantId;
  }

  private generateSecurePassword(length: number): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }
}
