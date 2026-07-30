import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { afterEach, describe, it } from "node:test"

import {
  adaptCanonicalGroupsToKitchenBoard,
} from "../../src/modules/kitchen/canonical-read/kitchen-board-adapter.ts"
import {
  executeKitchenItemsTransition,
  executeKitchenItemTransition,
  KitchenCommandClientError,
} from "../../src/modules/kitchen/canonical-read/kitchen-command-client.ts"

const boardSource = read("src/modules/kitchen/KitchenBoard.tsx")
const cardSource = read("src/modules/kitchen/KitchenOrderCard.tsx")
const clientSource = read("src/app/(dashboard)/kitchen/components/KitchenClient.tsx")
const viewModelSource = read("src/modules/kitchen/kitchen-view-model.tsx")
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("migration complète de la Cuisine canonique", () => {
  it("adapte une commande par statut de ligne sans fusionner les cycles", () => {
    const orders = adaptCanonicalGroupsToKitchenBoard([group([
      item("line-pending", "pending"),
      item("line-ready", "ready"),
    ])])
    assert.equal(orders.length, 2)
    assert.deepEqual(orders.map((order) => order.kitchenStatus), ["pending", "ready"])
    assert.deepEqual(orders.map((order) => order.items.length), [1, 1])
  })

  it("conserve l’identité de la commande pour une commande mixte", () => {
    const orders = adaptCanonicalGroupsToKitchenBoard([{ ...group([item("line", "pending")]), isMixed: true }])
    assert.equal(orders[0].__canonicalOrderId, "order-a")
    assert.equal(orders[0].id, "order-a:pending")
  })

  it("appelle la route LOT 4.1 avec identité serveur et payload minimal", async () => {
    let request
    globalThis.fetch = async (url, init) => {
      request = { url, init }
      return new Response(JSON.stringify({ ok: true, result: { version: 2 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    await executeKitchenItemTransition({
      user: { getIdToken: async () => "firebase-token" },
      restaurantId: "restaurant-a",
      orderId: "order-a",
      orderItemId: "line-a",
      expectedVersion: 1,
      targetStatus: "preparing",
      idempotencyKey: "stable-key-0001",
    })
    assert.equal(request.url, "/api/restaurants/restaurant-a/orders/order-a/commands")
    assert.equal(request.init.headers.authorization, "Bearer firebase-token")
    assert.deepEqual(JSON.parse(request.init.body), {
      command: "MARK_ORDER_ITEM_PREPARING",
      orderItemId: "line-a",
      idempotencyKey: "stable-key-0001",
      expectedVersion: 1,
    })
  })

  it("mappe Prête vers MARK_ORDER_ITEM_READY", async () => {
    let command
    globalThis.fetch = async (_url, init) => {
      command = JSON.parse(init.body).command
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    await executeKitchenItemTransition({
      user: { getIdToken: async () => "token" },
      restaurantId: "restaurant-a",
      orderId: "order-a",
      orderItemId: "line-a",
      expectedVersion: 2,
      targetStatus: "ready",
    })
    assert.equal(command, "MARK_ORDER_ITEM_READY")
  })

  it("propage un code métier stable retourné par la frontière", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: { code: "CONCURRENT_MODIFICATION", message: "Version obsolète.", retryable: true },
    }), { status: 409 })
    await assert.rejects(
      () => executeKitchenItemTransition({
        user: { getIdToken: async () => "token" },
        restaurantId: "restaurant-a",
        orderId: "order-a",
        orderItemId: "line-a",
        expectedVersion: 1,
        targetStatus: "preparing",
      }),
      (error) =>
        error instanceof KitchenCommandClientError &&
        error.code === "CONCURRENT_MODIFICATION" &&
        error.retryable
    )
  })

  it("met à jour indépendamment toutes les lignes Cuisine d’un groupe", async () => {
    const calls = []
    await executeKitchenItemsTransition({
      user: {},
      restaurantId: "restaurant-a",
      orderId: "order-a",
      targetStatus: "preparing",
      items: [
        { orderItemId: "line-a", expectedVersion: 1 },
        { orderItemId: "line-b", expectedVersion: 3 },
      ],
      execute: async (input) => { calls.push(input); return { ok: true } },
    })
    assert.deepEqual(calls.map((call) => [call.orderItemId, call.expectedVersion]), [
      ["line-a", 1],
      ["line-b", 3],
    ])
  })

  it("refuse une action sans ligne Cuisine active", async () => {
    await assert.rejects(
      () => executeKitchenItemsTransition({
        user: {},
        restaurantId: "restaurant-a",
        orderId: "order-a",
        targetStatus: "ready",
        items: [],
      }),
      (error) => error.code === "ORDER_ITEM_NOT_FOUND"
    )
  })

  it("retire toute écriture Firestore directe et tout moteur Stock de KitchenBoard", () => {
    assert.doesNotMatch(boardSource, /updateDoc|writeBatch|runTransaction|serverTimestamp|arrayUnion/)
    assert.doesNotMatch(boardSource, /markOrderItemAsServedAndDeductStock|stockBalancesV2/)
    assert.doesNotMatch(boardSource, /from "firebase\/firestore"/)
  })

  it("ne propose plus Servir, Paiement, Récupérer ou Terminer comme action Cuisine", () => {
    assert.match(cardSource, /proposedNextStatus === "preparing" \|\| proposedNextStatus === "ready"/)
    assert.doesNotMatch(viewModelSource, /served:\s*"Servir"/)
    assert.doesNotMatch(viewModelSource, /picked_up:\s*"R/)
    assert.doesNotMatch(viewModelSource, /completed:\s*"Terminer"/)
  })

  it("active la lecture canonique et conserve OrdersProvider seulement pour rollback legacy", () => {
    assert.match(clientSource, /mode !== "legacy"/)
    assert.match(clientSource, /CanonicalKitchenPageContent/)
    assert.match(clientSource, /<OrdersProvider/)
    assert.match(clientSource, /<LegacyKitchenPageContent/)
  })

  it("conserve le son de nouvelle commande dans le pipeline KitchenBoard", () => {
    assert.match(boardSource, /playNewOrderNotificationSound\(\)/)
    assert.match(boardSource, /entrySoundOrderIdsRef/)
  })

  it("limite l’écran canonique à trois colonnes opérationnelles", () => {
    assert.match(boardSource, /xl:grid-cols-3/)
    assert.doesNotMatch(boardSource, /title:\s*"Servies"/)
  })
})

function item(orderItemId, status) {
  return {
    restaurantId: "restaurant-a",
    orderId: "order-a",
    orderItemId,
    productId: `product-${orderItemId}`,
    productName: "Pizza",
    quantity: 1,
    activeQuantity: 1,
    cancelledQuantity: 0,
    servedQuantity: 0,
    status,
    version: 1,
    preparationMode: "kitchen",
    variants: [],
    supplements: [],
    customerNote: null,
    orderType: "table",
    tableNumber: "4",
    orderNumber: "CMD-001",
    customerName: null,
    createdAt: 1000,
    updatedAt: 1000,
    elapsedTime: 0,
    legacyState: "canonical",
    actionsAllowed: true,
  }
}

function group(items) {
  return {
    orderId: "order-a",
    restaurantId: "restaurant-a",
    orderType: "table",
    tableNumber: "4",
    orderNumber: "CMD-001",
    customerName: null,
    createdAt: 1000,
    isMixed: false,
    legacyState: "canonical",
    items,
  }
}

function read(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

