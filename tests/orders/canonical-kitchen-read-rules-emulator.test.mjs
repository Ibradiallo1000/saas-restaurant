import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test, { after, before } from "node:test"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const integration = enabled ? test : test.skip
const projectId = "oordera-kitchen-read-lot42"
const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8")
let environment

before(async () => {
  if (!enabled) return
  const [host, rawPort] = process.env.FIRESTORE_EMULATOR_HOST.split(":")
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(rawPort),
      rules,
    },
  })
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      db.doc("users/kitchen-a").set({
        restaurantId: "restaurant-a",
        role: "kitchen",
        active: true,
      }),
      db.doc("users/unattached").set({
        role: "kitchen",
        active: true,
      }),
      db.doc("users/cashier-a").set({
        restaurantId: "restaurant-a",
        role: "cashier",
        active: true,
      }),
      db.doc("restaurants/restaurant-a/staff/cashier-a").set({
        restaurantId: "restaurant-a",
        role: "cashier",
        active: true,
      }),
      db.doc("restaurants/restaurant-a/staff/kitchen-a").set({
        restaurantId: "restaurant-a",
        role: "kitchen",
        active: true,
      }),
      db.doc("users/manager-a").set({ restaurantId: "restaurant-a", role: "manager", active: true }),
      db.doc("restaurants/restaurant-a/staff/manager-a").set({ restaurantId: "restaurant-a", role: "manager", active: true }),
      db.doc("users/kitchen-station").set({ restaurantId: "restaurant-c", role: "kitchen", active: true }),
      db.doc("restaurants/restaurant-c/staff/kitchen-station").set({ restaurantId: "restaurant-c", role: "kitchen", active: true, allowedPreparationStationIds: ["hot"] }),
      db.doc("restaurants/restaurant-b/staff/kitchen-b").set({
        restaurantId: "restaurant-b",
        role: "kitchen",
        active: true,
      }),
      db.doc("restaurants/restaurant-a/orders/order-a/orderItems/item-kitchen").set(
        item("restaurant-a", "order-a", "kitchen", "pending")
      ),
      db.doc("restaurants/restaurant-a/orders/order-a/orderItems/item-bar").set(
        item("restaurant-a", "order-a", "bar", "pending")
      ),
      db.doc("restaurants/restaurant-a/orders/order-a/orderItems/item-served").set(
        item("restaurant-a", "order-a", "kitchen", "served")
      ),
      db.doc("restaurants/restaurant-c/orders/order-c/orderItems/item-hot").set({ ...item("restaurant-c", "order-c", "kitchen", "pending"), preparationStationId: "hot" }),
      db.doc("restaurants/restaurant-c/orders/order-c/orderItems/item-cold").set({ ...item("restaurant-c", "order-c", "kitchen", "pending"), preparationStationId: "cold" }),
      db.doc("restaurants/restaurant-b/orders/order-b/orderItems/item-other").set(
        item("restaurant-b", "order-b", "kitchen", "pending")
      ),
      db.doc("restaurants/restaurant-a/preparationIssues/issue-a").set({ restaurantId:"restaurant-a",orderId:"order-a",orderItemId:"item-kitchen",preparationStationId:"VIRTUAL_KITCHEN",status:"OPEN" }),
    ])
  })
})

after(async () => {
  await environment?.cleanup()
})

integration("Cuisine lit les orderItems actifs de son restaurant", async () => {
  const db = environment.authenticatedContext("kitchen-a").firestore()
  const snapshot = await assertSucceeds(getDocs(kitchenQuery(db, "restaurant-a")))
  assert.deepEqual(snapshot.docs.map((document) => document.id), ["item-kitchen"])
})

integration("Cuisine ne peut pas lire les orderItems d’un autre restaurant", async () => {
  const db = environment.authenticatedContext("kitchen-a").firestore()
  await assertFails(getDocs(kitchenQuery(db, "restaurant-b")))
})

integration("Cuisine affectée ne lit que son poste de préparation", async () => {
  const db = environment.authenticatedContext("kitchen-station").firestore()
  const snapshot = await assertSucceeds(getDocs(stationQuery(db, "restaurant-c", "hot")))
  assert.deepEqual(snapshot.docs.map((document) => document.id), ["item-hot"])
  await assertFails(getDocs(stationQuery(db, "restaurant-c", "cold")))
})

