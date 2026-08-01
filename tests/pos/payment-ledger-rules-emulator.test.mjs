import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test, { after, before, beforeEach } from "node:test"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing"
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = `oordera-payment-ledger-rules-${Date.now()}`
let environment

before(async () => {
  if (!enabled) return
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    },
  })
})

beforeEach(async () => {
  if (!enabled) return
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, "users", "cashier-a"), {
        restaurantId: "restaurant-a",
        role: "cashier",
        active: true,
      }),
      setDoc(doc(db, "restaurants", "restaurant-a"), {
        name: "Restaurant A",
        ownerId: "owner-a",
      }),
      setDoc(doc(db, "restaurants", "restaurant-a", "cashSessions", "session-a"), {
        restaurantId: "restaurant-a",
        cashierId: "cashier-a",
        status: "open",
      }),
      setDoc(doc(db, "restaurants", "restaurant-a", "payments", "historical"), {
        restaurantId: "restaurant-a",
        orderId: "order-a",
        sessionId: "session-a",
        cashierId: "cashier-a",
        source: "legacy",
        type: "cash",
        provider: null,
        amount: 1000,
        status: "confirmed",
        idempotencyKey: "historical-key",
      }),
    ])
  })
})

after(async () => {
  if (environment) await environment.cleanup()
})

test("un caissier peut encore lire un paiement historique", { skip: !enabled }, async () => {
  const db = environment.authenticatedContext("cashier-a").firestore()
  const snapshot = await assertSucceeds(
    getDoc(doc(db, "restaurants", "restaurant-a", "payments", "historical"))
  )
  assert.equal(snapshot.data().amount, 1000)
})

test("un client ne peut plus créer directement un encaissement", { skip: !enabled }, async () => {
  const db = environment.authenticatedContext("cashier-a").firestore()
  await assertFails(
    setDoc(doc(db, "restaurants", "restaurant-a", "payments", "new-payment"), {
      restaurantId: "restaurant-a",
      orderId: "order-a",
      sessionId: "session-a",
      cashierId: "cashier-a",
      source: "pos",
      type: "cash",
      provider: null,
      amount: 1000,
      status: "confirmed",
      idempotencyKey: "new-key",
      createdAt: new Date(),
      confirmedAt: new Date(),
      confirmedBy: "cashier-a",
    })
  )
})

test("un client ne peut confirmer, invalider ou rembourser un ledger existant", {
  skip: !enabled,
}, async () => {
  const db = environment.authenticatedContext("cashier-a").firestore()
  const ref = doc(db, "restaurants", "restaurant-a", "payments", "historical")
  await assertFails(updateDoc(ref, { status: "voided" }))
  await assertFails(updateDoc(ref, { refunded: true }))
})
