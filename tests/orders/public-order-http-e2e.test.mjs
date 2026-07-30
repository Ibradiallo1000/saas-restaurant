import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import test, { after, before } from "node:test"

import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app"
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore"
import { initializeApp, deleteApp } from "firebase/app"
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInAnonymously,
} from "firebase/auth"
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"

const enabled =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
const integration = enabled ? test : test.skip
const projectId =
  process.env.ORDER_E2E_FIREBASE_PROJECT_ID ?? "demo-oordera-qr-e2e"
const restaurantId = "restaurant-http-e2e"
const tableId = "table-a"
const productId = "pizza-stock"
const articleId = "article-pizza"
const cashSessionId = "cash-session-e2e"
const port = 9109
const baseUrl = `http://127.0.0.1:${port}`
const appCheckProof = "e2e-app-check-proof-0123456789abcdef"
const qrSecret = "e2e-qr-capability-secret-0123456789abcdef"
let server
let adminApp
let db
let clientApp
let foreignClientApp
let kitchenApp
let cashierApp
let clientDb
let anonymousUser
let foreignAnonymousUser
let kitchenUser
let cashierUser

before(async () => {
  if (!enabled) return
  process.env.ORDER_QR_CAPABILITY_SECRET = qrSecret
  process.env.ORDER_E2E_APP_CHECK_TOKEN = appCheckProof
  process.env.ORDER_E2E_MODE = "1"
  process.env.NEXT_PUBLIC_QR_CANONICAL_MODE = "canonical"
  process.env.NEXT_PUBLIC_QR_CANONICAL_RESTAURANTS = restaurantId
  process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY = "e2e-site-key"
  process.env.FIREBASE_PROJECT_ID = projectId
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId

  adminApp = initializeAdminApp({ projectId }, `qr-http-e2e-${Date.now()}`)
  db = getAdminFirestore(adminApp)
  clientApp = createClientApp("public")
  foreignClientApp = createClientApp("foreign-public")
  kitchenApp = createClientApp("kitchen")
  cashierApp = createClientApp("cashier")
  const auth = getAuth(clientApp)
  clientDb = getFirestore(clientApp)
  const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":")
  connectFirestoreEmulator(clientDb, firestoreHost, Number(firestorePort))

  anonymousUser = (await signInAnonymously(auth)).user
  foreignAnonymousUser = (await signInAnonymously(getAuth(foreignClientApp))).user
  kitchenUser = (await createUserWithEmailAndPassword(
    getAuth(kitchenApp),
    `kitchen-${Date.now()}@example.test`,
    "Password123!"
  )).user
  cashierUser = (await createUserWithEmailAndPassword(
    getAuth(cashierApp),
    `cashier-${Date.now()}@example.test`,
    "Password123!"
  )).user

  const root = db.collection("restaurants").doc(restaurantId)
  await Promise.all([
    root.set({
      name: "Restaurant E2E",
      status: "active",
      currency: "FCFA",
      publicOrderingOpen: true,
      taxRate: 0,
      pricesIncludeTax: false,
    }),
    root.collection("tables").doc(tableId).set({
      restaurantId,
      name: "Table A",
      zoneId: "main",
      status: "free",
      currentSessionId: null,
    }),
    root.collection("categories").doc("kitchen").set({
      name: "Cuisine",
      active: true,
      preparationMode: "kitchen",
    }),
    root.collection("products").doc(productId).set({
      name: "Pizza stock",
      price: 500,
      categoryId: "kitchen",
      preparationMode: "kitchen",
      isActive: true,
      reviewsEnabled: true,
      stockArticleId: articleId,
    }),
    root.collection("stockItemsV2").doc(articleId).set({
      restaurantId,
      name: "Pizza stock",
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
    root.collection("stockAutomaticAssociationsV2").doc(`${productId}--${articleId}`).set({
      restaurantId,
      productId,
      articleId,
      quantity: 1,
      unit: "unit",
      status: "active",
    }),
    root.collection("cashSessions").doc(cashSessionId).set({
      restaurantId,
      status: "open",
      openedBy: cashierUser.uid,
    }),
    db.collection("users").doc(kitchenUser.uid).set({
      restaurantId,
      role: "kitchen",
      active: true,
    }),
    db.collection("users").doc(cashierUser.uid).set({
      restaurantId,
      role: "cashier",
      active: true,
    }),
  ])

  server = startNextServer()
  await waitForServer()
})

after(async () => {
  if (server) server.kill()
  if (cashierApp) await deleteApp(cashierApp)
  if (kitchenApp) await deleteApp(kitchenApp)
  if (clientApp) await deleteApp(clientApp)
  if (foreignClientApp) await deleteApp(foreignClientApp)
  if (adminApp) await deleteAdminApp(adminApp)
})

integration("QR HTTP complet : Auth, App Check, Cuisine, POS, Stock, paiement et avis", async () => {
  const publicHeaders = await headersFor(anonymousUser, true)
  const session = await httpJson(
    `/api/restaurants/${restaurantId}/table-sessions`,
    {
      method: "POST",
      headers: publicHeaders,
      body: JSON.stringify({ tableId }),
    },
    200
  )
  assert.ok(session.tableSessionId)
  assert.ok(session.capability)

  const createBody = canonicalBody(session)
  const created = await httpJson(
    `/api/restaurants/${restaurantId}/orders`,
    {
      method: "POST",
      headers: {
        ...publicHeaders,
        "idempotency-key": "http-e2e-create-000001",
      },
      body: JSON.stringify(createBody),
    },
    201
  )
  const orderId = created.orderId
  const orderItemId = created.orderItemIds[0]
  const orderRef = db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId)
  const itemRef = orderRef.collection("orderItems").doc(orderItemId)
  assert.equal((await orderRef.get()).data().orderStatus, "pending")
  assert.equal((await itemRef.get()).data().status, "pending")

  const replay = await httpJson(
    `/api/restaurants/${restaurantId}/orders`,
    {
      method: "POST",
      headers: {
        ...publicHeaders,
        "idempotency-key": "http-e2e-create-000001",
      },
      body: JSON.stringify(createBody),
    },
    200
  )
  assert.equal(replay.orderId, orderId)
  assert.equal(replay.replayed, true)

  await command(kitchenUser, orderId, {
    command: "MARK_ORDER_ITEM_PREPARING",
    orderItemId,
    expectedVersion: 1,
    idempotencyKey: "http-e2e-preparing-0001",
  })
  assert.equal((await itemRef.get()).data().status, "preparing")
  await command(kitchenUser, orderId, {
    command: "MARK_ORDER_ITEM_READY",
    orderItemId,
    expectedVersion: 2,
    idempotencyKey: "http-e2e-ready-000000001",
  })
  assert.equal((await itemRef.get()).data().status, "ready")

  await command(cashierUser, orderId, {
    command: "MARK_ORDER_ITEM_SERVED",
    orderItemId,
    expectedVersion: 3,
    quantityToServe: 2,
    idempotencyKey: "http-e2e-served-0000001",
  })
  assert.equal((await itemRef.get()).data().status, "served")
  assert.equal(
    (await db.collection("restaurants").doc(restaurantId)
      .collection("stockBalancesV2").doc(articleId).get()).data().quantity,
    18
  )
  assert.equal((await orderRef.get()).data().orderStatus, "served")

  await httpJson(
    `/api/restaurants/${restaurantId}/table-sessions/${session.tableSessionId}/payment-requests`,
    {
      method: "POST",
      headers: publicHeaders,
      body: JSON.stringify({
        capability: session.capability,
        idempotencyKey: "http-e2e-payment-request-1",
        method: "cash",
      }),
    },
    200
  )
  await command(cashierUser, orderId, {
    command: "CONFIRM_ORDER_PAYMENT",
    expectedPaymentVersion: 1,
    expectedAmount: 1000,
    receivedAmount: 1000,
    method: "cash",
    provider: null,
    externalReference: null,
    cashSessionId,
    idempotencyKey: "http-e2e-payment-confirm-1",
  })
  const paidOrder = (await orderRef.get()).data()
  assert.equal(paidOrder.paymentStatus, "paid")
  assert.equal(paidOrder.orderStatus, "completed")
  assert.equal(
    (await db.collection("restaurants").doc(restaurantId).collection("payments")
      .where("orderId", "==", orderId).get()).size,
    1
  )
  const duplicatePayment = await fetch(
    `${baseUrl}/api/restaurants/${restaurantId}/orders/${orderId}/commands`,
    {
      method: "POST",
      headers: await headersFor(cashierUser, false),
      body: JSON.stringify({
        command: "CONFIRM_ORDER_PAYMENT",
        expectedPaymentVersion: 2,
        expectedAmount: 1000,
        receivedAmount: 1000,
        method: "cash",
        provider: null,
        externalReference: null,
        cashSessionId,
        idempotencyKey: "http-e2e-payment-confirm-duplicate",
      }),
    }
  )
  assert.notEqual(duplicatePayment.status, 200)
  assert.equal(
    (await db.collection("restaurants").doc(restaurantId).collection("payments")
      .where("orderId", "==", orderId).get()).size,
    1
  )

  const reviewAccess = await httpJson(
    `/api/restaurants/${restaurantId}/orders/${orderId}/review-access`,
    { method: "POST", headers: publicHeaders },
    200
  )
  assert.ok(reviewAccess.reviewToken)
  await submitRestaurantReview(orderId, reviewAccess.reviewToken)
  assert.equal(
    (await db.collection("restaurants").doc(restaurantId)
      .collection("reviews").doc(orderId).get()).data().rating,
    5
  )
})

