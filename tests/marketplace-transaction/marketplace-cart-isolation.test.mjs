import assert from "node:assert/strict"
import test from "node:test"

import {
  LEGACY_PUBLIC_CART_STORAGE_KEY,
  getRestaurantCartStorageKey,
  readRestaurantCart,
  writeRestaurantCart,
} from "../../src/modules/public/cart/cart-storage.ts"

const normalize = (value) => value && typeof value === "object" && value.id ? value : null
const item = (id) => ({ id, productId: id, name: id, unitPrice: 1000, quantity: 1, total: 1000 })

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test("isole les paniers A et B dans les deux sens", () => {
  const storage = createStorage()
  writeRestaurantCart(storage, "restaurant-a", [item("a")])
  writeRestaurantCart(storage, "restaurant-b", [item("b")])

  assert.deepEqual(readRestaurantCart(storage, "restaurant-a", normalize).map(({ id }) => id), ["a"])
  assert.deepEqual(readRestaurantCart(storage, "restaurant-b", normalize).map(({ id }) => id), ["b"])
  assert.deepEqual(readRestaurantCart(storage, "restaurant-a", normalize).map(({ id }) => id), ["a"])
})

test("conserve le panier du restaurant après refresh", () => {
  const storage = createStorage()
  writeRestaurantCart(storage, "restaurant-a", [item("a")])
  assert.equal(readRestaurantCart(storage, "restaurant-a", normalize)[0]?.productId, "a")
})

test("migre une seule fois l’ancienne clé vers le restaurant courant", () => {
  const storage = createStorage({ [LEGACY_PUBLIC_CART_STORAGE_KEY]: JSON.stringify([item("legacy")]) })

  assert.equal(readRestaurantCart(storage, "restaurant-a", normalize)[0]?.id, "legacy")
  assert.equal(storage.getItem(LEGACY_PUBLIC_CART_STORAGE_KEY), null)
  assert.notEqual(storage.getItem(getRestaurantCartStorageKey("restaurant-a")), null)
  assert.deepEqual(readRestaurantCart(storage, "restaurant-b", normalize), [])
})
