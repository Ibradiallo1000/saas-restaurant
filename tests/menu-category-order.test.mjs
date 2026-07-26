import assert from "node:assert/strict"
import test from "node:test"

import { getCategoryDisplayOrder, sortMenuCategories } from "../src/lib/menu-category-order.ts"

test("résout l'ordre d'affichage avec compatibilité legacy", () => {
  assert.equal(getCategoryDisplayOrder({ displayOrder: 2, order: 9, sortOrder: 10 }), 2)
  assert.equal(getCategoryDisplayOrder({ order: 4, sortOrder: 10 }), 4)
  assert.equal(getCategoryDisplayOrder({ sortOrder: 6 }), 6)
  assert.equal(getCategoryDisplayOrder({}, 12), 12)
})

test("trie les catégories de manière stable", () => {
  const sorted = sortMenuCategories([
    { id: "desserts", name: "Desserts", order: 3 },
    { id: "pizzas", name: "Pizzas", displayOrder: 2 },
    { id: "entrees", name: "Entrées", displayOrder: 1 },
    { id: "burgers", name: "Burgers", displayOrder: 2 },
  ])

  assert.deepEqual(sorted.map((category) => category.id), ["entrees", "burgers", "pizzas", "desserts"])
})
