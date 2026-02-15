
'use client';

/**
 * @fileOverview Service de gestion de la configuration globale de la plateforme SaaS.
 */

import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';

export interface PlatformConfig {
  name: string;
  logoUrl: string;
  supportEmail: string;
  primaryColor: string;
  secondaryColor: string;
  defaultTrialDays: number;
  maintenanceMode: boolean;
}

export class PlatformService {
  constructor(private db: Firestore) {}

  /**
   * Récupère la configuration principale de la plateforme.
   */
  async getConfig(): Promise<PlatformConfig | null> {
    const docRef = doc(this.db, COLLECTION_NAMES.PLATFORM, 'main');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as PlatformConfig;
  }

  /**
   * Initialise ou met à jour la configuration (SuperAdmin uniquement).
   */
  async updateConfig(data: Partial<PlatformConfig>) {
    const docRef = doc(this.db, COLLECTION_NAMES.PLATFORM, 'main');
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}