integration("paiement avant service ne sert pas et ne retire aucun Stock", async () => {
  const publicHeaders = await headersFor(anonymousUser, true)
  const session = await httpJson(`/api/restaurants/${restaurantId}/table-sessions`, {
    method: "POST",
    headers: publicHeaders,
    body: JSON.stringify({ tableId }),
  }, 200)
  const created = await httpJson(`/api/restaurants/${restaurantId}/orders`, {
    method: "POST",
    headers: { ...publicHeaders, "idempotency-key": "http-e2e-prepay-create-1" },
    body: JSON.stringify(canonicalBody(session, "prepay-line")),
  }, 201)
  const orderRef = db.collection("restaurants").doc(restaurantId).collection("orders").doc(created.orderId)
  const itemRef = orderRef.collection("orderItems").doc(created.orderItemIds[0])
  const before = (await db.collection("restaurants").doc(restaurantId)
    .collection("stockBalancesV2").doc(articleId).get()).data().quantity
  await command(cashierUser, created.orderId, {
    command: "CONFIRM_ORDER_PAYMENT",
    expectedPaymentVersion: 1,
    expectedAmount: 1000,
    receivedAmount: 1000,
    method: "cash",
    provider: null,
    externalReference: null,
    cashSessionId,
    idempotencyKey: "http-e2e-prepay-confirm-1",
  })
  assert.equal((await itemRef.get()).data().status, "pending")
  assert.equal((await itemRef.get()).data().servedQuantity, 0)
  assert.equal((await db.collection("restaurants").doc(restaurantId)
    .collection("stockBalancesV2").doc(articleId).get()).data().quantity, before)
  assert.notEqual((await orderRef.get()).data().orderStatus, "completed")
})

