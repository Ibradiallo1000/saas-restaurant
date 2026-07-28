import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test, { after } from "node:test"

const requireFromFunctions = createRequire(
  new URL("../../../functions/package.json", import.meta.url)
)
const { deleteApp, getApps, initializeApp } = requireFromFunctions("firebase-admin/app")
const { getFirestore } = requireFromFunctions("firebase-admin/firestore")

const projectId = "oordera-served-stock-functions"
const restaurantId = "ccb21584-d85a-4d7b-b2a6-c36f4ff5f32f"
const productId = "product-coca"
const articleId = "article-coca"
const orderId = "order-trigger-coca"
const app = getApps().length ? getApps()[0] : initializeApp({ projectId })
const db = getFirestore(app)

after(async () => {
  await deleteApp(app)
})

test("Functions emulator : le trigger servi déduit 20 vers 18 sans transition de paiement", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_EMULATOR_HUB,
}, async () => {
  const root = db.collection("restaurants").doc(restaurantId)
  await Promise.all([
    root.collection("products").doc(productId).set({ name: "Coca cola" }),
    root.collection("stockItemsV2").doc(articleId).set({
      restaurantId,
      name: "Coca Cola",
      status: "active",
      trackingMode: "AUTOMATIC_SIMPLE",
      baseUnit: "unit",
    }),
    root.collection("stockBalancesV2").doc(articleId).set({
      restaurantId,
      articleId,
      quantity: 20,
      unit: "unit",
      version: 1,
    }),
    root.collection("stockAutomaticAssociationsV2").doc("coca-link").set({
      restaurantId,
      productId,
      articleId,
      quantity: 1,
      unit: "unit",
      status: "active",
    }),
  ])

  const orderRef = root.collection("orders").doc(orderId)
  const pendingItems = [{
    id: "line-coca",
    productId,
    quantity: 2,
    status: "pending",
    preparationMode: "direct",
  }]
  await orderRef.set({
    restaurantId,
    source: "pos",
    orderType: "pickup",
    paymentStatus: "unpaid",
    items: pendingItems,
  })
  await orderRef.update({
    items: [{ ...pendingItems[0], status: "served", servedQuantity: 2 }],
  })

  const balanceRef = root.collection("stockBalancesV2").doc(articleId)
  // The first Functions emulator invocation can include a cold start on Windows.
  const deadline = Date.now() + 45_000
  let quantity = 20
  while (Date.now() < deadline) {
    quantity = Number((await balanceRef.get()).data()?.quantity)
    if (quantity === 18) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  assert.equal(quantity, 18)
  assert.equal((await root.collection("stockOperationsV2").get()).size, 1)
  assert.equal((await root.collection("stockIdempotencyV2").get()).size, 1)
  assert.equal((await root.collection("stockServingProgressV2").get()).size, 1)

  await orderRef.update({ updatedAt: new Date() })
  await new Promise((resolve) => setTimeout(resolve, 750))
  assert.equal(Number((await balanceRef.get()).data()?.quantity), 18)
})
