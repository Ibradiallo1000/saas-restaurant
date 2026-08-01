import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import { FirestoreCashSessionClose } from "../../src/server/finance/firestore-cash-session-close.ts"
import { FirestoreCashSessionOpen } from "../../src/server/finance/firestore-cash-session-open.ts"
import { FirestoreAtomicOrderCreationStore } from "../../src/server/orders/create/firestore-store.ts"
import { createCanonicalOrder } from "../../src/server/orders/create/service.ts"
import { FirestorePaymentLedger } from "../../src/server/finance/firestore-payment-ledger.ts"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
let app
let db

before(() => {
  if (!enabled) return
  app = initializeApp({ projectId: "pos-stations-transaction" }, `pos-stations-${Date.now()}`)
  db = getFirestore(app)
})
after(async () => { if (app) await deleteApp(app) })

async function seedRestaurant(suffix, { stations = [], cashiers = [] } = {}) {
  const restaurantId = `restaurant-${suffix}-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.set({ ownerId: "owner" })
  await Promise.all(cashiers.map(({ id, ...data }) => Promise.all([
    root.collection("staff").doc(id).set({ role: "cashier", active: true, name: id, ...data }),
    db.collection("users").doc(id).set({ restaurantId, role: "cashier", active: true }),
  ])))
  await Promise.all(stations.map(({ id, ...data }) => root.collection("posStations").doc(id).set({
    name: id, code: id.toUpperCase(), isActive: true, catalogMode: "ALL",
    allowedCategoryIds: [], allowedProductIds: [], excludedProductIds: [], activeSessionId: null,
    ...data,
  })))
  return { restaurantId, root }
}

function open(service, restaurantId, cashierId, posStationId) {
  return service.open({ restaurantId, cashierId, requestedBy: cashierId, requestedByRole: "cashier", posStationId, deviceInstanceId: "device-a", openingBalance: 0 })
}

test("un restaurant sans poste ouvre DEFAULT et une ancienne session reste compatible", { skip: !enabled }, async () => {
  const { restaurantId, root } = await seedRestaurant("default", { cashiers: [{ id: "cashier-a" }] })
  const service = new FirestoreCashSessionOpen(db)
  const result = await open(service, restaurantId, "cashier-a")
  assert.equal(result.session.posStationId, "DEFAULT")
  assert.equal(result.session.posCatalogScopeSnapshot.mode, "ALL")
  assert.equal((await root.get()).data().defaultPosStationActiveSessionId, result.sessionId)

  const replay = await service.open({ restaurantId, cashierId: "cashier-a", requestedBy: "cashier-a", requestedByRole: "cashier", deviceInstanceId: "device-b" })
  assert.equal(replay.replayed, true)
  assert.equal(replay.sessionId, result.sessionId)
})

test("une ancienne demande-session sans posStationId est activée en place sur DEFAULT", { skip: !enabled }, async () => {
  const { restaurantId, root } = await seedRestaurant("legacy", { cashiers: [{ id: "cashier-a" }] })
  await root.collection("cashSessions").doc("legacy-request").set({ cashierId: "cashier-a", status: "pending", openingBalance: 500 })
  const result = await new FirestoreCashSessionOpen(db).open({
    restaurantId, cashierId: "cashier-a", requestedBy: "cashier-a", requestedByRole: "cashier",
    legacySessionId: "legacy-request", deviceInstanceId: "device-a", openingBalance: 500,
  })
  assert.equal(result.sessionId, "legacy-request")
  const session = (await root.collection("cashSessions").doc("legacy-request").get()).data()
  assert.equal(session.status, "open")
  assert.equal(session.posStationId, "DEFAULT")
})

test("affectation, poste inactif et poste non autorisé sont contrôlés", { skip: !enabled }, async () => {
  const { restaurantId } = await seedRestaurant("permissions", {
    stations: [{ id: "restaurant" }, { id: "bar", isActive: false }],
    cashiers: [{ id: "cashier-a", allowedPosStationIds: ["restaurant"], defaultPosStationId: "restaurant" }],
  })
  const service = new FirestoreCashSessionOpen(db)
  await assert.rejects(open(service, restaurantId, "cashier-a", "bar"), (error) => error.code === "POS_STATION_FORBIDDEN")

  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("staff").doc("cashier-a").update({ allowedPosStationIds: ["bar"], defaultPosStationId: "bar" })
  await assert.rejects(open(service, restaurantId, "cashier-a", "bar"), (error) => error.code === "POS_STATION_INACTIVE")
})

test("les ouvertures concurrentes verrouillent le poste et le caissier", { skip: !enabled }, async () => {
  const { restaurantId } = await seedRestaurant("locks", {
    stations: [{ id: "main" }, { id: "second" }],
    cashiers: [
      { id: "cashier-a", allowedPosStationIds: ["main", "second"] },
      { id: "cashier-b", allowedPosStationIds: ["main"] },
    ],
  })
  const service = new FirestoreCashSessionOpen(db)
  const results = await Promise.allSettled([
    open(service, restaurantId, "cashier-a", "main"),
    open(service, restaurantId, "cashier-b", "main"),
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(results.filter((result) => result.status === "rejected").length, 1)

  if (results[0].status === "fulfilled") {
    const sameCashier = await service.open({ restaurantId, cashierId: "cashier-a", requestedBy: "cashier-a", requestedByRole: "cashier", posStationId: "second", deviceInstanceId: "device-b" })
    assert.equal(sameCashier.replayed, true)
    assert.equal(sameCashier.sessionId, results[0].value.sessionId)
  }
})

test("la clôture libère atomiquement le poste configuré", { skip: !enabled }, async () => {
  const { restaurantId, root } = await seedRestaurant("close", {
    stations: [{ id: "main" }],
    cashiers: [{ id: "cashier-a", allowedPosStationIds: ["main"] }],
  })
  const opened = await open(new FirestoreCashSessionOpen(db), restaurantId, "cashier-a", "main")
  assert.equal((await root.collection("posStations").doc("main").get()).data().activeSessionId, opened.sessionId)
  await new FirestoreCashSessionClose(db).close({ restaurantId, sessionId: opened.sessionId, cashierId: "cashier-a", countedPhysicalCash: 0, retainedFloat: 0, idempotencyKey: "close-main" })
  assert.equal((await root.collection("posStations").doc("main").get()).data().activeSessionId, null)
  const session = (await root.collection("cashSessions").doc(opened.sessionId).get()).data()
  assert.equal(session.closeSnapshot.posStationId, "main")
})

test("la commande et le paiement utilisent l’instantané immuable de la session", { skip: !enabled }, async () => {
  const { restaurantId, root } = await seedRestaurant("catalog-snapshot", {
    stations: [{ id: "main", catalogMode: "RESTRICTED", allowedProductIds: ["meal"] }],
    cashiers: [{ id: "cashier-a", allowedPosStationIds: ["main"] }],
  })
  await root.update({ name: "Restaurant", status: "active", publicOrderingOpen: true })
  await Promise.all([
    root.collection("categories").doc("food").set({ name: "Plats", isActive: true, preparationMode: "kitchen" }),
    root.collection("products").doc("meal").set({ name: "Plat", price: 1000, isActive: true, categoryId: "food", preparationMode: "kitchen" }),
    root.collection("products").doc("drink").set({ name: "Boisson", price: 500, isActive: true, categoryId: "food", preparationMode: "bar" }),
  ])
  const opened = await open(new FirestoreCashSessionOpen(db), restaurantId, "cashier-a", "main")
  await root.collection("posStations").doc("main").update({ allowedProductIds: ["drink"] })
  const store = new FirestoreAtomicOrderCreationStore(db)
  const body = (productId, key) => ({ schemaVersion: 1, channel: "pos", serviceMode: "takeaway", clientRequestId: key, items: [{ clientLineId: `line-${key}`, productId, quantity: 1, options: [], instructions: null }], tableContext: null, customer: null, delivery: null, cashSessionId: opened.sessionId, notes: null })
  const created = await createCanonicalOrder({ store }, { restaurantId, body: body("meal", "allowed"), principal: { kind: "staff", uid: "cashier-a", roles: ["cashier"] }, idempotencyKey: "allowed_1234567890123456" })
  const order = (await root.collection("orders").doc(created.orderId).get()).data()
  assert.equal(order.originPosStationId, "main")
  await assert.rejects(createCanonicalOrder({ store }, { restaurantId, body: body("drink", "forbidden"), principal: { kind: "staff", uid: "cashier-a", roles: ["cashier"] }, idempotencyKey: "forbidden_1234567890123" }), (error) => error.code === "PRODUCT_NOT_ALLOWED_AT_STATION")

  await root.collection("orders").doc("qr-order").set({ channel: "qr_table", total: 1000 })
  await db.runTransaction((transaction) => new FirestorePaymentLedger(db).createConfirmedPaymentInTransaction(transaction, {
    restaurantId, paymentId: "qr-payment", orderId: "qr-order", sessionId: opened.sessionId, cashierId: "cashier-a", source: "qr_table", type: "cash", provider: null, amount: 1000, receivedAmount: 1000, changeDue: 0, externalReference: null, idempotencyKey: "qr-payment-key",
  }))
  const payment = (await root.collection("payments").doc("qr-payment").get()).data()
  assert.equal(payment.posStationId, "main")
  assert.equal(payment.posStationName, "main")
})