integration("sécurité HTTP et Rules : toutes les preuves publiques sont obligatoires", async () => {
  const validHeaders = await headersFor(anonymousUser, true)
  await httpJson(`/api/restaurants/${restaurantId}/table-sessions`, {
    method: "POST",
    headers: await headersFor(anonymousUser, false),
    body: JSON.stringify({ tableId }),
  }, 500)
  const session = await httpJson(`/api/restaurants/${restaurantId}/table-sessions`, {
    method: "POST",
    headers: validHeaders,
    body: JSON.stringify({ tableId }),
  }, 200)
  const validOrder = await httpJson(`/api/restaurants/${restaurantId}/orders`, {
    method: "POST",
    headers: { ...validHeaders, "idempotency-key": "security-owner-order-idem" },
    body: JSON.stringify(canonicalBody(session, "security-owner-order")),
  }, 201)
  for (const [name, capability] of [
    ["missing", null],
    ["forged", `${session.capability}x`],
    ["expired", createTableCapability({
      restaurantId,
      tableId,
      tableSessionId: session.tableSessionId,
      expiresAt: Date.now() - 1000,
    })],
  ]) {
    const response = await rawCreate(validHeaders, canonicalBody({
      ...session,
      capability,
    }, `security-${name}`), `security-${name}-idem`)
    assert.equal(response.status, 403, name)
  }
  for (const injected of [
    { total: 1 },
    { price: 1 },
    { orderStatus: "completed" },
    { actorRole: "owner" },
  ]) {
    const response = await rawCreate(
      validHeaders,
      { ...canonicalBody(session, `inject-${Object.keys(injected)[0]}`), ...injected },
      `inject-${Object.keys(injected)[0]}-idem`
    )
    assert.equal(response.status, 422)
  }
  const otherTable = await rawCreate(
    validHeaders,
    {
      ...canonicalBody(session, "security-other-table"),
      tableContext: {
        ...canonicalBody(session).tableContext,
        tableId: "table-b",
      },
    },
    "security-other-table-idem"
  )
  assert.equal(otherTable.status, 403)
  const otherRestaurant = await fetch(`${baseUrl}/api/restaurants/restaurant-other/orders`, {
    method: "POST",
    headers: { ...validHeaders, "idempotency-key": "security-other-restaurant-idem" },
    body: JSON.stringify(canonicalBody(session, "security-other-restaurant")),
  })
  assert.equal(otherRestaurant.status, 403)
  await httpJson(
    `/api/restaurants/${restaurantId}/orders/${validOrder.orderId}`,
    { method: "GET", headers: await headersFor(foreignAnonymousUser, true) },
    403
  )
  await assert.rejects(
    setDoc(doc(clientDb, "restaurants", restaurantId, "orders", "direct-public"), {
      restaurantId,
      createdBy: anonymousUser.uid,
    })
  )
  await assert.rejects(
    setDoc(doc(clientDb, "restaurants", restaurantId, "reviewAccess", "direct-public"), {
      restaurantId,
      orderId: "direct-public",
      reviewToken: "forged",
    })
  )
})

