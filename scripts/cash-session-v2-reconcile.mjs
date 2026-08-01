#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import { aggregateFinancialEntries, financialCachePatch } from "../src/lib/finance/payment-ledger-domain.ts"

dotenv.config({ path: ".env.local" })
dotenv.config()

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=")
  return [key, value]
}))
const restaurantId = String(args["restaurant-id"] || "").trim()
const write = args.write === "true"
const limit = Math.min(1000, Math.max(1, Number(args.limit || 100)))
const safeEnvironment =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
  ["qa", "staging"].includes(process.env.CASH_SESSION_RECONCILE_ENV || "")

if (!restaurantId) throw new Error("--restaurant-id est obligatoire.")
if (!safeEnvironment) {
  throw new Error("Exécution refusée hors émulateur, QA ou staging.")
}
if (write && args.confirm !== "RECONCILE_CASH_SESSIONS") {
  throw new Error("--write=true exige --confirm=RECONCILE_CASH_SESSIONS.")
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) throw new Error("Project ID Firebase manquant.")
if (!getApps().length) initializeApp({ credential: credential(), projectId })

const db = getFirestore()
const root = db.collection("restaurants").doc(restaurantId)
const sessions = await root.collection("cashSessions").limit(limit).get()
const report = {
  mode: write ? "write" : "dry-run",
  restaurantId,
  sessionsRead: sessions.size,
  v2: 0,
  legacy: 0,
  divergent: 0,
  repaired: 0,
  handoverMissing: 0,
  legacyOwnersMissing: 0,
}

for (const sessionDocument of sessions.docs) {
  const session = sessionDocument.data()
  if (Number(session.closeVersion) === 2) report.v2 += 1
  else report.legacy += 1
  if (![session.cashierId, session.userId, session.staffId].some(Boolean)) {
    report.legacyOwnersMissing += 1
  }
  const payments = await root.collection("payments").where("sessionId", "==", sessionDocument.id).get()
  const aggregate = aggregateFinancialEntries(payments.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  })))
  const expected = financialCachePatch(aggregate)
  const divergent = Object.entries(expected).some(([key, value]) =>
    JSON.stringify(session[key] ?? null) !== JSON.stringify(value)
  )
  if (divergent) {
    report.divergent += 1
    if (write) {
      await sessionDocument.ref.update({
        ...expected,
        financialCacheReconciledByScript: true,
        financialCacheReconciledAt: new Date(),
      })
      report.repaired += 1
    }
  }
  if (
    Number(session.closeVersion) === 2 &&
    session.status !== "open" &&
    !session.handoverId
  ) report.handoverMissing += 1
}

console.log(JSON.stringify(report, null, 2))

function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  return raw ? cert(JSON.parse(raw)) : applicationDefault()
}
