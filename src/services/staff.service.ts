'use client';

/**
 * @fileOverview Service de gestion du personnel pour un restaurant.
 * Permet aux Owners de créer des comptes pour leur équipe sans se déconnecter.
 */

import { 
  Firestore, 
  doc, 
  serverTimestamp, 
  setDoc,
  collection,
  limit,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { COLLECTION_NAMES } from '@/lib/constants';

export class StaffService {
  constructor(private db: Firestore) {}

  /**
   * Crée un membre du personnel (Manager, Caissier, etc.)
   */
  async createStaffMember(
    restaurantId: string,
    email: string,
    role: string,
    profile?: { nomComplet?: string; telephone?: string }
  ) {
    const tempAppName = `staff-init-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

    try {
      // 1. Création Auth isolée
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, tempPassword);
      const uid = userCredential.user.uid;

      // 2. Création Profil Firestore
      const userRef = doc(this.db, COLLECTION_NAMES.USERS, uid);
      await setDoc(userRef, {
        id: uid,
        email: email.toLowerCase(),
        nomComplet: profile?.nomComplet ?? "",
        telephone: profile?.telephone ?? "",
        role: role,
        restaurantId: restaurantId,
        active: true,
        actif: true,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const staffRef = doc(
        this.db,
        COLLECTION_NAMES.RESTAURANTS,
        restaurantId,
        'staff',
        uid
      );
      await setDoc(staffRef, {
        id: uid,
        email: email.toLowerCase(),
        nomComplet: profile?.nomComplet ?? "",
        telephone: profile?.telephone ?? "",
        role,
        restaurantId,
        active: true,
        actif: true,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Email de bienvenue / reset
      await sendPasswordResetEmail(tempAuth, email);
      await signOut(tempAuth);

      return uid;
    } finally {
      await deleteApp(tempApp);
    }
  }

  /**
   * Récupère l'équipe d'un restaurant
   */
  async getStaff(restaurantId: string) {
    const q = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'staff'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }
}
