const admin = require("firebase-admin")
const dotenv = require("dotenv")

dotenv.config({ path: ".env.local" })
dotenv.config()

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.")
  process.exit(1)
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountJson) {
    return admin.credential.cert(JSON.parse(serviceAccountJson))
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  }

  return admin.credential.applicationDefault()
}

admin.initializeApp({
  credential: getCredential(),
  projectId,
})

const db = admin.firestore()

function normalizeOrderStatus(order) {
  const raw = order.orderStatus || order.kitchenStatus || order.status

  if (raw === "pending" || raw === "nouvelle" || raw === "en_attente" || raw === "pending_payment" || raw === "pending_payment_verification") {
    return "pending"
  }

  if (raw === "preparing" || raw === "in_preparation" || raw === "preparation" || raw === "en_preparation") {
    return "preparing"
  }

  if (raw === "ready" || raw === "prete" || raw === "pretes") {
    return "ready"
  }

  if (raw === "served" || raw === "servie" || raw === "servies") {
    if (order.orderType === "delivery") return "picked_up"
    if (order.orderType === "pickup" || order.orderType === "takeaway") return "picked_up"
    return "served"
  }

  if (raw === "completed" || raw === "terminee") {
    if (order.orderType === "delivery") return "picked_up"
    if (order.orderType === "pickup" || order.orderType === "takeaway") return "picked_up"
    return "served"
  }

  if (raw === "paid" || raw === "paye" || raw === "payee" || raw === "validated") {
    return "pending"
  }

  return "pending"
}

function itemStatusFromOrderStatus(status) {
  if (status === "preparing") return "preparing"
  if (status === "ready") return "ready"
  if (status === "served" || status === "picked_up") return "served"
  return "pending"
}

function normalizeItems(order, orderDocId, orderStatus) {
  const itemStatus = itemStatusFromOrderStatus(orderStatus)
  const now = new Date()

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return [
      {
        id: `${orderDocId}-legacy-item`,
        productId: "legacy",
        name: "Commande legacy",
        quantity: 1,
        unitPrice: Number(order.total || order.totalAmount || 0),
        total: Number(order.total || order.totalAmount || 0),
        status: itemStatus,
        createdAt: order.createdAt || now,
      },
    ]
  }

  return order.items.map((item, index) => ({
    ...item,
    id: item.id || `${item.productId || orderDocId}-${index}`,
    status: item.status || itemStatus,
    createdAt: item.createdAt || order.createdAt || now,
  }))
}

async function main() {
  const restaurantId = process.argv[2]
  const restaurantsQuery = restaurantId
    ? await db.collection("restaurants").where(admin.firestore.FieldPath.documentId(), "==", restaurantId).get()
    : await db.collection("restaurants").get()

  let batch = db.batch()
  let batchSize = 0
  let updated = 0
  let scanned = 0

  for (const restaurantDoc of restaurantsQuery.docs) {
    const ordersSnapshot = await restaurantDoc.ref.collection("orders").get()

    for (const orderDoc of ordersSnapshot.docs) {
      scanned += 1
      const order = orderDoc.data()
      const orderStatus = normalizeOrderStatus(order)
      const items = normalizeItems(order, orderDoc.id, orderStatus)

      const needsItemsMigration =
        !Array.isArray(order.items) ||
        order.items.length === 0 ||
        order.items.some((item) => !item.id || !item.status || !item.createdAt)

      if (order.orderStatus === orderStatus && !needsItemsMigration) continue

      batch.update(orderDoc.ref, {
        orderStatus,
        items,
        migratedOrderStatusAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      updated += 1
      batchSize += 1

      if (batchSize === 450) {
        await batch.commit()
        batch = db.batch()
        batchSize = 0
      }
    }
  }

  if (batchSize > 0) {
    await batch.commit()
  }

  console.log(`Scanned ${scanned} orders.`)
  console.log(`Updated ${updated} orders with canonical orderStatus.`)
}

main().catch((error) => {
  console.error("Order status migration failed:", error)
  process.exitCode = 1
})
