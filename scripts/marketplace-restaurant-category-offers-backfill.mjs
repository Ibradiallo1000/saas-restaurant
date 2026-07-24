#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldPath, getFirestore } from "firebase-admin/firestore"

import marketplaceSync from "../src/lib/marketplace-discovery/marketplace-discovery-sync.ts"

const { syncMarketplaceRestaurantCategoryOffers } = marketplaceSync

dotenv.config({ path: ".env.local" })
dotenv.config()

const args = parseArgs(process.argv.slice(2))
const dryRun = !args.write
const limit = positiveInteger(args.limit, 50, 1000)
const safeEnvironment = Boolean(process.env.FIRESTORE_EMULATOR_HOST) || ["qa", "staging"].includes(process.env.MARKETPLACE_DISCOVERY_ENV || "")

if (!safeEnvironment) fail("Lecture refusée hors émulateur, QA ou staging. Définissez FIRESTORE_EMULATOR_HOST ou MARKETPLACE_DISCOVERY_ENV=qa|staging.")
if (!args["restaurant-id"] && !args["allow-global"]) fail("Le backfill exige --restaurant-id ou --allow-global.")
if (args.write && !args.limit) fail("Une écriture exige une limite explicite via --limit.")

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) fail("FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant.")
if (!getApps().length) initializeApp({ credential: getCredential(), projectId })

const db = getFirestore()
const summary = { dryRun, restaurantsRead: 0, synchronized: 0, deleted: 0, skipped: 0, errors: 0, nextCursor: null }

try {
  let restaurantQuery = db.collection("restaurants").orderBy(FieldPath.documentId()).limit(limit)
  if (args["restaurant-id"]) restaurantQuery = db.collection("restaurants").where(FieldPath.documentId(), "==", args["restaurant-id"]).limit(1)
  else if (args.cursor) restaurantQuery = restaurantQuery.startAfter(args.cursor)
  const restaurants = await restaurantQuery.get()
  summary.restaurantsRead = restaurants.size
  summary.nextCursor = restaurants.docs.at(-1)?.id ?? null

  for (const restaurantDocument of restaurants.docs) {
    if (dryRun) {
      summary.skipped += 1
      continue
    }
    try {
      const result = await syncMarketplaceRestaurantCategoryOffers({ db, restaurantId: restaurantDocument.id })
      summary.synchronized += result.createdOrUpdated
      summary.deleted += result.deleted
      summary.skipped += result.skipped
    } catch (error) {
      summary.errors += 1
      console.error(JSON.stringify({ event: "marketplace_restaurant_category_backfill_error", restaurantId: restaurantDocument.id, error: normalizeError(error) }))
    }
  }
} catch (error) {
  summary.errors += 1
  console.error(JSON.stringify({ event: "marketplace_restaurant_category_backfill_fatal", error: normalizeError(error) }))
  process.exitCode = 1
} finally {
  console.log(JSON.stringify({ event: "marketplace_restaurant_category_backfill_summary", ...summary }))
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
