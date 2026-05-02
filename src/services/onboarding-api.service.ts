"use client"

export interface CreateRestaurantApiInput {
  name: string
  email: string
  slug: string
  userId: string
  requestId?: string
}

export interface CreateRestaurantApiResult {
  success: true
  companyId: string
  restaurantId: string
}

export async function createRestaurant(
  data: CreateRestaurantApiInput,
  token?: string
): Promise<CreateRestaurantApiResult> {
  const response = await fetch("/api/create-restaurant", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  })

  const body = (await response.json().catch(() => null)) as { error?: string } | null

  if (!response.ok) {
    throw new Error(body?.error ?? "Creation restaurant impossible.")
  }

  return body as CreateRestaurantApiResult
}
