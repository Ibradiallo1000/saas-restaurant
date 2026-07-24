#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldPath, getFirestore } from "firebase-admin/firestore"

import marketplaceSync from "../src/lib/marketplace-discovery/marketplace-discovery-sync.ts"

const { syncMarketplaceProductById } = marketplaceSync

dotenv.config({ path: ".env.local" })
dotenv.config()

const args = parseArgs(process.argv.slice(2))
const dryRun = !args.write
const limit = positiveInteger(args.limit, 10, 1000)
const batchSize = positiveInteger(args["batch-size"], 100, 400)
const safeEnvironment = Boolean(process.env.FIRESTORE_EMULATOR_HOST) || ["qa", "staging"].includes(process.env.MARKETPLACE_DISCOVERY_ENV || "")

if (!safeEnvironment) fail("Lecture refusée hors émulateur, QA ou staging. Définissez FIRESTORE_EMULATOR_HOST ou MARKETPLACE_DISCOVERY_ENV=qa|staging.")
if (args.write && !args["restaurant-id"] && !args["allow-global"]) fail("Une écriture globale exige --allow-global ; préférez --restaurant-id.")
if (args.write && !args.limit) fail("Une écriture exige une limite explicite via --limit.")

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) fail("FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant.")
if (!getApps().length) initializeApp({ credential: getCredential(), projectId })
const db = getFirestore()
const summary = { dryRun, restaurantsRead: 0, productsRead: 0, projected: 0, skipped: 0, invalid: 0, errors: 0, disabled: 0, deleted: 0, writes: 0, nextCursor: null }

try {
  let restaurantQuery = db.collection("restaurants").orderBy(FieldPath.documentId()).limit(limit)
  if (args["restaurant-id"]) restaurantQuery = db.collection("restaurants").where(FieldPath.documentId(), "==", args["restaurant-id"]).limit(1)
  else if (args.cursor) restaurantQuery = restaurantQuery.startAfter(args.cursor)
  const restaurants = await restaurantQuery.get()
  summary.restaurantsRead = restaurants.size
  summary.nextCursor = restaurants.docs.at(-1)?.id ?? null

  for (const restaurantDocument of restaurants.docs) {
    const restaurant = { id: restaurantDocument.id, ...restaurantDocument.data() }
    let productCursor = null
    do {
      let productQuery = restaurantDocument.ref.collection("products").orderBy(FieldPath.documentId()).limit(batchSize)
      if (productCursor) productQuery = productQuery.startAfter(productCursor)
      const products = await productQuery.get()
      if (products.empty) break
      productCursor = products.docs.at(-1)?.id ?? null
      for (const productDocument of products.docs) {
        summary.productsRead += 1
        try {
          if (dryRun) summary.skipped += 1
          else {
            const result = await syncMarketplaceProductById({ db, restaurantId: restaurant.id, productId: productDocument.id })
            if (result.outcome === "created-or-updated") summary.projected += 1
            if (result.outcome === "disabled") summary.disabled += 1
            if (result.outcome === "deleted") summary.deleted += 1
            summary.writes += 1
          }
        } catch (error) {
          summary.errors += 1
          console.error(JSON.stringify({ event: "marketplace_projection_error", restaurantId: restaurant.id, productId: productDocument.id, error: normalizeError(error) }))
        }
      }
      if (products.size < batchSize) break
    } while (productCursor)
  }
} catch (error) {
  summary.errors += 1
  console.error(JSON.stringify({ event: "marketplace_backfill_error", error: normalizeError(error) }))
  process.exitCode = 1
} finally {
  console.log(JSON.stringify({ event: "marketplace_backfill_summary", ...summary }))
}

function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (!value.startsWith("--")) continue; const key = value.slice(2); const next = values[index + 1]; if (!next || next.startsWith("--")) result[key] = true; else { result[key] = next; index += 1 } } return result }
function positiveInteger(value, fallback, maximum) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback }
function normalizeError(error) { return error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } }
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
