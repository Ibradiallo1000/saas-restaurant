#!/usr/bin/env node
/**
 * LOT 7 — Diagnostic de couverture des catégories marketplace
 *
 * Objectif :
 *   Analyser exhaustivement les catégories globales marketplace, les catégories locales,
 *   les produits et leurs mappings pour détecter les anomalies.
 *
 * Checks :
 *   1. Catégories globales sans produits liés
 *   2. Catégories locales sans marketplaceCategoryId
 *   3. marketplaceCategoryId orphelins (pointant vers une catégorie globale inexistante)
 *   4. iconKey invalides (non présents dans la bibliothèque d'icônes)
 *   5. Slugs dupliqués dans les catégories globales
 *   6. Catégories actives sans offres projetées (marketplaceRestaurantCategoryOffers)
 *   7. Catégories globales inactives
 *
 * Usage :
 *   node scripts/marketplace-category-coverage-diagnostic.mjs
 *
 * Sécurité :
 *   - Mode read-only : aucune écriture Firestore
 *   - Exige FIRESTORE_EMULATOR_HOST ou un environnement de confiance (qa/staging)
 */

import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { FieldPath, getFirestore } from "firebase-admin/firestore"

dotenv.config({ path: ".env.local" })
dotenv.config()

// =============================================================================
// VALIDATION ICÔNES (reproduites du module TS pour éviter la résolution)
// =============================================================================

const VALID_ICON_KEYS = new Set([
  "burger", "hot-dog", "kebab", "pizza", "sandwich", "shawarma", "tacos", "wrap",
  "barbecue", "brochettes", "fried-chicken", "grill", "meat", "roasted-chicken", "steak", "chicken",
  "calamari", "crab", "lobster", "fish", "shrimp", "seafood",
  "alloco", "attieke", "couscous", "african-dishes", "african-rice", "rice",
  "sides", "starters", "fries", "vegetables", "noodles", "pasta", "dishes", "salad", "soup",
  "bread", "breakfast", "eggs", "pancakes",
  "cake", "crepes", "desserts", "donuts", "ice-cream", "pastry", "waffles",
  "drinks", "hot-chocolate", "cocktails", "water", "juice", "milkshake", "smoothies", "soda", "tea", "coffee",
  "halal", "kids-menu", "spicy", "vegan", "vegetarian",
  "chef-special", "new", "promotion", "snack", "sweet", "wine", "generic", "bagel", "cake-large",
])

function isValidIconKey(value) {
  return typeof value === "string" && VALID_ICON_KEYS.has(value)
}

// =============================================================================
// SÉCURITÉ
// =============================================================================

const safeEnvironment =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
  ["qa", "staging"].includes(process.env.MARKETPLACE_DISCOVERY_ENV || "")

if (!safeEnvironment) {
  console.error(
    "Lecture refusée hors émulateur, QA ou staging. " +
    "Définissez FIRESTORE_EMULATOR_HOST ou MARKETPLACE_DISCOVERY_ENV=qa|staging."
  )
  process.exit(2)
}

// =============================================================================
// INITIALISATION FIRESTORE
// =============================================================================

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error("FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant.")
  process.exit(2)
}

if (!getApps().length) {
  initializeApp({ credential: getCredential(), projectId })
}
const db = getFirestore()

// =============================================================================
// STRUCTURES DE DONNÉES
// =============================================================================

const diagnosis = {
  // Métadonnées
  scannedAt: new Date().toISOString(),
  projectId,
  environment: process.env.FIRESTORE_EMULATOR_HOST
    ? "emulator"
    : process.env.MARKETPLACE_DISCOVERY_ENV || "unknown",

  // Statistiques générales
  globalCategoriesCount: 0,
  restaurantsCount: 0,
  localCategoriesCount: 0,
  productsCount: 0,
  projectedOffersCount: 0,

  // Anomalies
  globalCategoriesWithoutProducts: [],
  localCategoriesWithoutMapping: [],
  orphanMarketplaceCategoryIds: [],
  invalidIconKeys: [],
  duplicateSlugs: [],
  activeCategoriesWithoutProjectedOffers: [],
  inactiveGlobalCategories: [],

  // Détail par restaurant
  restaurants: [],

  // Temps d'exécution
  executionTimeMs: 0,
}

