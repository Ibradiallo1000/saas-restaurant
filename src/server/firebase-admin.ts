import { readFileSync } from "node:fs"

import { getApps, initializeApp, cert, applicationDefault, type ServiceAccount } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

function getAdminCredential() {
  assertServerOnly()

  const serviceAccount = getServiceAccount()

  if (serviceAccount) {
    return cert(serviceAccount)
  }

  return applicationDefault()
}

interface RawServiceAccount {
  project_id?: string
  private_key?: string
  client_email?: string
  projectId?: string
  privateKey?: string
  clientEmail?: string
}

function getServiceAccount(): ServiceAccount | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return normalizeServiceAccount(
      JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"))
    )
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
    return normalizeServiceAccount(
      JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8"))
    )
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return normalizeServiceAccount(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
  }

  return null
}

function normalizeServiceAccount(raw: RawServiceAccount): ServiceAccount {
  const projectId = raw.projectId ?? raw.project_id
  const clientEmail = raw.clientEmail ?? raw.client_email
  const privateKey = raw.privateKey ?? raw.private_key

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Invalid Firebase service account JSON.")
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }
}

export function getAdminAuth() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: getAdminCredential(),
        projectId: getFirebaseProjectId(),
      })

  return getAuth(app)
}

export function getAdminFirestore() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: getAdminCredential(),
        projectId: getFirebaseProjectId(),
      })

  return getFirestore(app)
}

function getFirebaseProjectId() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    getServiceAccount()?.projectId

  if (!projectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID, or service account projectId.")
  }

  return projectId
}

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin SDK must never run in the browser.")
  }
}
