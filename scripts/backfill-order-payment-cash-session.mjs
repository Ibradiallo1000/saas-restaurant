#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldPath, getFirestore } from "firebase-admin/firestore"

dotenv.config({ path: ".env.local" })
dotenv.config()

const args = parseArgs(process.argv.slice(2))
const dryRun = args.write !== true
const limit = positiveInteger(args.limit, 500, 5000)
const restaurantId = stringArg(args["restaurant-id"])
const safeEnvironment =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
  ["qa", "staging"].includes(process.env.ORDER_SESSION_BACKFILL_ENV || "")

if (!safeEnvironment) {
  fail(
    "Lecture refusée hors émulateur, QA ou staging. Définissez FIRESTORE_EMULATOR_HOST ou ORDER_SESSION_BACKFILL_ENV=qa|staging."
  )
}
if (!restaurantId) fail("--restaurant-id est obligatoire.")
if (args.write && !args.limit) fail("Une écriture exige une limite explicite via --limit.")

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) fail("FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant.")
if (!getApps().length) initializeApp({ credential: getCredential(), projectId })

const db = getFirestore()
const restaurantRef = db.collection("restaurants").doc(restaurantId)
const summary = {
  dryRun,
  restaurantId,
  paymentsRead: 0,
  terminalOrdersRead: 0,
  attached: 0,
  ambiguous: 0,
  unattached: 0,
  ignored: 0,
  writes: 0,
}

try {
  const paymentSnapshot = await restaurantRef
    .collection("payments")
    .where("status", "==", "confirmed")
    .limit(limit)
    .get()
  summary.paymentsRead = paymentSnapshot.size
  if (!dryRun && paymentSnapshot.size >= limit) {
    throw new Error(
      "La limite de paiements a été atteinte ; augmentez --limit avant toute écriture pour éviter un rattachement incomplet."
    )
  }

  const sessionsByOrder = new Map()
  for (const paymentDocument of paymentSnapshot.docs) {
    const payment = paymentDocument.data()
    const orderId = stringValue(payment.orderId)
    const sessionId = stringValue(payment.sessionId)
    if (!orderId || !sessionId) continue
    const sessions = sessionsByOrder.get(orderId) ?? new Set()
    sessions.add(sessionId)
    sessionsByOrder.set(orderId, sessions)
  }

  const orderIds = [...sessionsByOrder.keys()].slice(0, limit)
  for (const orderId of orderIds) {
    const orderRef = restaurantRef.collection("orders").doc(orderId)
    const orderSnapshot = await orderRef.get()
    if (!orderSnapshot.exists) {
      summary.unattached += 1
      continue
    }
    const order = orderSnapshot.data()
    if (!isTerminalOrder(order)) {
      summary.ignored += 1
      continue
    }
    summary.terminalOrdersRead += 1
    if (stringValue(order.paymentCashSessionId)) {
      summary.ignored += 1
      continue
    }
    const sessions = [...(sessionsByOrder.get(orderId) ?? [])]
    if (sessions.length !== 1) {
      summary.ambiguous += 1
      continue
    }
    summary.attached += 1
    if (!dryRun) {
      await orderRef.update({
        paymentCashSessionId: sessions[0],
        sessionBackfillVersion: 1,
        sessionBackfilledAt: new Date(),
      })
      summary.writes += 1
    }
  }
} catch (error) {
  console.error(JSON.stringify({ event: "order_session_backfill_error", error: normalizeError(error) }))
  process.exitCode = 1
} finally {
  console.log(JSON.stringify({ event: "order_session_backfill_summary", ...summary }))
}

function isTerminalOrder(order) {
  const status = stringValue(order?.orderStatus) || stringValue(order?.kitchenStatus)
  const paid = ["paid", "validated"].includes(stringValue(order?.paymentStatus))
  return paid && ["served", "picked_up", "completed"].includes(status)
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith("--")) continue
    const key = value.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith("--")) result[key] = true
    else {
      result[key] = next
      index += 1
    }
  }
  return result
}

function stringArg(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

function normalizeError(error) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) }
}

function fail(message) {
  console.error(message)
  process.exit(2)
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (serviceAccountJson) return cert(JSON.parse(serviceAccountJson))
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  }
  return applicationDefault()
}