integration("une lecture collectionGroup non authentifiée est refusée", async () => {
  const db = environment.unauthenticatedContext().firestore()
  await assertFails(getDocs(kitchenQuery(db, "restaurant-a")))
})

integration("un staff non rattaché est refusé", async () => {
  const db = environment.authenticatedContext("unattached").firestore()
  await assertFails(getDocs(kitchenQuery(db, "restaurant-a")))
})

integration("la requête collectionGroup exclut Bar et les statuts terminaux", async () => {
  const db = environment.authenticatedContext("kitchen-a").firestore()
  const snapshot = await assertSucceeds(getDocs(kitchenQuery(db, "restaurant-a")))
  assert.equal(snapshot.size, 1)
  assert.equal(snapshot.docs[0].data().preparationMode, "kitchen")
  assert.equal(snapshot.docs[0].data().status, "pending")
})

integration("le POS lit toutes les lignes canoniques de son restaurant", async () => {
  const db = environment.authenticatedContext("cashier-a").firestore()
  const snapshot = await assertSucceeds(getDocs(posQuery(db, "restaurant-a")))
  assert.deepEqual(
    new Set(snapshot.docs.map((document) => document.id)),
    new Set(["item-kitchen", "item-bar", "item-served"])
  )
})

integration("le POS ne lit pas les lignes d’un autre restaurant", async () => {
  const db = environment.authenticatedContext("cashier-a").firestore()
  await assertFails(getDocs(posQuery(db, "restaurant-b")))
})

integration("le POS ne peut pas écrire directement une ligne canonique", async () => {
  const db = environment.authenticatedContext("cashier-a").firestore()
  await assertFails(
    db.doc("restaurants/restaurant-a/orders/order-a/orderItems/item-kitchen").update({
      status: "served",
    })
  )
})

integration("Cuisine peut lire les lignes servies du jour de son poste sans les modifier", async () => {
  const db = environment.authenticatedContext("kitchen-a").firestore()
  const snapshot = await assertSucceeds(getDocs(servedHistoryQuery(db, "restaurant-a")))
  assert.deepEqual(snapshot.docs.map((document) => document.id), ["item-served"])
  await assertFails(
    db.doc("restaurants/restaurant-a/orders/order-a/orderItems/item-served").update({
      status: "ready",
    })
  )
})

integration("POS et Manager voient immédiatement les signalements sans pouvoir les écrire", async () => {
  for (const uid of ["cashier-a","manager-a"]) {
    const db=environment.authenticatedContext(uid).firestore()
    const snapshot=await assertSucceeds(db.collection("restaurants/restaurant-a/preparationIssues").where("status","==","OPEN").limit(100).get())
    assert.equal(snapshot.size,1)
    await assertFails(db.doc("restaurants/restaurant-a/preparationIssues/issue-a").update({status:"RESOLVED"}))
  }
})

function kitchenQuery(db, restaurantId) {
  return query(
    collectionGroup(db, "orderItems"),
    where("restaurantId", "==", restaurantId),
    where("preparationMode", "==", "kitchen"),
    where("status", "in", ["pending", "preparing", "ready"]),
    orderBy("createdAt", "asc"),
    limit(200)
  )
}

function posQuery(db, restaurantId) {
  return query(
    collectionGroup(db, "orderItems"),
    where("restaurantId", "==", restaurantId),
    orderBy("createdAt", "asc"),
    limit(500)
  )
}

function stationQuery(db, restaurantId, stationId) {
  return query(collectionGroup(db, "orderItems"), where("restaurantId", "==", restaurantId), where("preparationStationId", "==", stationId), where("status", "in", ["pending", "preparing", "ready"]), orderBy("createdAt", "asc"), limit(200))
}

function servedHistoryQuery(db, restaurantId) {
  return query(collectionGroup(db, "orderItems"), where("restaurantId", "==", restaurantId), where("preparationMode", "==", "kitchen"), where("status", "==", "served"), where("servedAt", ">=", new Date("2026-01-01T00:00:00.000Z")), orderBy("servedAt", "desc"), limit(250))
}

function item(restaurantId, orderId, preparationMode, status) {
  return {
    restaurantId,
    orderId,
    orderItemId: `item-${preparationMode}-${status}`,
    productId: "product",
    nameSnapshot: "Produit",
    quantity: 1,
    cancelledQuantity: 0,
    servedQuantity: 0,
    preparationMode,
    status,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...(status === "served" ? { servedAt: new Date("2026-01-01T12:00:00.000Z") } : {}),
  }
}
