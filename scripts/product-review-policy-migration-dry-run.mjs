#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldPath, getFirestore } from "firebase-admin/firestore"

dotenv.config({ path: ".env.local" })
dotenv.config()

const args = parseArgs(process.argv.slice(2))
const limit = positiveInteger(args.limit, 25, 500)
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

if (!projectId) fail("FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant.")
if (!getApps().length) initializeApp({ credential: getCredential(), projectId })

const db = getFirestore()
const summary = {
  dryRun: true,
  restaurantsRead: 0,
  categoriesAnalyzed: 0,
  homogeneousCategories: 0,
  mixedCategories: 0,
  productsAnalyzed: 0,
  productsToInherit: 0,
  exceptionsEnabled: 0,
  exceptionsDisabled: 0,
  unresolvedCategories: 0,
  unresolvedProducts: 0,
  recommendations: [],
}

try {
  let restaurantQuery = db.collection("restaurants").orderBy(FieldPath.documentId()).limit(limit)
  if (args["restaurant-id"]) restaurantQuery = db.collection("restaurants").where(FieldPath.documentId(), "==", args["restaurant-id"]).limit(1)
  const restaurants = await restaurantQuery.get()
  summary.restaurantsRead = restaurants.size

  for (const restaurantDocument of restaurants.docs) {
    const [categoriesSnapshot, productsSnapshot] = await Promise.all([
      restaurantDocument.ref.collection("categories").get(),
      restaurantDocument.ref.collection("products").get(),
    ])
    const productsByCategory = new Map()
    productsSnapshot.docs.forEach((document) => {
      const product = { id: document.id, ...document.data() }
      const categoryId = typeof product.categoryId === "string" && product.categoryId.trim() ? product.categoryId.trim() : "__uncategorized__"
      productsByCategory.set(categoryId, [...(productsByCategory.get(categoryId) ?? []), product])
    })

    for (const categoryDocument of categoriesSnapshot.docs) {
      const category = { id: categoryDocument.id, ...categoryDocument.data() }
      const categoryProducts = productsByCategory.get(category.id) ?? []
      summary.categoriesAnalyzed += 1
      summary.productsAnalyzed += categoryProducts.length
      const configuredValues = categoryProducts
        .map((product) => product.reviewsEnabled)
        .filter((value) => typeof value === "boolean")

      if (configuredValues.length === categoryProducts.length && configuredValues.length > 0) {
        const uniqueValues = new Set(configuredValues)
        if (uniqueValues.size === 1) {
          summary.homogeneousCategories += 1
          summary.productsToInherit += categoryProducts.length
          summary.recommendations.push({
            restaurantId: restaurantDocument.id,
            categoryId: category.id,
            categoryName: category.name ?? category.id,
            categoryReviewsEnabled: configuredValues[0],
            productsToInherit: categoryProducts.length,
            exceptionsEnabled: 0,
            exceptionsDisabled: 0,
          })
        } else {
          summary.mixedCategories += 1
          const enabledCount = configuredValues.filter(Boolean).length
          const disabledCount = configuredValues.length - enabledCount
          const categoryReviewsEnabled = enabledCount >= disabledCount
          summary.productsToInherit += categoryProducts.filter((product) => product.reviewsEnabled === categoryReviewsEnabled).length
          summary.exceptionsEnabled += categoryProducts.filter((product) => product.reviewsEnabled === true && categoryReviewsEnabled === false).length
          summary.exceptionsDisabled += categoryProducts.filter((product) => product.reviewsEnabled === false && categoryReviewsEnabled === true).length
          summary.recommendations.push({
            restaurantId: restaurantDocument.id,
            categoryId: category.id,
            categoryName: category.name ?? category.id,
            categoryReviewsEnabled,
            productsToInherit: categoryProducts.filter((product) => product.reviewsEnabled === categoryReviewsEnabled).length,
            exceptionsEnabled: categoryProducts.filter((product) => product.reviewsEnabled === true && categoryReviewsEnabled === false).length,
            exceptionsDisabled: categoryProducts.filter((product) => product.reviewsEnabled === false && categoryReviewsEnabled === true).length,
          })
        }
      } else {
        summary.unresolvedCategories += 1
        summary.unresolvedProducts += categoryProducts.filter((product) => typeof product.reviewsEnabled !== "boolean").length
      }
    }
  }
} catch (error) {
  console.error(JSON.stringify({ event: "product_review_policy_migration_error", error: normalizeError(error) }, null, 2))
  process.exitCode = 1
} finally {
  console.log(JSON.stringify({ event: "product_review_policy_migration_dry_run", ...summary }, null, 2))
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
  return applicationDefault()
}
