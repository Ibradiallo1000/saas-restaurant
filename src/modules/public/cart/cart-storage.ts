import type { CartItem } from "@/modules/restaurant/types"

export const LEGACY_PUBLIC_CART_STORAGE_KEY = "restaurant_public_cart_v1"
export const PUBLIC_CART_STORAGE_PREFIX = "restaurant_public_cart_v2"

export type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function getRestaurantCartStorageKey(restaurantId: string) {
  return `${PUBLIC_CART_STORAGE_PREFIX}:${encodeURIComponent(restaurantId)}`
}

export function readRestaurantCart(
  storage: CartStorage,
  restaurantId: string,
  normalize: (value: unknown) => CartItem | null
): CartItem[] {
  const scopedKey = getRestaurantCartStorageKey(restaurantId)
  const scoped = parseCart(storage.getItem(scopedKey), normalize)
  if (scoped) return scoped

  const legacy = parseCart(storage.getItem(LEGACY_PUBLIC_CART_STORAGE_KEY), normalize)
  if (!legacy) return []

  storage.setItem(scopedKey, JSON.stringify(legacy))
  storage.removeItem(LEGACY_PUBLIC_CART_STORAGE_KEY)
  return legacy
}

export function writeRestaurantCart(storage: CartStorage, restaurantId: string, items: CartItem[]) {
  storage.setItem(getRestaurantCartStorageKey(restaurantId), JSON.stringify(items))
}

function parseCart(raw: string | null, normalize: (value: unknown) => CartItem | null): CartItem[] | null {
  if (raw === null) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.map(normalize).filter((item): item is CartItem => item !== null)
  } catch {
    return null
  }
}
