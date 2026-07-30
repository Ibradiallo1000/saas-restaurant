import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  calculateKitchenActiveQuantity,
  classifyKitchenOrderReadState,
  countKitchenColumns,
  groupKitchenItems,
  isKitchenReadSaturated,
  selectKitchenColumns,
  sortKitchenGroups,
  sortKitchenItems,
  toKitchenOrderItemView,
} from "../../src/modules/kitchen/canonical-read/selectors.ts"
import { resolveKitchenCanonicalReadMode } from "../../src/modules/kitchen/canonical-read/feature-flag.ts"

const parent = {
  restaurantId: "restaurant-a",
  orderId: "order-a",
  orderType: "table",
  tableNumber: "T4",
  orderNumber: "CMD-001",
  customerName: "Awa",
  createdAt: 1000,
  canonicalItemCount: 2,
  canonicalProjectionCount: 2,
  preparationModes: new Set(["kitchen"]),
}

function raw(overrides = {}) {
  return {
    id: overrides.id ?? "item-a",
    data: {
      restaurantId: "restaurant-a",
      orderId: "order-a",
      productId: "product-a",
      nameSnapshot: "Pizza",
      quantity: 3,
      cancelledQuantity: 0,
      servedQuantity: 0,
      status: "pending",
      version: 1,
      preparationMode: "kitchen",
      createdAt: 1000,
      updatedAt: 1100,
      ...overrides,
    },
  }
}

function view(overrides = {}, parentOverrides = {}) {
  return toKitchenOrderItemView(raw(overrides), { ...parent, ...parentOverrides }, 2000)
}

describe("LOT 4.2 — lecture canonique Cuisine", () => {
  it("1. sélectionne preparationMode kitchen", () => {
    assert.equal(view()?.preparationMode, "kitchen")
  })

  it("2. exclut une ligne Bar", () => {
    assert.equal(view({ preparationMode: "bar" }), null)
  })

  it("3. exclut une ligne service direct", () => {
    assert.equal(view({ preparationMode: "direct" }), null)
  })

  it("4. conserve une ligne pending", () => {
    assert.equal(view({ status: "pending" })?.status, "pending")
  })

  it("5. conserve une ligne preparing", () => {
    assert.equal(view({ status: "preparing" })?.status, "preparing")
  })

  it("6. conserve une ligne ready", () => {
    assert.equal(view({ status: "ready" })?.status, "ready")
  })

  it("7. exclut une ligne served", () => {
    assert.equal(view({ status: "served" }), null)
  })

  it("8. exclut une annulation totale", () => {
    assert.equal(view({ quantity: 3, cancelledQuantity: 3 }), null)
  })

  it("9. conserve une annulation partielle", () => {
    assert.equal(view({ quantity: 3, cancelledQuantity: 1 })?.activeQuantity, 2)
  })

  it("10. calcule quantity moins cancelledQuantity", () => {
    assert.equal(calculateKitchenActiveQuantity({ quantity: 8, cancelledQuantity: 3 }), 5)
  })

  it("11. ne retire pas servedQuantity du besoin ready", () => {
    const item = view({ status: "ready", quantity: 5, cancelledQuantity: 1, servedQuantity: 2 })
    assert.equal(item?.activeQuantity, 4)
  })

  it("12. regroupe les lignes par orderId", () => {
    const first = view()
    const second = view({ id: "item-b", orderId: "order-b" }, { orderId: "order-b" })
    assert.equal(groupKitchenItems([first, second].filter(Boolean)).length, 2)
  })

  it("13. trie les commandes par ancienneté puis identifiant", () => {
    const first = groupKitchenItems([view()].filter(Boolean))[0]
    const second = { ...first, orderId: "order-b", createdAt: 500 }
    assert.equal(sortKitchenGroups([first, second])[0].orderId, "order-b")
  })

  it("14. trie les lignes de façon stable", () => {
    const first = view({ id: "item-b", createdAt: 1000 })
    const second = view({ id: "item-a", createdAt: 1000 })
    assert.equal(sortKitchenItems([first, second].filter(Boolean))[0].orderItemId, "item-a")
  })

  it("15. détecte une commande mixte depuis le contexte parent", () => {
    const modes = new Map([["order-a", new Set(["kitchen", "direct"])]])
    assert.equal(groupKitchenItems([view()].filter(Boolean), modes)[0].isMixed, true)
  })

  it("16. calcule les compteurs et les trois colonnes", () => {
    const items = [
      view(),
      view({ id: "item-b", status: "preparing" }),
      view({ id: "item-c", status: "ready" }),
    ].filter(Boolean)
    assert.deepEqual(countKitchenColumns(items), { pending: 1, preparing: 1, ready: 1 })
    assert.equal(selectKitchenColumns(groupKitchenItems(items)).ready.length, 1)
  })

  it("17. classe une commande uniquement items[] en lecture seule legacy", () => {
    assert.equal(classifyKitchenOrderReadState({
      canonicalItemCount: 0,
      canonicalProjectionCount: 2,
      canonicalDocumentsFound: 0,
    }), "legacy_read_only")
  })

  it("18. protège une projection canonicalItemCount incohérente", () => {
    const item = view({}, { canonicalItemCount: 3, canonicalProjectionCount: 2 })
    assert.equal(item?.legacyState, "canonical_inconsistent")
    assert.equal(item?.actionsAllowed, false)
  })

  it("19. expose la saturation à la limite exacte", () => {
    assert.equal(isKitchenReadSaturated(199, 200), false)
    assert.equal(isKitchenReadSaturated(200, 200), true)
  })

  it("20. ignore un document Firestore mal formé", () => {
    assert.equal(view({ quantity: "trois" }), null)
  })

  it("21. traite une ligne LOT 1 sans version explicite comme version 1", () => {
    assert.equal(view({ version: undefined })?.version, 1)
  })

  it("22. active canonical par défaut et conserve un rollback legacy ciblable", () => {
    assert.equal(resolveKitchenCanonicalReadMode("restaurant-a", {
      mode: "canonical",
      restaurantAllowlist: [],
    }), "canonical")
    assert.equal(resolveKitchenCanonicalReadMode("restaurant-a", {
      mode: "legacy",
      restaurantAllowlist: ["restaurant-a"],
    }), "legacy")
    assert.equal(resolveKitchenCanonicalReadMode("restaurant-b", {
      mode: "canonical",
      restaurantAllowlist: ["restaurant-a"],
    }), "legacy")
  })
})
