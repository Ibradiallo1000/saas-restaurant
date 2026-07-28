import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test, { after, before } from "node:test"

import {
  assertFails,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore"

import { markOrderItemAsServedAndDeductStock } from "../../../src/modules/stock/automatic-simple/infrastructure/mark-order-item-served.ts"

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = "oordera-client-served-stock"
const restaurantId = "restaurant-client-stock"
const orderId = "CMD-9890"
const productId = "coca-product"
const articleId = "coca-article"
const lineId = "coca-line"
let environment

before(async () => {
  if (!emulatorEnabled) return
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
    },
  })
})

after(async () => {
  if (environment) await environment.cleanup()
})

test("transaction client : CMD-9890 retire 3 Coca, 20 vers 17, puis rejeu sans effet", {
  skip: !emulatorEnabled,
}, async () => {
  await seed({ association: "active", trackingMode: "AUTOMATIC_SIMPLE" })
  const db = environment.authenticatedContext("cashier-user").firestore()

  const first = await markOrderItemAsServedAndDeductStock({
    db,
    restaurantId,
    orderId,
    orderItemId: lineId,
    actorId: "cashier-user",
  })
  assert.equal(first.deductedQuantity, 3)
  assert.equal(await balanceQuantity(db), 17)
  assert.equal(
    (
      await getDocs(
        collection(db, "restaurants", restaurantId, "orders", orderId, "orderItems")
      )
    ).size,
    1
  )

  const replay = await markOrderItemAsServedAndDeductStock({
    db,
    restaurantId,
    orderId,
    orderItemId: lineId,
    actorId: "cashier-user",
  })
  assert.equal(replay.replayed, true)
  assert.equal(await balanceQuantity(db), 17)
})

test("ligne POS canonique neuve avec servedQuantity initialisé : service autorisé après paiement", {
  skip: !emulatorEnabled,
}, async () => {
  await seed({
    association: "active",
    trackingMode: "AUTOMATIC_SIMPLE",
    paid: true,
  })
  const db = environment.authenticatedContext("cashier-user").firestore()

  const result = await markOrderItemAsServedAndDeductStock({
    db,
    restaurantId,
    orderId,
    orderItemId: lineId,
    actorId: "cashier-user",
  })

  assert.equal(result.deductedQuantity, 3)
  assert.equal(await balanceQuantity(db), 17)
  const line = await getDoc(
    doc(db, "restaurants", restaurantId, "orders", orderId, "orderItems", lineId)
  )
  assert.equal(line.data().servedQuantity, 3)
  assert.equal(line.data().status, "served")
})

test("ligne canonique absente : ORDER_ITEM_NOT_FOUND sans recréation ni écriture stock", {
  skip: !emulatorEnabled,
}, async () => {
  await seed({ association: "active", trackingMode: "AUTOMATIC_SIMPLE" })
  await environment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(
      doc(
        context.firestore(),
        "restaurants",
        restaurantId,
        "orders",
        orderId,
        "orderItems",
        lineId
      )
    )
  })
  const db = environment.authenticatedContext("cashier-user").firestore()

  await assert.rejects(
    markOrderItemAsServedAndDeductStock({
      db,
      restaurantId,
      orderId,
      orderItemId: lineId,
      actorId: "cashier-user",
    }),
    (error) =>
      error?.code === "ORDER_ITEM_NOT_FOUND" &&
      error?.restaurantId === restaurantId &&
      error?.orderId === orderId &&
      error?.orderItemId === lineId
  )
  assert.equal(await balanceQuantity(db), 20)
  assert.equal(
    (
      await getDocs(
        collection(db, "restaurants", restaurantId, "orders", orderId, "orderItems")
      )
    ).size,
    0
  )
})

test("deux clics concurrents ne produisent qu’une déduction", {
  skip: !emulatorEnabled,
}, async () => {
  await seed({ association: "active", trackingMode: "AUTOMATIC_SIMPLE" })
  const db = environment.authenticatedContext("cashier-user").firestore()
  const results = await Promise.all([
    markOrderItemAsServedAndDeductStock({
      db, restaurantId, orderId, orderItemId: lineId, actorId: "cashier-user",
    }),
    markOrderItemAsServedAndDeductStock({
      db, restaurantId, orderId, orderItemId: lineId, actorId: "cashier-user",
    }),
  ])
  assert.equal(results.filter((result) => result.deductedQuantity === 3).length, 1)
  assert.equal(await balanceQuantity(db), 17)
})

