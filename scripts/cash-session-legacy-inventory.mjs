#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

dotenv.config({ path: ".env.local" })
dotenv.config()

const restaurantId = process.argv.find((arg) => arg.startsWith("--restaurant-id="))?.split("=")[1]
const safeEnvironment =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
  ["qa", "staging"].includes(process.env.CASH_SESSION_INVENTORY_ENV || "")
if (!restaurantId) throw new Error("--restaurant-id est obligatoire.")
if (!safeEnvironment) throw new Error("Inventaire refusé hors émulateur, QA ou staging.")

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
if (!projectId) throw new Error("Project ID Firebase manquant.")
if (!getApps().length) initializeApp({
  credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : applicationDefault(),
  projectId,
})
const root = getFirestore().collection("restaurants").doc(restaurantId)
const [legacy, sessions, handovers, movements] = await Promise.all([
  root.collection("cashierSessions").get(),
  root.collection("cashSessions").get(),
  root.collection("cashHandovers").get(),
  root.collection("cashMovements").get(),
])

console.log(JSON.stringify({
  mode: "dry-run-inventory-only",
  restaurantId,
  cashierSessions: legacy.size,
  cashSessions: sessions.size,
  cashHandovers: handovers.size,
  cashMovements: movements.size,
  legacySessionIds: legacy.docs.map((document) => document.id),
  deletable: [],
  conclusion: "Aucun élément n'est supprimé automatiquement.",
}, null, 2))
