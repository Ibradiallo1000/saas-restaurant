import { initializeApp, deleteApp } from "firebase-admin/app"
import { getFirestore, Timestamp } from "firebase-admin/firestore"

const projectId = process.env.FIREBASE_PROJECT_ID
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST

if (
  projectId !== "demo-oordera-local" ||
  firestoreHost !== "127.0.0.1:8282" ||
  authHost !== "127.0.0.1:9199"
) {
  throw new Error("Local recipe seed refused outside demo-oordera-local emulators.")
}

const app = initializeApp({ projectId }, `local-recipe-${Date.now()}`)
const db = getFirestore(app)
const restaurantId = "demo-restaurant"

const users = {
  manager: await ensureUser("manager.local@example.test", "Password123!"),
  kitchen: await ensureUser("kitchen.local@example.test", "Password123!"),
  cashier: await ensureUser("cashier.local@example.test", "Password123!"),
}

const root = db.collection("restaurants").doc(restaurantId)
const now = Timestamp.now()

await Promise.all([
  root.set({
    name: "Univers Food Local",
    slug: "univers-food-local",
    status: "active",
    active: true,
    currency: "FCFA",
    publicOrderingOpen: true,
    taxRate: 0,
    pricesIncludeTax: false,
    createdAt: now,
    updatedAt: now,
  }),
  root.collection("tables").doc("demo-table").set({
    restaurantId,
    name: "Table 1",
    number: 1,
    zoneId: "main",
    status: "free",
    active: true,
    currentSessionId: null,
  }),
  root.collection("categories").doc("kitchen").set({
    restaurantId,
    name: "Cuisine",
    active: true,
    isActive: true,
    preparationMode: "kitchen",
    order: 1,
  }),
  root.collection("categories").doc("bar").set({
    restaurantId,
    name: "Bar",
    active: true,
    isActive: true,
    preparationMode: "bar",
    order: 2,
  }),
  root.collection("categories").doc("direct").set({
    restaurantId,
    name: "Service direct",
    active: true,
    isActive: true,
    preparationMode: "direct",
    order: 3,
  }),
  seedProduct("pizza-local", {
    name: "Pizza locale",
    price: 4500,
    categoryId: "kitchen",
    preparationMode: "kitchen",
    requiresKitchen: true,
  }),
  seedProduct("jus-local", {
    name: "Jus local",
    price: 1500,
    categoryId: "bar",
    preparationMode: "bar",
    requiresKitchen: false,
  }),
  seedProduct("coca-local", {
    name: "Coca Cola",
    price: 500,
    categoryId: "direct",
    preparationMode: "direct",
    requiresKitchen: false,
    stockArticleId: "coca-article",
  }),
  root.collection("stockItemsV2").doc("coca-article").set({
    restaurantId,
    name: "Coca Cola",
    status: "active",
    trackingMode: "AUTOMATIC_SIMPLE",
    baseUnit: "unit",
    lowStockThreshold: 5,
    createdAt: now,
    updatedAt: now,
  }),
  root.collection("stockBalancesV2").doc("coca-article").set({
    restaurantId,
    articleId: "coca-article",
    quantity: 20,
    unit: "unit",
    version: 1,
    lastOperationAt: null,
    lastSupplyAt: null,
  }),
  root.collection("stockItemCostsV2").doc("coca-article").set({
    restaurantId,
    articleId: "coca-article",
    referenceCost: 300,
    currency: "FCFA",
    version: 1,
  }),
  root.collection("stockAutomaticAssociationsV2").doc("coca-local--coca-article").set({
    restaurantId,
    productId: "coca-local",
    articleId: "coca-article",
    quantity: 1,
    quantityPerSale: 1,
    unit: "unit",
    status: "active",
  }),
  root.collection("cashSessions").doc("cash-session-local").set({
    restaurantId,
    status: "open",
    openedBy: users.cashier,
    openedAt: now,
    openingBalance: 100000,
  }),
  seedUser(users.manager, "manager", "Manager Local"),
  seedUser(users.kitchen, "kitchen", "Cuisine Local"),
  seedUser(users.cashier, "cashier", "Caisse Local"),
])

console.log(JSON.stringify({
  projectId,
  firestoreHost,
  authHost,
  restaurantId,
  users: Object.keys(users),
}))

await deleteApp(app)

function seedProduct(id, product) {
  return root.collection("products").doc(id).set({
    restaurantId,
    ...product,
    isActive: true,
    active: true,
    reviewsEnabled: true,
    description: `${product.name} — donnée locale de recette`,
    createdAt: now,
    updatedAt: now,
  })
}

function seedUser(uid, role, name) {
  return db.collection("users").doc(uid).set({
    uid,
    restaurantId,
    role,
    name,
    displayName: name,
    active: true,
    status: "active",
    createdAt: now,
    updatedAt: now,
  })
}

async function ensureUser(email, password) {
  const base = `http://${authHost}/identitytoolkit.googleapis.com/v1`
  const signUp = await fetch(`${base}/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const signUpBody = await signUp.json()
  if (signUp.ok) return signUpBody.localId

  const signIn = await fetch(`${base}/accounts:signInWithPassword?key=demo-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const signInBody = await signIn.json()
  if (!signIn.ok) throw new Error(`Unable to seed local Auth user: ${signInBody.error?.message}`)
  return signInBody.localId
}