test("une quantité servie supérieure à la commande est refusée", {
  skip: !emulatorEnabled,
}, async () => {
  await seed({ association: "active", trackingMode: "AUTOMATIC_SIMPLE" })
  const db = environment.authenticatedContext("cashier-user").firestore()
  await assert.rejects(
    markOrderItemAsServedAndDeductStock({
      db,
      restaurantId,
      orderId,
      orderItemId: lineId,
      actorId: "cashier-user",
      servedQuantity: 4,
    }),
    /ne peut pas dépasser/
  )
  assert.equal(await balanceQuantity(db), 20)
})

for (const scenario of [
  { name: "association absente", association: "missing", trackingMode: "AUTOMATIC_SIMPLE" },
  { name: "association inactive", association: "inactive", trackingMode: "AUTOMATIC_SIMPLE" },
  { name: "article manuel", association: "active", trackingMode: "CONTROLLED" },
]) {
  test(`${scenario.name} : service conservé, stock inchangé et avertissement`, {
    skip: !emulatorEnabled,
  }, async () => {
    await seed(scenario)
    const db = environment.authenticatedContext("cashier-user").firestore()
    const result = await markOrderItemAsServedAndDeductStock({
      db,
      restaurantId,
      orderId,
      orderItemId: lineId,
      actorId: "cashier-user",
    })
    assert.match(result.warning, /Produit servi/)
    assert.equal(await balanceQuantity(db), 20)
    const order = await getDoc(doc(db, "restaurants", restaurantId, "orders", orderId))
    assert.equal(order.data().items[0].status, "served")
  })
}

test("paiement seul et modification directe par un utilisateur non autorisé ne changent pas le stock", {
  skip: !emulatorEnabled,
}, async () => {
  await seed({ association: "active", trackingMode: "AUTOMATIC_SIMPLE" })
  const cashierDb = environment.authenticatedContext("cashier-user").firestore()
  await updateDoc(doc(cashierDb, "restaurants", restaurantId, "orders", orderId), {
    paymentStatus: "paid",
    cashSessionId: "session-test",
  })
  assert.equal(await balanceQuantity(cashierDb), 20)

  const outsiderDb = environment.authenticatedContext("outsider").firestore()
  await assertFails(updateDoc(
    doc(outsiderDb, "restaurants", restaurantId, "stockBalancesV2", articleId),
    { quantity: 1, version: 2 }
  ))
  const managerDb = environment.authenticatedContext("manager-user").firestore()
  await assertFails(updateDoc(
    doc(managerDb, "restaurants", restaurantId, "stockBalancesV2", articleId),
    { quantity: 1, version: 2, lastOperationId: "operation-inexistante" }
  ))
})

async function seed({
  association,
  trackingMode,
  initialServedQuantity = 0,
  paid = false,
}) {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const root = ["restaurants", restaurantId]
    await Promise.all([
      setDoc(doc(db, "users", "cashier-user"), {
        restaurantId,
        role: "cashier",
      }),
      setDoc(doc(db, "users", "manager-user"), {
        restaurantId,
        role: "manager",
      }),
      setDoc(doc(db, ...root, "products", productId), {
        name: "Coca cola",
        stockArticleId: articleId,
        quantityPerSale: 1,
      }),
      setDoc(doc(db, ...root, "stockItemsV2", articleId), {
        restaurantId,
        name: "Coca Cola",
        status: "active",
        trackingMode,
        baseUnit: "unit",
      }),
      setDoc(doc(db, ...root, "stockBalancesV2", articleId), {
        restaurantId,
        articleId,
        quantity: 20,
        unit: "unit",
        version: 1,
      }),
      setDoc(doc(db, ...root, "orders", orderId), {
        restaurantId,
        source: "pos",
        orderType: "pickup",
        orderStatus: paid ? "ready" : "pending",
        kitchenStatus: paid ? "ready" : "pending",
        paymentStatus: paid ? "paid" : "unpaid",
        ...(paid ? { cashSessionId: "session-test" } : {}),
        items: [{
          id: lineId,
          productId,
          name: "Coca cola",
          quantity: 3,
          status: "pending",
        }],
      }),
      setDoc(doc(db, ...root, "orders", orderId, "orderItems", lineId), {
        id: lineId,
        orderItemId: lineId,
        orderId,
        restaurantId,
        productId,
        name: "Coca cola",
        quantity: 3,
        status: "pending",
        ...(initialServedQuantity === null
          ? {}
          : { servedQuantity: initialServedQuantity }),
      }),
    ])
    if (association !== "missing") {
      setDoc(
        doc(
          db,
          ...root,
          "stockAutomaticAssociationsV2",
          `${productId}--${articleId}`
        ),
        {
          restaurantId,
          productId,
          articleId,
          quantity: 1,
          unit: "unit",
          status: association,
        }
      )
    }
  })
}

async function balanceQuantity(db) {
  const snapshot = await getDoc(
    doc(db, "restaurants", restaurantId, "stockBalancesV2", articleId)
  )
  return Number(snapshot.data().quantity)
}
