import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test, { after, beforeEach } from "node:test"

import {
  handleServedOrderItemsForAutomaticStock,
} from "../../../functions/src/stock-automatic-simple.ts"

const requireFromFunctions = createRequire(
  new URL("../../../functions/package.json", import.meta.url)
)
const { deleteApp, getApps, initializeApp } = requireFromFunctions("firebase-admin/app")
const { getFirestore } = requireFromFunctions("firebase-admin/firestore")
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const integration = emulatorHost ? test : test.skip
const projectId = "oordera-served-stock-test"
const restaurantId = "restaurant-served"
const productId = "product-coca"
const articleId = "article-coca"
const orderId = "order-coca"
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ projectId })
const db = getFirestore(app)

function line(overrides = {}) {
  return {
    id: "line-coca",
    productId,
    quantity: 2,
    status: "pending",
    preparationMode: "direct",
    ...overrides,
  }
}

function event(items) {
  return { items }
}

async function seed(overrides = {}) {
  const root = db.collection("restaurants").doc(restaurantId)
  await Promise.all([
    root.collection("products").doc(productId).set({ name: "Coca cola" }),
    root.collection("stockItemsV2").doc(articleId).set({
      restaurantId,
      name: "Coca Cola",
      status: "active",
      trackingMode: overrides.trackingMode ?? "AUTOMATIC_SIMPLE",
      baseUnit: "unit",
    }),
    root.collection("stockBalancesV2").doc(articleId).set({
      restaurantId,
      articleId,
      quantity: 20,
      unit: "unit",
      version: 1,
    }),
    ...(overrides.association === false
      ? []
      : [
          root.collection("stockAutomaticAssociationsV2").doc("coca-link").set({
            restaurantId,
            productId,
            articleId,
            quantity: 1,
            unit: "unit",
            status: overrides.associationStatus ?? "active",
          }),
        ]),
  ])
}

async function invokeHandler(beforeOrder, afterOrder) {
  return handleServedOrderItemsForAutomaticStock({
    db,
    restaurantId,
    orderId,
    before: beforeOrder,
    after: afterOrder,
    enabled: true,
    restaurantAllowlist: [restaurantId],
    articleAllowlist: [],
  })
}

async function balance() {
  return (await db.collection("restaurants").doc(restaurantId)
    .collection("stockBalancesV2").doc(articleId).get()).data()
}

beforeEach(async () => {
  if (!emulatorHost) return
  await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" }
  )
})

after(async () => {
  if (emulatorHost) await deleteApp(app)
})

integration("transaction réelle émulateur : 2 Coca Cola servis, 20 vers 18", async () => {
  await seed()
  const result = await invokeHandler(event([line()]), event([line({ status: "served" })]))
  assert.equal(result.deductions, 1)
  assert.equal((await balance()).quantity, 18)
  const root = db.collection("restaurants").doc(restaurantId)
  assert.equal((await root.collection("stockOperationsV2").get()).size, 1)
  assert.equal((await root.collection("stockIdempotencyV2").get()).size, 1)
})

integration("rejeu du même événement : une seule déduction", async () => {
  await seed()
  const beforeOrder = event([line()])
  const afterOrder = event([line({ status: "served" })])
  await invokeHandler(beforeOrder, afterOrder)
  await invokeHandler(beforeOrder, afterOrder)
  assert.equal((await balance()).quantity, 18)
  assert.equal((await db.collection("restaurants").doc(restaurantId)
    .collection("stockOperationsV2").get()).size, 1)
})

integration("service partiel : chaque incrément est déduit une fois", async () => {
  await seed()
  await invokeHandler(
    event([line({ servedQuantity: 0 })]),
    event([line({ servedQuantity: 1 })])
  )
  await invokeHandler(
    event([line({ servedQuantity: 1 })]),
    event([line({ servedQuantity: 2 })])
  )
  assert.equal((await balance()).quantity, 18)
})

integration("événements servis reçus hors ordre : aucune sur-déduction", async () => {
  await seed()
  await invokeHandler(
    event([line({ servedQuantity: 0 })]),
    event([line({ servedQuantity: 2 })])
  )
  await invokeHandler(
    event([line({ servedQuantity: 0 })]),
    event([line({ servedQuantity: 1 })])
  )
  assert.equal((await balance()).quantity, 18)
})

integration("produit sans association : anomalie explicite et stock intact", async () => {
  await seed({ association: false })
  const result = await invokeHandler(event([line()]), event([line({ status: "served" })]))
  assert.equal(result.anomalies, 1)
  assert.equal((await balance()).quantity, 20)
  const anomalies = await db.collection("restaurants").doc(restaurantId)
    .collection("stockAutomaticAnomaliesV2").get()
  assert.equal(anomalies.docs[0].data().type, "MISSING_ASSOCIATION")
})

integration("association inactive : aucune déduction", async () => {
  await seed({ associationStatus: "inactive" })
  await invokeHandler(event([line()]), event([line({ status: "served" })]))
  assert.equal((await balance()).quantity, 20)
})

integration("article manuel : anomalie et aucune déduction", async () => {
  await seed({ trackingMode: "CONTROLLED" })
  const result = await invokeHandler(event([line()]), event([line({ status: "served" })]))
  assert.equal(result.anomalies, 1)
  assert.equal((await balance()).quantity, 20)
})
