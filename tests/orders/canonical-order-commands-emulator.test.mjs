import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import {
  FirestoreAtomicOrderCommandStore,
  confirmOrderPayment,
  markOrderItemPreparing,
  markOrderItemReady,
  markOrderItemServed,
} from "../../src/server/orders/commands/index.ts"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = "oordera-order-commands-lot2"
const restaurantId = "restaurant-lot2"
const orderId = "order-lot2"
const itemId = "item-coca"
const productId = "product-coca"
const articleId = "article-coca"
let app
let db

before(() => {
  if (!enabled) return
  app = initializeApp({ projectId }, `lot2-${Date.now()}`)
  db = getFirestore(app)
})

test("concurrence réelle : deux passages ready simultanés n'appliquent qu'une mutation", {
  skip: !enabled,
}, async () => {
  const suffix = Date.now().toString()
  const concurrentOrderId = `order-ready-${suffix}`
  const concurrentItemId = `item-ready-${suffix}`
  const root = db.collection("restaurants").doc(restaurantId)
  const orderRef = root.collection("orders").doc(concurrentOrderId)
  const itemRef = orderRef.collection("orderItems").doc(concurrentItemId)
  await orderRef.set({
    restaurantId,
    paymentStatus: "unpaid",
    paymentVersion: 1,
    orderStatus: "pending",
    kitchenStatus: "pending",
    aggregateVersion: 1,
    canonicalItemCount: 1,
    items: [{ id: concurrentItemId, orderItemId: concurrentItemId, status: "pending" }],
  })
  await itemRef.set({
    id: concurrentItemId,
    orderItemId: concurrentItemId,
    orderId: concurrentOrderId,
    restaurantId,
    productId: "pizza",
    preparationMode: "kitchen",
    status: "pending",
    quantity: 1,
    servedQuantity: 0,
    cancelledQuantity: 0,
    version: 1,
  })
  const store = new FirestoreAtomicOrderCommandStore(db)
  const command = (key) => markOrderItemReady({ store }, {
    restaurantId,
    orderId: concurrentOrderId,
    orderItemId: concurrentItemId,
    actor: { id: "kitchen-1", role: "kitchen", restaurantId },
    sourceChannel: "kitchen",
    idempotencyKey: key,
    expectedVersion: 1,
  })
  const results = await Promise.allSettled([
    command("ready-concurrent-a"),
    command("ready-concurrent-b"),
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal((await itemRef.get()).data().status, "ready")
  assert.equal((await orderRef.get()).data().orderStatus, "ready")
  assert.equal((await orderRef.get()).data().aggregateVersion, 2)
  assert.equal((await orderRef.collection("commandAudit").get()).size, 1)
})

after(async () => {
  if (app) await deleteApp(app)
})

test("transaction Admin LOT 2 : ligne, Stock, audit et idempotence sont atomiques", {
  skip: !enabled,
}, async () => {
  const root = db.collection("restaurants").doc(restaurantId)
  const orderRef = root.collection("orders").doc(orderId)
  const itemRef = orderRef.collection("orderItems").doc(itemId)
  await Promise.all([
    root.collection("products").doc(productId).set({ stockArticleId: articleId }),
    root.collection("stockItemsV2").doc(articleId).set({
      restaurantId,
      status: "active",
      trackingMode: "AUTOMATIC_SIMPLE",
    }),
    root.collection("stockBalancesV2").doc(articleId).set({
      restaurantId,
      articleId,
      quantity: 20,
      unit: "unit",
      version: 1,
    }),
    root.collection("stockAutomaticAssociationsV2")
      .doc(`${productId}--${articleId}`)
      .set({
        restaurantId,
        productId,
        articleId,
        quantity: 1,
        unit: "unit",
        status: "active",
      }),
    orderRef.set({
      restaurantId,
      paymentStatus: "unpaid",
      paymentVersion: 1,
      totalAmount: 1500,
      orderStatus: "ready",
      items: [{ id: itemId, status: "ready" }],
    }),
    itemRef.set({
      id: itemId,
      orderItemId: itemId,
      orderId,
      restaurantId,
      productId,
      preparationMode: "direct",
      status: "ready",
      quantity: 3,
      servedQuantity: 0,
      cancelledQuantity: 0,
      version: 1,
    }),
  ])

  const store = new FirestoreAtomicOrderCommandStore(db)
  const input = {
    restaurantId,
    orderId,
    orderItemId: itemId,
    actor: { id: "cashier-1", role: "cashier", restaurantId },
    sourceChannel: "pos",
    idempotencyKey: "lot2-service-idempotency",
    expectedVersion: 1,
    quantityToServe: 3,
  }
  const first = await markOrderItemServed({ store }, input)
  const replay = await markOrderItemServed({ store }, input)

  assert.equal(first.stock.deductedQuantity, 3)
  assert.equal(replay.replayed, true)
  assert.equal((await itemRef.get()).data().status, "served")
  assert.equal((await root.collection("stockBalancesV2").doc(articleId).get()).data().quantity, 17)
  assert.equal((await root.collection("stockOperationsV2").get()).size, 1)
  assert.equal((await root.collection("stockServingProgressV2").get()).size, 1)
  assert.equal((await root.collection("stockIdempotencyV2").get()).size, 1)
  assert.equal((await orderRef.collection("commandAudit").get()).size, 1)
  assert.equal(
    (
      await root
        .collection("orderCommandIdempotency")
        .where("orderId", "==", orderId)
        .get()
    ).size,
    1,
  )
  const parentAfter = (await orderRef.get()).data()
  assert.equal(parentAfter.orderStatus, "served")
  assert.equal(parentAfter.kitchenStatus, "served")
  assert.equal(parentAfter.items[0].status, "served")
  assert.equal(parentAfter.orderAggregate.allActiveItemsServed, true)
  assert.equal(parentAfter.aggregateVersion, 2)
})

test("parcours POS complet : création, Cuisine, service, Stock puis paiement completed", {
  skip: !enabled,
}, async () => {
  const suffix = Date.now().toString()
  const targetRestaurantId = `restaurant-pos-e2e-${suffix}`
  const root = db.collection("restaurants").doc(targetRestaurantId)
  const product = root.collection("products").doc("product-coca")
  const cashSession = root.collection("cashSessions").doc("cash-session")
  await Promise.all([
    root.set({
      name: "Restaurant POS",
      active: true,
      currency: "XOF",
      taxRate: 0,
      pricesIncludeTax: true,
      publicOrderingOpen: true,
    }),
    product.set({
      name: "Coca Cola",
      price: 500,
      active: true,
      preparationMode: "kitchen",
      stockArticleId: "article-coca",
    }),
    cashSession.set({ restaurantId: targetRestaurantId, status: "open" }),
    root.collection("stockItemsV2").doc("article-coca").set({
      restaurantId: targetRestaurantId,
      status: "active",
      trackingMode: "AUTOMATIC_SIMPLE",
    }),
    root.collection("stockBalancesV2").doc("article-coca").set({
      restaurantId: targetRestaurantId,
      articleId: "article-coca",
      quantity: 20,
      version: 1,
    }),
    root.collection("stockAutomaticAssociationsV2").doc("product-coca--article-coca").set({
      restaurantId: targetRestaurantId,
      productId: "product-coca",
      articleId: "article-coca",
      quantity: 1,
      unit: "unit",
      status: "active",
    }),
  ])
  const orderId = `order-pos-e2e-${suffix}`
  const orderItemId = `item-pos-e2e-${suffix}`
  const orderRef = root.collection("orders").doc(orderId)
  const itemRef = orderRef.collection("orderItems").doc(orderItemId)
  await Promise.all([
    orderRef.set({
      restaurantId: targetRestaurantId,
      source: "pos",
      paymentStatus: "unpaid",
      paymentVersion: 1,
      totalAmount: 1500,
      total: 1500,
      orderStatus: "pending",
      kitchenStatus: "pending",
      aggregateVersion: 1,
      canonicalItemCount: 1,
      items: [{ id: orderItemId, orderItemId, status: "pending", version: 1 }],
    }),
    itemRef.set({
      id: orderItemId,
      orderItemId,
      orderId,
      restaurantId: targetRestaurantId,
      productId: "product-coca",
      preparationMode: "kitchen",
      status: "pending",
      quantity: 3,
      servedQuantity: 0,
      cancelledQuantity: 0,
      version: 1,
    }),
  ])
  const commandStore = new FirestoreAtomicOrderCommandStore(db)
  const kitchenBase = {
    restaurantId: targetRestaurantId,
    orderId,
    orderItemId,
    actor: { id: "kitchen-e2e", role: "kitchen", restaurantId: targetRestaurantId },
    sourceChannel: "kitchen",
  }
  await markOrderItemPreparing({ store: commandStore }, {
    ...kitchenBase,
    idempotencyKey: `pos-e2e-preparing-${suffix}`,
    expectedVersion: 1,
  })
  await markOrderItemReady({ store: commandStore }, {
    ...kitchenBase,
    idempotencyKey: `pos-e2e-ready-${suffix}`,
    expectedVersion: 2,
  })
  await markOrderItemServed({ store: commandStore }, {
    restaurantId: targetRestaurantId,
    orderId,
    orderItemId,
    actor: { id: "cashier-e2e", role: "cashier", restaurantId: targetRestaurantId },
    sourceChannel: "pos",
    idempotencyKey: `pos-e2e-served-${suffix}`,
    expectedVersion: 3,
    quantityToServe: 3,
  })
  let parent = (await root.collection("orders").doc(orderId).get()).data()
  assert.equal(parent.orderStatus, "served")
  assert.equal(parent.paymentStatus, "unpaid")
  assert.equal((await root.collection("stockBalancesV2").doc("article-coca").get()).data().quantity, 17)
  await confirmOrderPayment({ store: commandStore }, {
    restaurantId: targetRestaurantId,
    orderId,
    actor: { id: "cashier-e2e", role: "cashier", restaurantId: targetRestaurantId },
    sourceChannel: "pos",
    idempotencyKey: `pos-e2e-payment-${suffix}`,
    expectedPaymentVersion: 1,
    expectedAmount: 1500,
    receivedAmount: 2000,
    method: "cash",
    provider: null,
    externalReference: null,
    cashSessionId: "cash-session",
  })
  parent = (await root.collection("orders").doc(orderId).get()).data()
  assert.equal(parent.orderStatus, "completed")
  assert.equal(parent.paymentStatus, "paid")
  assert.equal((await root.collection("payments").get()).size, 1)
  assert.equal((await root.collection("stockOperationsV2").get()).size, 1)
})

test("parcours inverse mixte : paiement, Cuisine, Bar et direct restent indépendants", {
  skip: !enabled,
}, async () => {
  const suffix = Date.now().toString()
  const targetRestaurantId = `restaurant-pos-mixed-${suffix}`
  const root = db.collection("restaurants").doc(targetRestaurantId)
  const orderId = `order-mixed-${suffix}`
  const orderRef = root.collection("orders").doc(orderId)
  const rows = [
    { id: `kitchen-${suffix}`, productId: "pizza", preparationMode: "kitchen", status: "pending" },
    { id: `bar-${suffix}`, productId: "juice", preparationMode: "bar", status: "ready" },
    { id: `direct-${suffix}`, productId: "water", preparationMode: "direct", status: "ready" },
  ]
  await Promise.all([
    root.set({ name: "Restaurant mixte", active: true }),
    root.collection("cashSessions").doc("cash-session").set({
      restaurantId: targetRestaurantId,
      status: "open",
    }),
    orderRef.set({
      restaurantId: targetRestaurantId,
      paymentStatus: "unpaid",
      paymentVersion: 1,
      totalAmount: 3000,
      total: 3000,
      orderStatus: "pending",
      kitchenStatus: "pending",
      aggregateVersion: 1,
      canonicalItemCount: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        orderItemId: row.id,
        status: row.status,
        servedQuantity: 0,
        cancelledQuantity: 0,
        quantity: 1,
        version: 1,
      })),
    }),
    ...rows.map((row) =>
      orderRef.collection("orderItems").doc(row.id).set({
        id: row.id,
        orderItemId: row.id,
        orderId,
        restaurantId: targetRestaurantId,
        productId: row.productId,
        preparationMode: row.preparationMode,
        status: row.status,
        quantity: 1,
        servedQuantity: 0,
        cancelledQuantity: 0,
        version: 1,
      })
    ),
  ])
  const commandStore = new FirestoreAtomicOrderCommandStore(db)
  const cashier = { id: "cashier-mixed", role: "cashier", restaurantId: targetRestaurantId }
  await confirmOrderPayment({ store: commandStore }, {
    restaurantId: targetRestaurantId,
    orderId,
    actor: cashier,
    sourceChannel: "pos",
    idempotencyKey: `mixed-payment-${suffix}`,
    expectedPaymentVersion: 1,
    expectedAmount: 3000,
    receivedAmount: 3000,
    method: "mobile_money",
    provider: "provider-test",
    externalReference: "external-test",
    cashSessionId: "cash-session",
  })
  let parent = (await orderRef.get()).data()
  assert.equal(parent.paymentStatus, "paid")
  assert.notEqual(parent.orderStatus, "completed")
  const kitchen = rows[0]
  const kitchenActor = { id: "kitchen-mixed", role: "kitchen", restaurantId: targetRestaurantId }
  await markOrderItemPreparing({ store: commandStore }, {
    restaurantId: targetRestaurantId,
    orderId,
    orderItemId: kitchen.id,
    actor: kitchenActor,
    sourceChannel: "kitchen",
    idempotencyKey: `mixed-preparing-${suffix}`,
    expectedVersion: 1,
  })
  await markOrderItemReady({ store: commandStore }, {
    restaurantId: targetRestaurantId,
    orderId,
    orderItemId: kitchen.id,
    actor: kitchenActor,
    sourceChannel: "kitchen",
    idempotencyKey: `mixed-ready-${suffix}`,
    expectedVersion: 2,
  })
  for (const row of rows) {
    await markOrderItemServed({ store: commandStore }, {
      restaurantId: targetRestaurantId,
      orderId,
      orderItemId: row.id,
      actor: cashier,
      sourceChannel: "pos",
      idempotencyKey: `mixed-serve-${row.id}`,
      expectedVersion: row.preparationMode === "kitchen" ? 3 : 1,
      quantityToServe: 1,
    })
    parent = (await orderRef.get()).data()
    if (row !== rows.at(-1)) assert.notEqual(parent.orderStatus, "completed")
  }
  parent = (await orderRef.get()).data()
  assert.equal(parent.orderStatus, "completed")
  assert.equal(parent.paymentStatus, "paid")
  assert.equal((await root.collection("stockOperationsV2").get()).size, 0)
})
