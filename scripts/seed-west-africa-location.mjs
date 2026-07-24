#!/usr/bin/env node
import dotenv from "dotenv"
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

dotenv.config({ path: ".env.local" })
dotenv.config()

const WEST_AFRICA_COUNTRIES = [
  { code: "BJ", name: "Bénin", currency: "XOF", dialCode: "+229" },
  { code: "BF", name: "Burkina Faso", currency: "XOF", dialCode: "+226" },
  { code: "CV", name: "Cap-Vert", currency: "CVE", dialCode: "+238" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", dialCode: "+225" },
  { code: "GM", name: "Gambie", currency: "GMD", dialCode: "+220" },
  { code: "GH", name: "Ghana", currency: "GHS", dialCode: "+233" },
  { code: "GN", name: "Guinée", currency: "GNF", dialCode: "+224" },
  { code: "GW", name: "Guinée-Bissau", currency: "XOF", dialCode: "+245" },
  { code: "LR", name: "Liberia", currency: "LRD", dialCode: "+231" },
  { code: "ML", name: "Mali", currency: "XOF", dialCode: "+223" },
  { code: "MR", name: "Mauritanie", currency: "MRU", dialCode: "+222" },
  { code: "NE", name: "Niger", currency: "XOF", dialCode: "+227" },
  { code: "NG", name: "Nigeria", currency: "NGN", dialCode: "+234" },
  { code: "SN", name: "Sénégal", currency: "XOF", dialCode: "+221" },
  { code: "SL", name: "Sierra Leone", currency: "SLE", dialCode: "+232" },
  { code: "TG", name: "Togo", currency: "XOF", dialCode: "+228" },
]

const BAMAKO_COMMUNES = [
  "Commune I",
  "Commune II",
  "Commune III",
  "Commune IV",
  "Commune V",
  "Commune VI",
]

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.")
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({ credential: getCredential(), projectId })
}

const db = getFirestore()
const now = new Date()
const summary = { countries: 0, cities: 0, communes: 0 }

for (const [index, country] of WEST_AFRICA_COUNTRIES.entries()) {
  await setSeedDocument(db.collection("platformCountries").doc(country.code), {
    ...country,
    isActive: country.code === "ML",
    order: index,
  })
  summary.countries += 1
}

const bamakoRef = db.collection("platformCountries").doc("ML").collection("cities").doc("bamako")
await setSeedDocument(bamakoRef, {
  name: "Bamako",
  normalizedName: "bamako",
  isActive: true,
  order: 0,
})
summary.cities += 1

for (const [index, name] of BAMAKO_COMMUNES.entries()) {
  await setSeedDocument(bamakoRef.collection("communes").doc(slugify(name)), {
    name,
    normalizedName: slugify(name),
    isActive: true,
    order: index,
  })
  summary.communes += 1
}

console.log(JSON.stringify({ event: "west_africa_location_seed_complete", ...summary }, null, 2))

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson))
  }

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

async function setSeedDocument(ref, data) {
  const snapshot = await ref.get()
  await ref.set({
    ...data,
    updatedAt: now,
    ...(snapshot.exists ? {} : { createdAt: now }),
  }, { merge: true })
}
