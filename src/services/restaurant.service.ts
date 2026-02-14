'use client';

/**
 * @fileOverview Service gérant la création d'établissements et la gestion des abonnements.
 * Supporte désormais le multi-établissement par propriétaire.
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
   * Crée un nouvel établissement lié à un propriétaire.
   * Initialise l'abonnement en mode "essai" (30 jours).
   */
  async createRestaurant(userId: string, userEmail: string, data: RestaurantData) {
    const restaurantId = crypto.randomUUID();
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const restaurantRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
    const userRef = doc(this.db, COLLECTION_NAMES.USERS, userId);

    // 1. Création de l'établissement avec ownerId pour le multi-site
    await setDoc(restaurantRef, {
      id: restaurantId,
      ownerId: userId,
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

    // 2. Mise à jour ou création du profil utilisateur Owner
    // L'Owner garde son rôle mais on peut lui assigner ce restaurantId par défaut s'il n'en a pas
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    await setDoc(userRef, {
      id: userId,
      restaurantId: userData?.restaurantId || restaurantId, // Défaut au premier créé
      role: ROLES.OWNER,
      email: userEmail,
      active: true,
      updatedAt: serverTimestamp(),
      createdAt: userData?.createdAt || serverTimestamp(),
    }, { merge: true });

    return restaurantId;
  }

  /**
   * Récupère tous les établissements appartenant à un propriétaire spécifique.
   */
  async getRestaurantsByOwner(ownerId: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS),
      where('ownerId', '==', ownerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Vérifie et met à jour le statut de l'abonnement en fonction de la date actuelle.
   * Logique "Soft-Lock" pour l'expiration.
   */
  async refreshSubscriptionStatus(restaurantId: string) {
    const resRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
    const snap = await getDoc(resRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const endDate = new Date(data.subscriptionEndDate);
    const now = new Date();

    if (now > endDate && data.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE) {
      await updateDoc(resRef, {
        subscriptionStatus: SUBSCRIPTION_STATUS.EXPIRED,
        updatedAt: serverTimestamp()
      });
    }
  }

  /**
   * Récupère un établissement via son slug unique.
   */
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