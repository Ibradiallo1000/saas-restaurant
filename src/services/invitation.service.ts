'use client';

import {
  Firestore,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

export class InvitationService {
  constructor(private db: Firestore) {}

  generateToken() {
    return crypto.randomUUID();
  }

  async createInvitation(email: string, restaurantId: string) {
    const id = crypto.randomUUID();
    const token = this.generateToken();

    const expires = new Date();
    expires.setDate(expires.getDate() + 2);

    await setDoc(doc(this.db, 'invitations', id), {
      id,
      email: email.toLowerCase(),
      restaurantId,
      role: "owner",
      token,
      status: "pending",
      expiresAt: expires,
      createdAt: serverTimestamp()
    });

    return token;
  }
}