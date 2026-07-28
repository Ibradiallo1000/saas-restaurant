/**
 * Production migration tool: inventoryItems (V1) -> stock V2.
 *
 * Usage:
 *   npm run migrate:inventory-v1-v2 -- --restaurantId=XXX --validate
 *   npm run migrate:inventory-v1-v2 -- --restaurantId=XXX --dry-run
 *   npm run migrate:inventory-v1-v2 -- --restaurantId=XXX --apply --confirm=XXX
 *
 * Validation and dry-run are read-only. Apply is deliberately guarded and uses
 * one Firestore transaction per article. Existing V2 documents are never
 * overwritten or repaired automatically.
 */

import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import admin from "firebase-admin"
import dotenv from "dotenv"

export const V2_COLLECTIONS = Object.freeze({
  articles: "stockItemsV2",
  balances: "stockBalancesV2",
  costs: "stockItemCostsV2",
  operations: "stockOperationsV2",
})

export const VALID_V1_TRACKING_MODES = new Set(["auto", "manual"])
export const VALID_V2_UNITS = new Set(["unit", "kg", "g", "l", "ml"])

export function parseArgs(argv) {
  const args = {}
  for (const token of argv) {
    if (!token.startsWith("--")) continue
    const separator = token.indexOf("=")
    if (separator === -1) {
      args[token.slice(2)] = true
    } else {
      args[token.slice(2, separator)] = token.slice(separator + 1)
    }
  }

  const selectedModes = ["validate", "dry-run", "apply"].filter(
    (name) => args[name] === true
  )
  if (selectedModes.length > 1) {
    throw new Error(
      "Choisissez un seul mode parmi --validate, --dry-run et --apply."
    )
  }

  return {
    restaurantId:
      typeof args.restaurantId === "string" ? args.restaurantId.trim() : "",
    mode: selectedModes[0] ?? "dry-run",
    confirm: typeof args.confirm === "string" ? args.confirm.trim() : "",
    help: args.help === true,
  }
}

export function toV2TrackingMode(value) {
  if (value === "auto") return "AUTOMATIC_SIMPLE"
  if (value === "manual") return "CONTROLLED"
  return null
}

export function toV2Unit(value) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLocaleLowerCase("fr")
  if (["pièce", "piece", "unité", "unite", "unit"].includes(normalized)) {
    return "unit"
  }
  if (["kg", "kilogramme"].includes(normalized)) return "kg"
  if (["g", "gramme"].includes(normalized)) return "g"
  if (["l", "litre"].includes(normalized)) return "l"
  if (["ml", "millilitre"].includes(normalized)) return "ml"
  return null
}

export function toNonNegativeNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function semanticKey(name, unit) {
  return `${String(name)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()}::${unit}`
}

function issue(severity, code, message, context = {}) {
  return { severity, code, message, ...context }
}

function asMap(records = []) {
  return new Map(records.map((record) => [record.id, record]))
}

function isMigratedArticleFor(article, legacyId) {
  return (
    article?.legacyInventoryItemId === legacyId ||
    article?.migration?.legacyInventoryItemId === legacyId
  )
}

function validateExistingV2(state) {
  const issues = []
  const articles = asMap(state.v2Articles)
  const balances = asMap(state.v2Balances)
  const costs = asMap(state.v2Costs)

  for (const article of articles.values()) {
    if (!balances.has(article.id)) {
      issues.push(
        issue(
          "ERROR",
          "ARTICLE_WITHOUT_BALANCE",
          `Article V2 ${article.id} (${article.name ?? "sans nom"}) sans balance.`,
          { documentId: article.id }
        )
      )
    }
  }
  for (const balance of balances.values()) {
    if (!articles.has(balance.id)) {
      issues.push(
        issue(
          "ERROR",
          "BALANCE_WITHOUT_ARTICLE",
          `Balance V2 ${balance.id} sans article.`,
          { documentId: balance.id }
        )
      )
    }
  }
  for (const cost of costs.values()) {
    if (!articles.has(cost.id)) {
      issues.push(
        issue(
          "ERROR",
          "COST_WITHOUT_ARTICLE",
          `Coût V2 ${cost.id} sans article.`,
          { documentId: cost.id }
        )
      )
    }
  }
  return issues
}