// =============================================================================
// COLLECTE DES DONNÉES
// =============================================================================

async function run() {
  const startTime = Date.now()

  try {
    // ── 1. Lire les catégories globales marketplace ──
    console.error("[diagnostic] Lecture des catégories globales marketplace...")
    const globalCategoriesSnapshot = await db
      .collection("marketplaceFoodCategories")
      .orderBy("sortOrder", "asc")
      .get()

    const globalCategories = {}
    const slugCount = {}

    for (const doc of globalCategoriesSnapshot.docs) {
      const data = { id: doc.id, ...doc.data() }
      globalCategories[doc.id] = data
      diagnosis.globalCategoriesCount++

      // Vérification slug dupliqué
      const slug = data.slug || data.normalizedName || ""
      if (slug) {
        slugCount[slug] = (slugCount[slug] || 0) + 1
      }

      // Vérification iconKey
      const iconKey = data.iconKey || data.icon
      if (iconKey && !isValidIconKey(iconKey)) {
        diagnosis.invalidIconKeys.push({
          categoryId: doc.id,
          categoryName: data.name,
          iconKey,
        })
      }

      // Catégories inactives
      if (data.active === false) {
        diagnosis.inactiveGlobalCategories.push({
          categoryId: doc.id,
          categoryName: data.name,
          slug: data.slug,
        })
      }
    }

    // Slugs dupliqués
    for (const [slug, count] of Object.entries(slugCount)) {
      if (count > 1) {
        const duplicates = globalCategoriesSnapshot.docs
          .filter((d) => {
            const data = d.data()
            return (data.slug || data.normalizedName || "") === slug
          })
          .map((d) => ({ id: d.id, name: d.data().name, slug }))
        diagnosis.duplicateSlugs.push(...duplicates)
      }
    }

    console.error(`[diagnostic] → ${diagnosis.globalCategoriesCount} catégories globales trouvées`)

    // ── 2. Lire les restaurants ──
    console.error("[diagnostic] Lecture des restaurants...")
    const restaurantsSnapshot = await db
      .collection("restaurants")
      .orderBy(FieldPath.documentId())
      .select("name", "slug", "isActive", "status")
      .get()

    diagnosis.restaurantsCount = restaurantsSnapshot.size
    console.error(`[diagnostic] → ${diagnosis.restaurantsCount} restaurants trouvés`)

    const marketplaceCategoryIdUsage = {} // compteur d'utilisation par ID

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id
      const restaurantName = restaurantDoc.data().name || restaurantId

      console.error(`[diagnostic]   Analyse du restaurant "${restaurantName}" (${restaurantId})...`)

      const restaurantReport = {
        restaurantId,
        restaurantName,
        localCategoriesCount: 0,
        productsCount: 0,
        localCategoriesMapped: 0,
        localCategoriesUnmapped: 0,
        unmappedCategories: [],
      }

      // ── 2a. Lire les catégories locales ──
      const localCategoriesSnapshot = await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("categories")
        .get()

      const localCategoryIds = []
      for (const catDoc of localCategoriesSnapshot.docs) {
        const catData = { id: catDoc.id, ...catDoc.data() }
        localCategoryIds.push(catDoc.id)
        restaurantReport.localCategoriesCount++

        const mpcId = catData.marketplaceCategoryId

        if (mpcId) {
          marketplaceCategoryIdUsage[mpcId] = (marketplaceCategoryIdUsage[mpcId] || 0) + 1
          restaurantReport.localCategoriesMapped++

          // Vérification orphan
          if (!globalCategories[mpcId]) {
            diagnosis.orphanMarketplaceCategoryIds.push({
              categoryId: catDoc.id,
              categoryName: catData.name,
              restaurantId,
              restaurantName,
              marketplaceCategoryId: mpcId,
            })
          }
        } else {
          restaurantReport.localCategoriesUnmapped++
          restaurantReport.unmappedCategories.push({
            categoryId: catDoc.id,
            categoryName: catData.name,
          })
          diagnosis.localCategoriesWithoutMapping.push({
            categoryId: catDoc.id,
            categoryName: catData.name,
            restaurantId,
            restaurantName,
          })
        }
      }

      // ── 2b. Lire les produits ──
      const productsSnapshot = await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("products")
        .select("name", "categoryId", "marketplaceCategoryId", "isActive")
        .get()

      for (const prodDoc of productsSnapshot.docs) {
        const prodData = prodDoc.data()
        restaurantReport.productsCount++
        diagnosis.productsCount++

        // marketplaceCategoryId orphelin sur un produit
        const mpcId = prodData.marketplaceCategoryId
        if (mpcId && !globalCategories[mpcId]) {
          diagnosis.orphanMarketplaceCategoryIds.push({
            productId: prodDoc.id,
            productName: prodData.name,
            restaurantId,
            restaurantName,
            marketplaceCategoryId: mpcId,
          })
        }
      }

      diagnosis.localCategoriesCount += restaurantReport.localCategoriesCount
      diagnosis.restaurants.push(restaurantReport)
    }

    // ── 3. Catégories globales sans produits liés ──
    for (const [globalCatId, globalCat] of Object.entries(globalCategories)) {
      const usageCount = marketplaceCategoryIdUsage[globalCatId] || 0
      if (usageCount === 0) {
        diagnosis.globalCategoriesWithoutProducts.push({
          categoryId: globalCatId,
          categoryName: globalCat.name,
          slug: globalCat.slug,
          active: globalCat.active,
        })
      }
    }

    // ── 4. Lire les offres projetées marketplaceRestaurantCategoryOffers ──
    console.error("[diagnostic] Lecture des offres projetées...")
    const projectedOffersSnapshot = await db
      .collection("marketplaceRestaurantCategoryOffers")
      .select("marketplaceCategoryId", "restaurantId")
      .get()

    const projectedMarketplaceCategoryIds = new Set()
    for (const doc of projectedOffersSnapshot.docs) {
      const data = doc.data()
      if (data.marketplaceCategoryId) {
        projectedMarketplaceCategoryIds.add(data.marketplaceCategoryId)
      }
    }
    diagnosis.projectedOffersCount = projectedOffersSnapshot.size

    // Catégories actives sans offres projetées
    for (const [globalCatId, globalCat] of Object.entries(globalCategories)) {
      if (globalCat.active !== false && !projectedMarketplaceCategoryIds.has(globalCatId)) {
        diagnosis.activeCategoriesWithoutProjectedOffers.push({
          categoryId: globalCatId,
          categoryName: globalCat.name,
          slug: globalCat.slug,
        })
      }
    }

    // ── Récapitulatif ──
    diagnosis.executionTimeMs = Date.now() - startTime
    printReport()

  } catch (error) {
    console.error(JSON.stringify({
      event: "diagnostic_error",
      error: normalizeError(error),
    }))
    process.exitCode = 1
  }
}

