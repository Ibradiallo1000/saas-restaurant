#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldPath, getFirestore } from "firebase-admin/firestore"

import { syncMarketplaceProductById } from "../src/lib/marketplace-discovery/marketplace-discovery-sync.ts"

dotenv.config({ path: ".env.local" })
dotenv.config()

const args = parseArgs(process.argv.slice(2))
const dryRun = !args.write
const limit = positiveInteger(args.limit, 100, 1000)
const batchSize = positiveInteger(args["batch-size"], 100, 400)
const safeEnvironment = Boolean(process.env.FIRESTORE_EMULATOR_HOST) || ["qa", "staging"].includes(process.env.MARKETPLACE_DISCOVERY_ENV || "")

if (!args["restaurant-id"] && !args["allow-global"]) fail("La reconstruction exige --restaurant-id ou --allow-global.")
if (!safeEnvironment) fail("Lecture refusée hors émulateur, QA ou staging.")
if (args.write && !args.limit) fail("Une reconstruction écrite exige --limit.")
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) fail("FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant.")
if (!getApps().length) initializeApp({ credential: getCredential(), projectId })
const db = getFirestore()
const summary = { dryRun, examined: 0, obsolete: 0, synchronized: 0, disabled: 0, deleted: 0, errors: 0 }

try {
  let query = db.collection("marketplaceDishOffers").orderBy(FieldPath.documentId()).limit(limit)
  if (args["restaurant-id"]) query = db.collection("marketplaceDishOffers").where("restaurantId", "==", args["restaurant-id"]).orderBy(FieldPath.documentId()).limit(limit)
  const snapshot = await query.get()
  let batch = dryRun ? null : db.batch()
  let pending = 0
  for (const offer of snapshot.docs) {
    summary.examined += 1
    const data = offer.data()
    const product = await db.doc(`restaurants/${data.restaurantId}/products/${data.productId}`).get()
    if (!product.exists) {
      summary.obsolete += 1
      if (!batch) continue
      batch.delete(offer.ref)
      pending += 1
      if (pending >= batchSize) { await batch.commit(); summary.deleted += pending; batch = db.batch(); pending = 0 }
      continue
    }
    if (!dryRun) {
      const result = await syncMarketplaceProductById({ db, restaurantId: String(data.restaurantId), productId: String(data.productId) })
      if (result.outcome === "created-or-updated") summary.synchronized += 1
      if (result.outcome === "disabled") summary.disabled += 1
      if (result.outcome === "deleted") summary.deleted += 1
    }
  }
  if (batch && pending) { await batch.commit(); summary.deleted += pending }
} catch (error) {
  summary.errors += 1
  console.error(JSON.stringify({ event: "marketplace_rebuild_error", error: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
} finally {
  console.log(JSON.stringify({ event: "marketplace_rebuild_summary", ...summary }))
  console.log("Exécuter ensuite marketplace-discovery-backfill.mjs avec le même périmètre pour régénérer les offres.")
}

function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (!value.startsWith("--")) continue; const key = value.slice(2); const next = values[index + 1]; if (!next || next.startsWith("--")) result[key] = true; else { result[key] = next; index += 1 } } return result }
function positiveInteger(value, fallback, maximum) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback }
function fail(message) { console.error(message); process.exit(2) }
function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (serviceAccountJson) return cert(JSON.parse(serviceAccountJson))
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  }
  return applicationDefault()
}
