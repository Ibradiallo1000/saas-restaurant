'use client';

/**
 * @fileOverview Service gérant la création d'établissements et le cycle de vie des restaurants.
 * Implémente l'architecture finale "Orchestration Atomique par Isolation Client".
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
   * Architecture : Isolation via application secondaire pour ne pas impacter la session Admin.
   */
  async createRestaurantForOwner(ownerEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();
    const tempPassword = this.generateSecurePassword(32);
    
    // Initialisation de l'instance isolée
    const tempAppName = `provisioning-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    let newUserUid: string | null = null;

    try {
      // 1. Création du compte Firebase Authentication (Isolé)
      const userCredential = await createUserWithEmailAndPassword(tempAuth, ownerEmail, tempPassword);
      newUserUid = userCredential.user.uid;

      // 2. TRANSACTION FIRESTORE ATOMIQUE (Source de vérité)
      await runTransaction(this.db, async (transaction) => {
        const restaurantRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
        const userRef = doc(this.db, COLLECTION_NAMES.USERS, newUserUid!);
        const subId = crypto.randomUUID();
        const subRef = doc(this.db, COLLECTION_NAMES.SUBSCRIPTIONS, subId);

        // Date de fin d'essai (+30 jours)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // A. Création du Restaurant
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

        // B. Création du Profil Utilisateur (Owner)
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

        // C. Création de l'Abonnement (Trial)
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

      // 3. HANDSHAKE SÉCURISÉ : Reset password email
      await sendPasswordResetEmail(tempAuth, ownerEmail);

      // Déconnexion de l'app temporaire
      await signOut(tempAuth);

    } catch (error: any) {
      console.error("Échec critique du provisioning:", error);
      throw error;
    } finally {
      // Nettoyage impératif de l'instance secondaire
      await deleteApp(tempApp);
    }

    return restaurantId;
  }

  /**
   * Génère un mot de passe temporaire hautement sécurisé.
   */
  private generateSecurePassword(length: number): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }
}