// =============================================================================
// RAPPORT
// =============================================================================

function printReport() {
  const report = [
    "═══════════════════════════════════════════════════════════",
    "   DIAGNOSTIC COUVERTURE CATÉGORIES MARKETPLACE",
    "═══════════════════════════════════════════════════════════",
    "",
    `  Scanné le      : ${diagnosis.scannedAt}`,
    `  Projet         : ${diagnosis.projectId}`,
    `  Environnement  : ${diagnosis.environment}`,
    `  Temps d'exéc.  : ${diagnosis.executionTimeMs} ms`,
    "",
    "── RÉSUMÉ GÉNÉRAL ──",
    `  Catégories globales          : ${diagnosis.globalCategoriesCount}`,
    `  Restaurants                  : ${diagnosis.restaurantsCount}`,
    `  Catégories locales           : ${diagnosis.localCategoriesCount}`,
    `  Produits                     : ${diagnosis.productsCount}`,
    `  Offres projetées             : ${diagnosis.projectedOffersCount}`,
    "",
    "── ANOMALIES ──",
    `  Catégories globales sans produits              : ${diagnosis.globalCategoriesWithoutProducts.length}`,
    `  Catégories locales sans mapping marketplace    : ${diagnosis.localCategoriesWithoutMapping.length}`,
    `  marketplaceCategoryId orphelins                : ${diagnosis.orphanMarketplaceCategoryIds.length}`,
    `  iconKey invalides                              : ${diagnosis.invalidIconKeys.length}`,
    `  Slugs dupliqués                                : ${diagnosis.duplicateSlugs.length}`,
    `  Catégories actives sans offres projetées       : ${diagnosis.activeCategoriesWithoutProjectedOffers.length}`,
    `  Catégories globales inactives                  : ${diagnosis.inactiveGlobalCategories.length}`,
    "",
  ]

  // Détail des anomalies (non vide)
  if (diagnosis.globalCategoriesWithoutProducts.length > 0) {
    report.push("── CATÉGORIES GLOBALES SANS PRODUITS ──")
    for (const cat of diagnosis.globalCategoriesWithoutProducts) {
      const status = cat.active === false ? " [INACTIVE]" : ""
      report.push(`  • ${cat.categoryName} (${cat.categoryId})${status}`)
    }
    report.push("")
  }

  if (diagnosis.localCategoriesWithoutMapping.length > 0) {
    report.push("── CATÉGORIES LOCALES SANS MAPPING MARKETPLACE (premières 20) ──")
    const sample = diagnosis.localCategoriesWithoutMapping.slice(0, 20)
    for (const cat of sample) {
      report.push(`  • "${cat.categoryName}" → restaurant: ${cat.restaurantName || cat.restaurantId}`)
    }
    if (diagnosis.localCategoriesWithoutMapping.length > 20) {
      report.push(`  ... et ${diagnosis.localCategoriesWithoutMapping.length - 20} autres`)
    }
    report.push("")
  }

  if (diagnosis.orphanMarketplaceCategoryIds.length > 0) {
    report.push("── MARKETPLACE CATEGORY ID ORPHELINS ──")
    for (const orphan of diagnosis.orphanMarketplaceCategoryIds) {
      const source = orphan.categoryName
        ? `catégorie "${orphan.categoryName}"`
        : `produit "${orphan.productName}"`
      report.push(`  • ${source} (${orphan.restaurantName}) → ID introuvable: ${orphan.marketplaceCategoryId}`)
    }
    report.push("")
  }

  if (diagnosis.invalidIconKeys.length > 0) {
    report.push("── ICONKEY INVALIDES ──")
    for (const icon of diagnosis.invalidIconKeys) {
      report.push(`  • ${icon.categoryName} (${icon.categoryId}) → iconKey: "${icon.iconKey}"`)
    }
    report.push("")
  }

  if (diagnosis.duplicateSlugs.length > 0) {
    report.push("── SLUGS DUPLIQUÉS ──")
    for (const dup of diagnosis.duplicateSlugs) {
      report.push(`  • "${dup.name}" (${dup.id}) → slug: "${dup.slug}"`)
    }
    report.push("")
  }

  if (diagnosis.activeCategoriesWithoutProjectedOffers.length > 0) {
    report.push("── CATÉGORIES ACTIVES SANS OFFRES PROJETÉES ──")
    for (const cat of diagnosis.activeCategoriesWithoutProjectedOffers) {
      report.push(`  • ${cat.categoryName} (${cat.categoryId})`)
    }
    report.push("")
  }

  if (diagnosis.inactiveGlobalCategories.length > 0) {
    report.push("── CATÉGORIES GLOBALES INACTIVES ──")
    for (const cat of diagnosis.inactiveGlobalCategories) {
      report.push(`  • ${cat.categoryName} (${cat.categoryId})`)
    }
    report.push("")
  }

  // Décompte par restaurant
  report.push("── DÉCOMPTE PAR RESTAURANT ──")
  for (const r of diagnosis.restaurants) {
    const mappedRate = r.localCategoriesCount > 0
      ? Math.round((r.localCategoriesMapped / r.localCategoriesCount) * 100)
      : 0
    report.push(
      `  ${r.restaurantName}: ${r.localCategoriesCount} cat. locales, ` +
      `${r.localCategoriesMapped} mappées (${mappedRate}%), ` +
      `${r.productsCount} produits`
    )
  }
  report.push("")

  report.push("═══════════════════════════════════════════════════════════")

  // Sortie JSON détaillée sur stdout, rapport lisible sur stderr
  console.log(JSON.stringify(diagnosis, null, 2))
  console.error(report.join("\n"))
}

function normalizeError(error) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) }
}

function getCredential() {
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
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

// =============================================================================
// EXÉCUTION
// =============================================================================

run()
