import { readFile } from "node:fs/promises"
import test, { after, before, beforeEach } from "node:test"

import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing"
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
let environment

before(async () => {
  if (!enabled) return
  environment = await initializeTestEnvironment({
    projectId: `cash-handover-rules-${Date.now()}`,
    firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
  })
})
beforeEach(async () => {
  if (!enabled) return
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, "users", "cashier-a"), { restaurantId: "restaurant-a", role: "cashier", active: true }),
      setDoc(doc(db, "users", "cashier-b"), { restaurantId: "restaurant-a", role: "cashier", active: true }),
      setDoc(doc(db, "users", "manager"), { restaurantId: "restaurant-a", role: "manager", active: true }),
      setDoc(doc(db, "restaurants", "restaurant-a"), { ownerId: "owner" }),
      setDoc(doc(db, "restaurants", "restaurant-a", "cashHandovers", "handover"), {
        restaurantId: "restaurant-a", sessionId: "session", cashierId: "cashier-a",
        status: "submitted", declaredAmount: 1000,
      }),
    ])
  })
})
after(async () => { if (environment) await environment.cleanup() })

test("le propriétaire et le manager lisent la remise", { skip: !enabled }, async () => {
  const ownerDb = environment.authenticatedContext("cashier-a").firestore()
  await assertSucceeds(getDoc(doc(ownerDb, "restaurants", "restaurant-a", "cashHandovers", "handover")))
  await assertSucceeds(getDocs(query(
    collection(ownerDb, "restaurants", "restaurant-a", "cashHandovers"),
    where("cashierId", "==", "cashier-a")
  )))
  const managerDb = environment.authenticatedContext("manager").firestore()
  await assertSucceeds(getDoc(doc(managerDb, "restaurants", "restaurant-a", "cashHandovers", "handover")))
})

test("un autre caissier ne lit pas et aucun client n'écrit", { skip: !enabled }, async () => {
  const otherDb = environment.authenticatedContext("cashier-b").firestore()
  await assertFails(getDoc(doc(otherDb, "restaurants", "restaurant-a", "cashHandovers", "handover")))
  const cashierDb = environment.authenticatedContext("cashier-a").firestore()
  await assertFails(setDoc(doc(cashierDb, "restaurants", "restaurant-a", "cashHandovers", "new"), {
    restaurantId: "restaurant-a", sessionId: "session", cashierId: "cashier-a", status: "submitted",
  }))
  const managerDb = environment.authenticatedContext("manager").firestore()
  await assertFails(updateDoc(doc(managerDb, "restaurants", "restaurant-a", "cashHandovers", "handover"), {
    status: "validated",
  }))
})
