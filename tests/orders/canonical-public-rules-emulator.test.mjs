import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  assertFails,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore"

const host = process.env.FIRESTORE_EMULATOR_HOST
const integration = host ? test : test.skip
const [emulatorHost, emulatorPort] = (host ?? "127.0.0.1:8282").split(":")
const projectId = `oordera-public-rules-${process.pid}`
let environment

test.before(async () => {
  if (!host) return
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: emulatorHost,
      port: Number(emulatorPort),
      rules: await readFile("firestore.rules", "utf8"),
    },
  })
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, "restaurants", "restaurant-a"), { name: "A" })
    await setDoc(doc(db, "restaurants", "restaurant-b"), { name: "B" })
    await setDoc(doc(db, "restaurants", "restaurant-a", "orders", "order-a"), {
      restaurantId: "restaurant-a",
      source: "qr_table",
      createdBy: "client-a",
      paymentStatus: "unpaid",
    })
    await setDoc(doc(db, "restaurants", "restaurant-a", "tableSessions", "session-a"), {
      tableId: "table-a",
      status: "active",
      paymentRequest: { status: "none" },
    })
  })
})

test.after(async () => {
  await environment?.cleanup()
})

function publicDb(uid = "client-a") {
  return environment.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  }).firestore()
}

integration("création Firestore directe de commande publique refusée", async () => {
  await assertFails(setDoc(doc(publicDb(), "restaurants", "restaurant-a", "orders", "new"), {
    restaurantId: "restaurant-a",
    source: "qr_table",
    items: [],
    total: 0,
    orderStatus: "pending",
  }))
})

integration("écriture Firestore directe de orderItems refusée", async () => {
  await assertFails(setDoc(
    doc(publicDb(), "restaurants", "restaurant-a", "orders", "order-a", "orderItems", "line"),
    { restaurantId: "restaurant-a", orderId: "order-a" }
  ))
})

integration("mutation directe du paiement de la commande refusée", async () => {
  await assertFails(updateDoc(
    doc(publicDb(), "restaurants", "restaurant-a", "orders", "order-a"),
    { paymentStatus: "paid" }
  ))
})

integration("mutation directe de demande de paiement table refusée", async () => {
  await assertFails(updateDoc(
    doc(publicDb(), "restaurants", "restaurant-a", "tableSessions", "session-a"),
    { paymentRequest: { status: "requested", method: "cash" } }
  ))
})

integration("création directe de reviewAccess refusée", async () => {
  await assertFails(setDoc(
    doc(publicDb(), "restaurants", "restaurant-a", "reviewAccess", "order-a"),
    { restaurantId: "restaurant-a", orderId: "order-a", reviewToken: crypto.randomUUID() }
  ))
})

integration("lecture directe de la commande d'un autre client refusée", async () => {
  await assertFails(getDoc(
    doc(publicDb("client-b"), "restaurants", "restaurant-a", "orders", "order-a")
  ))
})

integration("lecture directe inter-restaurant refusée", async () => {
  await assertFails(getDoc(
    doc(publicDb(), "restaurants", "restaurant-b", "orders", "other")
  ))
})

integration("Admin SDK émulateur conserve la frontière serveur", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const reference = doc(
      collection(context.firestore(), "restaurants", "restaurant-a", "orders")
    )
    await setDoc(reference, { restaurantId: "restaurant-a", source: "qr_table" })
    assert.equal((await getDoc(reference)).exists(), true)
  })
})
