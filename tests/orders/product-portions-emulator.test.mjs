import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import { createCanonicalOrder } from "../../src/server/orders/create/service.ts"
import { FirestoreAtomicOrderCreationStore } from "../../src/server/orders/create/firestore-store.ts"
import { cancelOrderItemQuantity } from "../../src/server/orders/commands/service.ts"
import { FirestoreAtomicOrderCommandStore } from "../../src/server/orders/commands/firestore-store.ts"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = "oordera-product-portions"
const restaurantId = "restaurant-portions"
let app
let db

before(() => {
  if (!enabled) return
  app = initializeApp({ projectId }, `portions-${Date.now()}`)
  db = getFirestore(app)
})

after(async () => { if (app) await deleteApp(app) })

test("la dernière portion n'est attribuée qu'à une commande et une annulation admissible la restitue", { skip: !enabled }, async () => {
  const root = db.collection("restaurants").doc(restaurantId)
  await Promise.all([
    root.set({ name: "Test", status: "active", currency: "FCFA", publicOrderingOpen: true }),
    root.collection("categories").doc("mains").set({ name: "Plats", isActive: true, preparationMode: "kitchen" }),
    root.collection("products").doc("dish").set({
      name: "Plat du jour", price: 1000, isActive: true, categoryId: "mains", preparationMode: "kitchen",
      operationalAvailability: { state: "AVAILABLE" },
      portionControl: { enabled: true, available: 1 },
    }),
  ])
  const store = new FirestoreAtomicOrderCreationStore(db)
  const create = (suffix) => createCanonicalOrder({ store }, {
    restaurantId,
    principal: { kind: "staff", uid: `cashier-${suffix}`, roles: ["cashier"] },
    idempotencyKey: `portion_${suffix}_1234567890`,
    body: {
      schemaVersion: 1, channel: "pos", serviceMode: "takeaway", clientRequestId: `request-${suffix}`,
      items: [{ clientLineId: `line-${suffix}`, productId: "dish", quantity: 1, options: [], instructions: null }],
      tableContext: null, customer: null, delivery: null, cashSessionId: null, notes: null,
    },
  })
  const results = await Promise.allSettled([create("a"), create("b")])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const success = results.find((result) => result.status === "fulfilled").value
  const productAfterSale = (await root.collection("products").doc("dish").get()).data()
  assert.equal(productAfterSale.portionControl.available, 0)
  assert.equal(productAfterSale.operationalAvailability.state, "SOLD_OUT")

  const orderItem = (await root.collection("orders").doc(success.orderId).collection("orderItems").get()).docs[0]
  await cancelOrderItemQuantity({ store: new FirestoreAtomicOrderCommandStore(db) }, {
    restaurantId, orderId: success.orderId, orderItemId: orderItem.id,
    actor: { id: "manager-1", role: "manager", restaurantId }, sourceChannel: "pos",
    idempotencyKey: "restore_portion_123456", expectedVersion: 1, quantityToCancel: 1, reason: "Test",
  })
  const productAfterCancellation = (await root.collection("products").doc("dish").get()).data()
  assert.equal(productAfterCancellation.portionControl.available, 1)
  assert.equal(productAfterCancellation.operationalAvailability.state, "AVAILABLE")
})