export function buildMigrationPlan(state) {
  const globalIssues = validateExistingV2(state)
  const articles = asMap(state.v2Articles)
  const balances = asMap(state.v2Balances)
  const costs = asMap(state.v2Costs)
  const candidates = []
  const semanticGroups = new Map()

  for (const v1 of state.v1Articles) {
    const name = typeof v1.name === "string" ? v1.name.trim() : ""
    const unit = toV2Unit(v1.unit)
    const trackingMode = toV2TrackingMode(v1.trackingMode)
    const quantity = toNonNegativeNumber(v1.stockEstimated)
    const referenceCost = toNonNegativeNumber(v1.costPerUnit)
    const lowStockThreshold = toNonNegativeNumber(v1.minThreshold)
    const candidateIssues = []

    if (!name) {
      candidateIssues.push(
        issue("ERROR", "INVALID_NAME", "Nom V1 manquant ou invalide.")
      )
    }
    if (!unit) {
      candidateIssues.push(
        issue(
          "ERROR",
          "UNKNOWN_UNIT",
          `Unité V1 inconnue : ${String(v1.unit)}.`
        )
      )
    }
    if (!trackingMode) {
      candidateIssues.push(
        issue(
          "ERROR",
          "INVALID_TRACKING_MODE",
          `trackingMode V1 invalide : ${String(v1.trackingMode)}.`
        )
      )
    }
    if (quantity === null) {
      candidateIssues.push(
        issue(
          "ERROR",
          "INVALID_QUANTITY",
          `Quantité V1 invalide : ${String(v1.stockEstimated)}.`
        )
      )
    }
    if (referenceCost === null) {
      candidateIssues.push(
        issue(
          "ERROR",
          "INVALID_COST",
          `Coût V1 invalide : ${String(v1.costPerUnit)}.`
        )
      )
    }
    if (lowStockThreshold === null) {
      candidateIssues.push(
        issue(
          "ERROR",
          "INVALID_THRESHOLD",
          `Seuil V1 invalide : ${String(v1.minThreshold)}.`
        )
      )
    }

    const existingArticle = articles.get(v1.id)
    const existingBalance = balances.get(v1.id)
    const existingCost = costs.get(v1.id)
    let action = "CREATE"

    if (existingArticle) {
      if (!isMigratedArticleFor(existingArticle, v1.id)) {
        candidateIssues.push(
          issue(
            "ERROR",
            "TARGET_ID_CONFLICT",
            `L'ID ${v1.id} est déjà utilisé par un article V2 non identifié comme issu de cette migration.`
          )
        )
        action = "BLOCK"
      } else if (!existingBalance) {
        candidateIssues.push(
          issue(
            "ERROR",
            "INTERRUPTED_MIGRATION_MISSING_BALANCE",
            "Article migré présent, mais balance absente. Réparation manuelle requise."
          )
        )
        action = "BLOCK"
      } else if (referenceCost > 0 && !existingCost) {
        candidateIssues.push(
          issue(
            "ERROR",
            "INTERRUPTED_MIGRATION_MISSING_COST",
            "Article migré présent, mais coût attendu absent. Réparation manuelle requise."
          )
        )
        action = "BLOCK"
      } else if (
        existingArticle.name !== name ||
        existingArticle.baseUnit !== unit ||
        existingArticle.trackingMode !== trackingMode ||
        Number(existingArticle.lowStockThreshold) !== lowStockThreshold ||
        existingBalance.unit !== unit ||
        Number(existingBalance.quantity) !== quantity ||
        (referenceCost > 0 &&
          Number(existingCost?.referenceCost) !== referenceCost)
      ) {
        candidateIssues.push(
          issue(
            "ERROR",
            "MIGRATED_DATA_MISMATCH",
            "Les documents déjà migrés diffèrent du mapping V1 actuel. Aucun écrasement automatique."
          )
        )
        action = "BLOCK"
      } else {
        candidateIssues.push(
          issue(
            "OK",
            "ALREADY_MIGRATED",
            "Article déjà migré et structure minimale complète; aucune écriture prévue."
          )
        )
        action = "SKIP"
      }
    } else if (existingBalance || existingCost) {
      candidateIssues.push(
        issue(
          "ERROR",
          "PARTIAL_TARGET_STATE",
          "Balance ou coût présent sans article cible. Réparation manuelle requise."
        )
      )
      action = "BLOCK"
    }

    const candidate = {
      id: v1.id,
      name,
      source: {
        trackingMode: v1.trackingMode,
        quantity: v1.stockEstimated,
        referenceCost: v1.costPerUnit,
        unit: v1.unit,
        lowStockThreshold: v1.minThreshold,
      },
      target: {
        trackingMode,
        quantity,
        referenceCost,
        unit,
        lowStockThreshold,
      },
      action,
      issues: candidateIssues,
    }
    candidates.push(candidate)

    if (name && unit) {
      const key = semanticKey(name, unit)
      semanticGroups.set(key, [
        ...(semanticGroups.get(key) ?? []),
        { source: "V1", id: v1.id, candidate },
      ])
    }
  }

  for (const article of state.v2Articles) {
    if (!article.name || !VALID_V2_UNITS.has(article.baseUnit)) continue
    const key = semanticKey(article.name, article.baseUnit)
    semanticGroups.set(key, [
      ...(semanticGroups.get(key) ?? []),
      { source: "V2", id: article.id, article },
    ])
  }

  for (const [key, entries] of semanticGroups) {
    const distinctIds = new Set(entries.map((entry) => entry.id))
    if (distinctIds.size < 2) continue
    const message = `Doublon sémantique ${key} : ${entries
      .map((entry) => `${entry.source}/${entry.id}`)
      .join(", ")}.`
    globalIssues.push(issue("ERROR", "SEMANTIC_DUPLICATE", message))
    for (const entry of entries) {
      if (entry.candidate) {
        entry.candidate.action = "BLOCK"
        entry.candidate.issues.push(
          issue("ERROR", "SEMANTIC_DUPLICATE", message)
        )
      }
    }
  }

  for (const candidate of candidates) {
    if (candidate.issues.some((entry) => entry.severity === "ERROR")) {
      candidate.action = "BLOCK"
    } else if (candidate.action === "CREATE") {
      candidate.issues.push(
        issue("OK", "READY_TO_CREATE", "Article prêt à être créé.")
      )
    }
  }

  const allIssues = [
    ...globalIssues,
    ...candidates.flatMap((candidate) => candidate.issues),
  ]
  const counts = {
    ok: allIssues.filter((entry) => entry.severity === "OK").length,
    warning: allIssues.filter((entry) => entry.severity === "WARNING").length,
    error: allIssues.filter((entry) => entry.severity === "ERROR").length,
    create: candidates.filter((candidate) => candidate.action === "CREATE")
      .length,
    skip: candidates.filter((candidate) => candidate.action === "SKIP").length,
    blocked: candidates.filter((candidate) => candidate.action === "BLOCK")
      .length,
  }

  return {
    restaurantId: state.restaurantId,
    restaurantName: state.restaurantName ?? null,
    sourceCount: state.v1Articles.length,
    existing: {
      articles: state.v2Articles.length,
      balances: state.v2Balances.length,
      costs: state.v2Costs.length,
      operations: state.v2Operations?.length ?? 0,
    },
    candidates,
    globalIssues,
    counts,
    canApply: counts.error === 0,
  }
}

