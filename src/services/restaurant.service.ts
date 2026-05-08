'use client';

import {
  Firestore,
  doc,
  serverTimestamp,
  runTransaction,
  Timestamp
} from 'firebase/firestore';

import { COLLECTION_NAMES, SUBSCRIPTION_STATUS } from '@/lib/constants';
import { InvitationService } from './invitation.service';

export type RestaurantContext = "standalone" | "hotel" | "lodge";

export interface RestaurantData {
  name: string;
  slug: string;

  context: RestaurantContext;

  countryCode: string;
  countryName: string;
  currency: string;
  timezone: string;

  city: string;
  phone: string;

  location?: {
    address?: string;
    googleMapsUrl?: string;
    lat?: number;
    lng?: number;
  };
}

export class RestaurantService {
  constructor(private db: Firestore) {}

  // 🔥 SLUG UNIQUE
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    return baseSlug;
  }

  // 🔥 CLEAN LOCATION
  private cleanLocation(location?: RestaurantData["location"]) {
    if (!location) return null;

    const cleaned: any = {};

    if (location.address) cleaned.address = location.address;
    if (location.googleMapsUrl) cleaned.googleMapsUrl = location.googleMapsUrl;
    if (location.lat !== undefined) cleaned.lat = location.lat;
    if (location.lng !== undefined) cleaned.lng = location.lng;

    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }

  /**
   * 🔥 VERSION INVITATION (PROPRE SaaS)
   */
  async createRestaurantForOwner(
    ownerEmail: string,
    data: RestaurantData
  ) {
    const restaurantId = crypto.randomUUID();

    try {
      const finalSlug = await this.generateUniqueSlug(data.slug);

      await runTransaction(this.db, async (tx) => {
        const restaurantRef = doc(
          this.db,
          COLLECTION_NAMES.RESTAURANTS,
          restaurantId
        );

        const subRef = doc(
          this.db,
          COLLECTION_NAMES.SUBSCRIPTIONS,
          restaurantId
        );

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // 🏢 RESTAURANT
        tx.set(restaurantRef, {
          id: restaurantId,
          name: data.name,
          slug: finalSlug,

          ownerEmail: ownerEmail.toLowerCase(),

          context: data.context,

          countryCode: data.countryCode,
          countryName: data.countryName,
          city: data.city,
          phone: data.phone,

          location: this.cleanLocation(data.location),

          settings: {
            currency: data.currency,
            timezone: data.timezone
          },

          status: "active",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // 💳 SUBSCRIPTION
        tx.set(subRef, {
          restaurantId,
          planId: "trial",
          status: SUBSCRIPTION_STATUS.ACTIVE,
          startDate: serverTimestamp(),
          endDate: Timestamp.fromDate(endDate),
          isTrial: true
        });
      });

      // 🔥 INVITATION (clé du système)
      const invitationService = new InvitationService(this.db);
      const token = await invitationService.createInvitation(
        ownerEmail,
        restaurantId
      );

      return {
        restaurantId,
        token
      };

    } catch (error: any) {
      console.error("🔥 FIRESTORE ERROR:", error);
      throw new Error(error.message || "Erreur création restaurant");
    }
  }
}