function canonicalBody(session, clientLineId = "line-main") {
  return {
    schemaVersion: 1,
    channel: "qr_table",
    serviceMode: "dine_in",
    clientRequestId: `request-${clientLineId}`,
    items: [{
      clientLineId,
      productId,
      quantity: 2,
      options: [],
      instructions: null,
    }],
    tableContext: {
      tableId,
      tableSessionId: session.tableSessionId,
      capability: session.capability,
    },
    customer: null,
    delivery: null,
    cashSessionId: null,
    notes: null,
  }
}

async function submitRestaurantReview(orderId, reviewToken) {
  const orderRef = doc(clientDb, "restaurants", restaurantId, "orders", orderId)
  const reviewRef = doc(
    clientDb,
    "restaurants",
    restaurantId,
    "reviews",
    orderId
  )
  await runTransaction(clientDb, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef)
    assert.equal(orderSnapshot.exists(), true)
    const order = orderSnapshot.data()
    transaction.set(reviewRef, {
      restaurantId,
      orderId,
      orderType: "dine_in",
      rating: 5,
      wouldRecommend: true,
      comment: "Très bon",
      customerDisplayName: "Client",
      customerName: "Client",
      customerId: order.createdBy,
      author: { displayName: "Client", customerId: order.createdBy },
      source: "qr_table",
      status: "published",
      reviewToken,
      orderCompletedAt:
        order.completedAt ?? order.timestamps?.completedAt ?? order.aggregateUpdatedAt ?? order.updatedAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

function createTableCapability(input) {
  const encodedPayload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url")
  const signature = createHmac("sha256", qrSecret)
    .update(encodedPayload)
    .digest("base64url")
  return `${encodedPayload}.${signature}`
}

async function command(user, orderId, body) {
  return httpJson(`/api/restaurants/${restaurantId}/orders/${orderId}/commands`, {
    method: "POST",
    headers: await headersFor(user, false),
    body: JSON.stringify(body),
  }, 200)
}

async function headersFor(user, appCheck) {
  const headers = {
    authorization: `Bearer ${await user.getIdToken()}`,
    "content-type": "application/json",
  }
  if (appCheck) headers["x-firebase-appcheck"] = appCheckProof
  return headers
}

function rawCreate(headers, body, idempotencyKey) {
  return fetch(`${baseUrl}/api/restaurants/${restaurantId}/orders`, {
    method: "POST",
    headers: { ...headers, "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  })
}

async function httpJson(path, init, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const body = await response.json().catch(() => null)
  assert.equal(response.status, expectedStatus, JSON.stringify(body))
  return body
}

function startNextServer() {
  return spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", String(port)],
    {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ORDER_QR_CAPABILITY_SECRET: qrSecret,
      ORDER_E2E_APP_CHECK_TOKEN: appCheckProof,
      ORDER_E2E_MODE: "1",
      NEXT_PUBLIC_QR_CANONICAL_MODE: "canonical",
      NEXT_PUBLIC_QR_CANONICAL_RESTAURANTS: restaurantId,
      NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY: "e2e-site-key",
      FIREBASE_PROJECT_ID: projectId,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
    },
    stdio: ["ignore", "pipe", "pipe"],
    }
  )
}

function createClientApp(label) {
  const app = initializeApp({
    apiKey: "demo-key",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
  }, `qr-http-${label}-${Date.now()}`)
  connectAuthEmulator(
    getAuth(app),
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
    { disableWarnings: true }
  )
  return app
}

async function waitForServer() {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error("Next.js E2E server did not start.")
}