export function createTargetDocuments(candidate, restaurantId, timestamp) {
  const migrationActor = "system:migrate-inventory-v1-to-v2"
  return {
    article: {
      restaurantId,
      name: candidate.name,
      description: null,
      categoryId: null,
      baseUnit: candidate.target.unit,
      trackingMode: candidate.target.trackingMode,
      status: "active",
      lowStockThreshold: candidate.target.lowStockThreshold,
      outOfStockThreshold: 0,
      packagings: [],
      migration: {
        source: "inventoryItems",
        legacyInventoryItemId: candidate.id,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: migrationActor,
      updatedBy: migrationActor,
    },
    balance: {
      restaurantId,
      articleId: candidate.id,
      quantity: candidate.target.quantity,
      unit: candidate.target.unit,
      version: 1,
      lastOperationAt: timestamp,
      lastSupplyAt: timestamp,
    },
    cost:
      candidate.target.referenceCost > 0
        ? {
            restaurantId,
            articleId: candidate.id,
            referenceCost: candidate.target.referenceCost,
            updatedAt: timestamp,
            updatedBy: migrationActor,
          }
        : null,
  }
}

export async function applyMigrationPlan({ db, plan, timestamp }) {
  if (!plan.canApply) {
    throw new Error("Migration refusée : le plan contient des erreurs.")
  }

  const root = db.collection("restaurants").doc(plan.restaurantId)
  const results = []
  for (const candidate of plan.candidates) {
    if (candidate.action !== "CREATE") {
      results.push({ id: candidate.id, status: "SKIPPED" })
      continue
    }

    await db.runTransaction(async (transaction) => {
      const articleRef = root.collection(V2_COLLECTIONS.articles).doc(candidate.id)
      const balanceRef = root
        .collection(V2_COLLECTIONS.balances)
        .doc(candidate.id)
      const costRef = root.collection(V2_COLLECTIONS.costs).doc(candidate.id)
      const [article, balance, cost] = await transaction.getAll(
        articleRef,
        balanceRef,
        costRef
      )
      if (article.exists || balance.exists || cost.exists) {
        throw new Error(
          `État concurrent détecté pour ${candidate.id}; aucun document n'a été écrasé.`
        )
      }

      const documents = createTargetDocuments(
        candidate,
        plan.restaurantId,
        timestamp
      )
      transaction.create(articleRef, documents.article)
      transaction.create(balanceRef, documents.balance)
      if (documents.cost) transaction.create(costRef, documents.cost)
    })
    results.push({ id: candidate.id, status: "CREATED" })
  }
  return results
}

async function readCollection(root, name) {
  const snapshot = await root.collection(name).get()
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
}

export async function readMigrationState(db, restaurantId) {
  const root = db.collection("restaurants").doc(restaurantId)
  const [restaurant, v1Articles, v2Articles, v2Balances, v2Costs, v2Operations] =
    await Promise.all([
      root.get(),
      readCollection(root, "inventoryItems"),
      readCollection(root, V2_COLLECTIONS.articles),
      readCollection(root, V2_COLLECTIONS.balances),
      readCollection(root, V2_COLLECTIONS.costs),
      readCollection(root, V2_COLLECTIONS.operations),
    ])

  if (!restaurant.exists) {
    throw new Error(`Restaurant introuvable : ${restaurantId}`)
  }
  return {
    restaurantId,
    restaurantName: restaurant.data()?.name ?? null,
    v1Articles,
    v2Articles,
    v2Balances,
    v2Costs,
    v2Operations,
  }
}

export function renderReport(plan, mode) {
  const lines = [
    "",
    "============================================================",
    "  MIGRATION INVENTAIRE V1 -> V2",
    "============================================================",
    `  Mode       : ${mode.toUpperCase()}`,
    `  Restaurant : ${plan.restaurantName ?? "Nom inconnu"} (${plan.restaurantId})`,
    `  V1         : ${plan.sourceCount} article(s)`,
    `  V2         : ${plan.existing.articles} article(s), ${plan.existing.balances} balance(s), ${plan.existing.costs} coût(s), ${plan.existing.operations} opération(s)`,
    "------------------------------------------------------------",
  ]

  for (const entry of plan.globalIssues) {
    lines.push(`[${entry.severity}] ${entry.code} - ${entry.message}`)
  }
  for (const candidate of plan.candidates) {
    lines.push(
      "",
      `[${candidate.action === "BLOCK" ? "ERROR" : "OK"}] ${candidate.name || candidate.id} (${candidate.id}) - ${candidate.action}`,
      `  V1: mode=${String(candidate.source.trackingMode)}, quantité=${String(candidate.source.quantity)}, coût=${String(candidate.source.referenceCost)}, unité=${String(candidate.source.unit)}, seuil=${String(candidate.source.lowStockThreshold)}`,
      `  V2: mode=${String(candidate.target.trackingMode)}, quantité=${String(candidate.target.quantity)}, coût=${String(candidate.target.referenceCost)}, unité=${String(candidate.target.unit)}, seuil=${String(candidate.target.lowStockThreshold)}`,
      `  Documents: ${V2_COLLECTIONS.articles}/${candidate.id}, ${V2_COLLECTIONS.balances}/${candidate.id}${candidate.target.referenceCost > 0 ? `, ${V2_COLLECTIONS.costs}/${candidate.id}` : ""}`
    )
    for (const entry of candidate.issues) {
      lines.push(`  [${entry.severity}] ${entry.code} - ${entry.message}`)
    }
  }

  lines.push(
    "",
    "============================================================",
    "  SYNTHÈSE",
    "============================================================",
    `  OK      : ${plan.counts.ok}`,
    `  WARNING : ${plan.counts.warning}`,
    `  ERROR   : ${plan.counts.error}`,
    `  CREATE  : ${plan.counts.create}`,
    `  SKIP    : ${plan.counts.skip}`,
    `  BLOCKED : ${plan.counts.blocked}`,
    `  Décision: ${plan.canApply ? "VALIDATION RÉUSSIE" : "MIGRATION REFUSÉE"}`,
    mode === "apply"
      ? "  Mode écriture demandé."
      : "  Aucune écriture Firestore effectuée.",
    "============================================================",
    ""
  )
  return lines.join("\n")
}

function printUsage() {
  console.log(`
Usage:
  npm run migrate:inventory-v1-v2 -- --restaurantId=XXX --validate
  npm run migrate:inventory-v1-v2 -- --restaurantId=XXX --dry-run
  npm run migrate:inventory-v1-v2 -- --restaurantId=XXX --apply --confirm=XXX

Modes:
  --validate  Vérifie uniquement les données et états partiels.
  --dry-run   Produit le plan complet sans écriture (mode par défaut).
  --apply     Écrit uniquement si la validation est parfaite et si --confirm
              correspond exactement au restaurantId.
`)
}

function initializeAdmin() {
  dotenv.config({ path: ".env.local" })
  dotenv.config()
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) {
    throw new Error(
      "FIREBASE_PROJECT_ID ou NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant."
    )
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64,
        "base64"
      ).toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  let credential
  if (serviceAccountJson) {
    credential = admin.credential.cert(JSON.parse(serviceAccountJson))
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  } else {
    credential = admin.credential.applicationDefault()
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ credential, projectId })
  }
  return admin.firestore()
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.help) {
    printUsage()
    return 0
  }
  if (!options.restaurantId) {
    printUsage()
    throw new Error("--restaurantId est obligatoire.")
  }
  if (
    options.mode === "apply" &&
    options.confirm !== options.restaurantId
  ) {
    throw new Error(
      "--apply exige --confirm=<restaurantId> avec une correspondance exacte."
    )
  }

  const db = initializeAdmin()
  const state = await readMigrationState(db, options.restaurantId)
  const plan = buildMigrationPlan(state)
  console.log(renderReport(plan, options.mode))

  if (!plan.canApply) {
    throw new Error(
      "Validation échouée : corrigez les erreurs avant toute migration."
    )
  }
  if (options.mode !== "apply") return 0

  const results = await applyMigrationPlan({
    db,
    plan,
    timestamp: new Date().toISOString(),
  })
  console.log(
    `Migration terminée : ${results.filter((entry) => entry.status === "CREATED").length} créé(s), ${results.filter((entry) => entry.status === "SKIPPED").length} ignoré(s).`
  )
  return 0
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`[ERROR] ${error.message}`)
    process.exitCode = 1
  })
}
