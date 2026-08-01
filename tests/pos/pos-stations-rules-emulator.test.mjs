import { readFile } from "node:fs/promises"
import test, { after, before, beforeEach } from "node:test"

import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing"
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
let environment

before(async () => {
  if (!enabled) return
  environment = await initializeTestEnvironment({
    projectId: `pos-stations-rules-${Date.now()}`,
    firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
  })
})
beforeEach(async () => {
  if (!enabled) return
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, "restaurants", "restaurant-a"), { ownerId: "owner" }),
      setDoc(doc(db, "users", "owner"), { restaurantId: "restaurant-a", role: "owner", active: true }),
      setDoc(doc(db, "users", "manager"), { restaurantId: "restaurant-a", role: "manager", active: true }),
      setDoc(doc(db, "users", "cashier"), { restaurantId: "restaurant-a", role: "cashier", active: true }),
      setDoc(doc(db, "restaurants", "restaurant-a", "staff", "cashier"), { role: "cashier", active: true }),
    ])
  })
})
after(async () => { if (environment) await environment.cleanup() })

const stationPayload = () => ({
  name: "Caisse restaurant", code: "RESTO", isActive: true, catalogMode: "ALL",
  allowedCategoryIds: [], allowedProductIds: [], excludedProductIds: [], activeSessionId: null,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: "manager", updatedBy: "manager",
})

test("Owner et Manager gèrent les postes, le Caissier les consulte seulement", { skip: !enabled }, async () => {
  const managerDb = environment.authenticatedContext("manager").firestore()
  await assertSucceeds(setDoc(doc(managerDb, "restaurants", "restaurant-a", "posStations", "main"), stationPayload()))
  const cashierDb = environment.authenticatedContext("cashier").firestore()
  await assertSucceeds(getDoc(doc(cashierDb, "restaurants", "restaurant-a", "posStations", "main")))
  await assertFails(updateDoc(doc(cashierDb, "restaurants", "restaurant-a", "posStations", "main"), { name: "Interdit" }))

  const ownerDb = environment.authenticatedContext("owner").firestore()
  await assertSucceeds(updateDoc(doc(ownerDb, "restaurants", "restaurant-a", "posStations", "main"), { name: "Principale", updatedAt: serverTimestamp(), updatedBy: "owner" }))
})

test("Manager affecte un caissier sans pouvoir modifier son rôle", { skip: !enabled }, async () => {
  const managerDb = environment.authenticatedContext("manager").firestore()
  const staffRef = doc(managerDb, "restaurants", "restaurant-a", "staff", "cashier")
  await assertSucceeds(updateDoc(staffRef, { allowedPosStationIds: ["main"], defaultPosStationId: "main", updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(staffRef, { role: "manager", allowedPosStationIds: ["main"], defaultPosStationId: "main", updatedAt: serverTimestamp() }))
  const cashierDb = environment.authenticatedContext("cashier").firestore()
  await assertFails(updateDoc(doc(cashierDb, "restaurants", "restaurant-a", "staff", "cashier"), { allowedPosStationIds: [], defaultPosStationId: null, updatedAt: serverTimestamp() }))
})

test("les sessions ne peuvent plus être ouvertes directement par un client", { skip: !enabled }, async () => {
  const cashierDb = environment.authenticatedContext("cashier").firestore()
  await assertFails(setDoc(doc(cashierDb, "restaurants", "restaurant-a", "cashSessions", "session"), { cashierId: "cashier", status: "open" }))
})
