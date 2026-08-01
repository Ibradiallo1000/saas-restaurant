import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing"
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"

const host = process.env.FIRESTORE_EMULATOR_HOST
const integration = host ? test : test.skip
const [emulatorHost, emulatorPort] = (host ?? "127.0.0.1:8080").split(":")
let environment

test.before(async () => {
  if (!host) return
  environment = await initializeTestEnvironment({
    projectId: `availability-rules-${process.pid}`,
    firestore: {
      host: emulatorHost,
      port: Number(emulatorPort),
      rules: await readFile("firestore.rules", "utf8"),
    },
  })
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const [uid, role] of [["owner-1", "owner"], ["manager-1", "manager"], ["kitchen-1", "kitchen"], ["cashier-1", "cashier"]]) {
      await setDoc(doc(db, "users", uid), { restaurantId: "restaurant-1", role })
    }
    await setDoc(doc(db, "restaurants", "restaurant-1"), { name: "Restaurant" })
    await setDoc(doc(db, "restaurants", "restaurant-1", "categories", "food"), {
      name: "Plats", preparationMode: "kitchen", reviewsEnabled: false,
    })
    for (const [id, preparationMode] of [["dish", "kitchen"], ["drink", "bar"], ["water", "direct"]]) {
      await setDoc(doc(db, "restaurants", "restaurant-1", "products", id), {
        name: id,
        categoryId: "food",
        preparationMode,
        isActive: true,
        reviewsEnabled: false,
        reviewsPolicy: "disabled",
      })
    }
    await setDoc(doc(db, "restaurants", "restaurant-1", "products", "legacy-dish"), {
      name: "legacy-dish",
      categoryId: "food",
      isActive: true,
      reviewsEnabled: false,
      reviewsPolicy: "disabled",
    })
    await setDoc(doc(db, "restaurants", "restaurant-1", "availabilityHistory", "kitchen-entry"), { preparationMode: "kitchen", occurredAt: new Date(), productName: "dish" })
    await setDoc(doc(db, "restaurants", "restaurant-1", "availabilityHistory", "bar-entry"), { preparationMode: "bar", occurredAt: new Date(), productName: "drink" })
  })
})

test.after(async () => environment?.cleanup())

function dbFor(uid, role) {
  return environment.authenticatedContext(uid, { restaurantId: "restaurant-1", role }).firestore()
}

function availability(state, uid) {
  return {
    operationalAvailability: {
      state,
      reason: null,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
  }
}

for (const role of ["owner", "manager"]) {
  integration(`${role} passe par l'autorité serveur pour modifier tous les modes`, async () => {
    const uid = `${role}-1`
    for (const productId of ["dish", "drink", "water"]) {
      await assertFails(updateDoc(
        doc(dbFor(uid, role), "restaurants", "restaurant-1", "products", productId),
        availability("PAUSED", uid)
      ))
    }
  })
}

integration("Cuisine passe par l'autorité serveur, y compris pour kitchen", async () => {
  const db = dbFor("kitchen-1", "kitchen")
  await assertFails(updateDoc(
    doc(db, "restaurants", "restaurant-1", "products", "dish"),
    availability("SOLD_OUT", "kitchen-1")
  ))
  await assertFails(updateDoc(
    doc(db, "restaurants", "restaurant-1", "products", "legacy-dish"),
    availability("PAUSED", "kitchen-1")
  ))
  await assertFails(updateDoc(
    doc(db, "restaurants", "restaurant-1", "products", "drink"),
    availability("SOLD_OUT", "kitchen-1")
  ))
  await assertFails(updateDoc(
    doc(db, "restaurants", "restaurant-1", "products", "water"),
    availability("SOLD_OUT", "kitchen-1")
  ))
  await assertFails(updateDoc(
    doc(db, "restaurants", "restaurant-1", "products", "dish"),
    { ...availability("PAUSED", "kitchen-1"), price: 1 }
  ))
})

integration("Caissier ne modifie pas la disponibilité", async () => {
  await assertFails(updateDoc(
    doc(dbFor("cashier-1", "cashier"), "restaurants", "restaurant-1", "products", "dish"),
    availability("SOLD_OUT", "cashier-1")
  ))
})

integration("Manager consulte tout l'historique, Cuisine uniquement kitchen et Caissier aucun", async () => {
  const path = (id) => ["restaurants", "restaurant-1", "availabilityHistory", id]
  await assertSucceeds(getDoc(doc(dbFor("manager-1", "manager"), ...path("bar-entry"))))
  await assertSucceeds(getDoc(doc(dbFor("kitchen-1", "kitchen"), ...path("kitchen-entry"))))
  await assertFails(getDoc(doc(dbFor("kitchen-1", "kitchen"), ...path("bar-entry"))))
  await assertFails(getDoc(doc(dbFor("cashier-1", "cashier"), ...path("kitchen-entry"))))
})
