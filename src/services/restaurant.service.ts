'use client';

/**
 * @fileOverview Service gérant la création d'établissements et le cycle de vie des restaurants.
 * Inclut le provisioning complet (Auth + Firestore + Subscription).
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
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app';
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
   * Provisionnement complet d'un restaurant par le SuperAdmin.
   * 1. Crée le compte Firebase Auth (via une app secondaire pour ne pas déconnecter l'admin).
   * 2. Crée le document Restaurant, User et Subscription dans une transaction Firestore.
   * 3. Envoie un email de réinitialisation de mot de passe.
   */
  async createRestaurantForOwner(ownerEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();
    const tempPassword = this.generateSecurePassword();
    
    // Initialisation d'une application Firebase secondaire pour le provisioning
    // Cela permet de créer un utilisateur sans déconnecter le SuperAdmin actuel
    const tempAppName = `provisioning-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    let newUserUid: string | null = null;

    try {
      // 1. Création du compte dans Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(tempAuth, ownerEmail, tempPassword);
      newUserUid = userCredential.user.uid;

      // 2. Transaction Firestore pour garantir la cohérence totale des données
      await runTransaction(this.db, async (transaction) => {
        // Références des documents
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

        // C. Création de l'Abonnement Trial
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

      // 3. Envoi de l'email de réinitialisation de mot de passe
      // L'utilisateur recevra un lien pour choisir son propre mot de passe
      await sendPasswordResetEmail(tempAuth, ownerEmail);

      // Déconnexion de l'app temporaire (juste au cas où)
      await signOut(tempAuth);

    } catch (error: any) {
      console.error("Erreur lors du provisioning:", error);
      // Note: Le rollback Auth est complexe en client-side sans Admin SDK.
      // On se fie à la transaction Firestore pour la cohérence DB.
      throw error;
    } finally {
      // Nettoyage de l'instance temporaire
      await deleteApp(tempApp);
    }

    return restaurantId;
  }

  /**
   * Génère un mot de passe temporaire sécurisé.
   */
  private generateSecurePassword(): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let retVal = "";
    for (let i = 0; i < 16; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return retVal;
  }
}
