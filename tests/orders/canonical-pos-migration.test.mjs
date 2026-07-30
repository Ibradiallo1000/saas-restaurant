import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  mergeCanonicalPosOrders,
} from "../../src/modules/pos/canonical/pos-selectors.ts"
import {
  resolvePosCanonicalMode,
} from "../../src/modules/pos/canonical/feature-flag.ts"
import {
  handlePosCommandRequest,
} from "../../src/server/orders/pos-command/handler.ts"

const posPath = "src/app/(dashboard)/pos/components/POSClient.tsx"

test("le POS remplace items[] par les orderItems canoniques", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "order-1", items: [{ id: "legacy" }], canonicalItemCount: 1 }],
    [{ orderId: "order-1", orderItemId: "line-1", createdAt: new Date(0) }]
  )
  assert.equal(order.items.length, 1)
  assert.equal(order.items[0].orderItemId, "line-1")
  assert.equal(order.__canonicalPos, true)
})

test("une commande uniquement legacy reste en lecture seule", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "legacy", items: [{ id: "old" }] }],
    []
  )
  assert.equal(order.__legacyReadOnly, true)
})

test("une commande mixte conserve toutes ses lignes canoniques", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "mixed", canonicalItemCount: 3 }],
    [
      { orderId: "mixed", orderItemId: "k", preparationMode: "kitchen" },
      { orderId: "mixed", orderItemId: "b", preparationMode: "bar" },
      { orderId: "mixed", orderItemId: "d", preparationMode: "direct" },
    ]
  )
  assert.deepEqual(new Set(order.items.map((item) => item.preparationMode)), new Set(["kitchen", "bar", "direct"]))
})

test("détecte une projection canonique incomplète", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "order-1", canonicalItemCount: 2 }],
    [{ orderId: "order-1", orderItemId: "line-1" }]
  )
  assert.equal(order.__canonicalIncomplete, true)
})

test("le feature flag couvre canonical, legacy, compare et allowlist", () => {
  assert.equal(resolvePosCanonicalMode("r1", { mode: "canonical", restaurantAllowlist: [] }), "canonical")
  assert.equal(resolvePosCanonicalMode("r1", { mode: "legacy", restaurantAllowlist: [] }), "legacy")
  assert.equal(resolvePosCanonicalMode("r1", { mode: "compare", restaurantAllowlist: [] }), "compare")
  assert.equal(resolvePosCanonicalMode("r2", { mode: "canonical", restaurantAllowlist: ["r1"] }), "legacy")
})

test("le POS canonique sert exclusivement via MARK_ORDER_ITEM_SERVED", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /command:\s*"MARK_ORDER_ITEM_SERVED"/)
  assert.match(source, /expectedVersion:/)
  assert.match(source, /quantityToServe/)
})

test("le POS canonique encaisse exclusivement via CONFIRM_ORDER_PAYMENT", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /command:\s*"CONFIRM_ORDER_PAYMENT"/)
  assert.match(source, /expectedPaymentVersion/)
  assert.match(source, /receivedAmount/)
})

test("le paiement canonique ne sert aucune ligne et ne retire aucun Stock", async () => {
  const source = await readFile(
    "src/server/orders/commands/transitions.ts",
    "utf8"
  )
  const start = source.indexOf("export function planPayment")
  const payment = source.slice(start)
  assert.match(payment, /itemUpdate:\s*null/)
  assert.match(payment, /stock:\s*null/)
})

test("le service canonique porte le plan Stock sans modifier le paiement", async () => {
  const source = await readFile(
    "src/server/orders/commands/transitions.ts",
    "utf8"
  )
  const start = source.indexOf("export function planServed")
  const end = source.indexOf("export function planCancellation")
  const served = source.slice(start, end)
  assert.match(served, /plan\.stock/)
  assert.doesNotMatch(served, /paymentStatus/)
})

test("aucune permission d’écriture orderItems n’est accordée au POS", async () => {
  const rules = await readFile("firestore.rules", "utf8")
  const groupRule = rules.slice(rules.indexOf("match /{path=**}/orderItems"))
  assert.match(groupRule, /allow list:/)
  assert.doesNotMatch(groupRule.slice(0, groupRule.indexOf("match /{document=**}")), /allow (create|update|write)/)
})

