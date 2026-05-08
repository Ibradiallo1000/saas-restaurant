"use client"

import type { Firestore } from "firebase/firestore"

import { createRestaurant } from "@/services/onboarding-api.service"
import type { RestaurantPlan, RestaurantSource, SubscriptionStatus } from "@/types"

export interface ProvisionRestaurantInput {
  name: string
  email: string
  slug?: string
  userId?: string
  country?: string
  phone?: string
  source?: RestaurantSource
  plan?: RestaurantPlan
  subscriptionStatus?: Extract<SubscriptionStatus, "trial" | "active" | "lifetime">
  actorId?: string
  actorToken?: string
  requestId?: string
}

export async function provisionRestaurant(
  input: ProvisionRestaurantInput,
  _db?: Firestore
): Promise<string> {
  if (!input.slug || !input.userId) {
    throw new Error("slug et userId sont requis. L'onboarding doit passer par l'API serveur.")
  }

  const result = await createRestaurant(
    {
      name: input.name,
      email: input.email,
      slug: input.slug,
      userId: input.userId,
      requestId: input.requestId,
    },
    input.actorToken
  )

  return result.restaurantId
}