test("la frontière serveur ignore actorId et actorRole injectés", async () => {
  let captured
  const response = await handlePosCommandRequest(
    request({
      command: "MARK_ORDER_ITEM_SERVED",
      orderItemId: "line-1",
      expectedVersion: 1,
      quantityToServe: 1,
      idempotencyKey: "serve-order-1-line-1",
      actorId: "attacker",
      actorRole: "owner",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input) => {
      captured = { command, input }
      return result("MarkOrderItemServed", "line-1")
    })
  )
  assert.equal(response.status, 200)
  assert.equal(captured.input.actor.id, "cashier-1")
  assert.equal(captured.input.actor.role, "cashier")
})

test("une ligne pending Cuisine est refusée par le moteur de transitions", async () => {
  const response = await handlePosCommandRequest(
    request({
      command: "MARK_ORDER_ITEM_SERVED",
      orderItemId: "line-1",
      expectedVersion: 1,
      quantityToServe: 1,
      idempotencyKey: "serve-order-1-line-1",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input, transition) =>
      transition(state({ status: "pending", preparationMode: "kitchen" }), input)
    )
  )
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, "INVALID_TRANSITION")
})

test("une ligne ready peut être servie par la frontière POS", async () => {
  const response = await handlePosCommandRequest(
    request({
      command: "MARK_ORDER_ITEM_SERVED",
      orderItemId: "line-1",
      expectedVersion: 1,
      quantityToServe: 1,
      idempotencyKey: "serve-order-1-line-1",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input, transition) => {
      const plan = transition(state({ status: "ready" }), input)
      assert.equal(plan.itemUpdate.status, "served")
      assert.ok(plan.stock)
      return result(command, "line-1")
    })
  )
  assert.equal(response.status, 200)
})

test("la confirmation paiement reconstruit l’acteur côté serveur", async () => {
  let captured
  const response = await handlePosCommandRequest(
    request({
      command: "CONFIRM_ORDER_PAYMENT",
      expectedPaymentVersion: 1,
      expectedAmount: 1000,
      receivedAmount: 1500,
      method: "cash",
      provider: null,
      externalReference: null,
      cashSessionId: "cash-session-1",
      idempotencyKey: "payment-order-1-v1",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input) => {
      captured = input
      return result(command, null)
    })
  )
  assert.equal(response.status, 200)
  assert.equal(captured.actor.id, "cashier-1")
  assert.equal(captured.sourceChannel, "pos")
})

test("la route répartit Cuisine et POS sans dupliquer le moteur", async () => {
  const source = await readFile(
    "src/app/api/restaurants/[restaurantId]/orders/[orderId]/commands/route.ts",
    "utf8"
  )
  assert.match(source, /POS_COMMANDS/)
  assert.match(source, /handlePosCommandRequest/)
  assert.match(source, /handleKitchenCommandRequest/)
  assert.match(source, /FirestoreAtomicOrderCommandStore/)
})

function request(body) {
  return new Request("http://localhost/commands", {
    method: "POST",
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function dependencies(execute) {
  return {
    store: { execute },
    verifyIdToken: async () => ({ uid: "cashier-1" }),
    resolveStaffPrincipal: async () => ({
      kind: "staff",
      uid: "cashier-1",
      roles: ["cashier"],
    }),
    requestId: () => "request-1",
    log: { info() {}, error() {} },
  }
}

function result(commandName, orderItemId) {
  return {
    ok: true,
    commandName,
    orderId: "order-1",
    orderItemId,
    status: "APPLIED",
    version: 2,
    replayed: false,
  }
}

function state(itemOverrides = {}) {
  const item = {
    id: "line-1",
    orderId: "order-1",
    restaurantId: "restaurant-1",
    productId: "product-1",
    preparationMode: "kitchen",
    status: "ready",
    quantity: 1,
    servedQuantity: 0,
    cancelledQuantity: 0,
    version: 1,
    ...itemOverrides,
  }
  return {
    order: {
      id: "order-1",
      restaurantId: "restaurant-1",
      paymentStatus: "unpaid",
      paymentVersion: 1,
      totalAmount: 1000,
      total: 1000,
      hasUnaggregatedCancellation: false,
      orderStatus: "ready",
      kitchenStatus: "ready",
      aggregateVersion: 1,
      orderAggregate: null,
      embeddedItems: null,
      canonicalItemCount: 1,
    },
    item,
    items: [item],
  }
}
