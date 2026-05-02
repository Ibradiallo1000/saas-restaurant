import { readFileSync } from "node:fs"

import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

interface RawServiceAccount {
  project_id?: string
  private_key?: string
  client_email?: string
  projectId?: string
  privateKey?: string
  clientEmail?: string
}

function getServiceAccount(): ServiceAccount | null {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountPath) {
    return normalizeServiceAccount(JSON.parse(readFileSync(serviceAccountPath, "utf8")))
  }

  if (serviceAccountBase64) {
    return normalizeServiceAccount(
      JSON.parse(Buffer.from(serviceAccountBase64, "base64").toString("utf8"))
    )
  }

  if (serviceAccountJson) {
    return normalizeServiceAccount(JSON.parse(serviceAccountJson))
  }

  return null
}

function normalizeServiceAccount(raw: RawServiceAccount): ServiceAccount {
  const projectId = raw.projectId ?? raw.project_id
  const clientEmail = raw.clientEmail ?? raw.client_email
  const privateKey = raw.privateKey ?? raw.private_key

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Service account JSON invalide.")
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }
}

function initializeAdminApp() {
  const serviceAccount = getServiceAccount()

  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount?.projectId,
      })
}

export function getAdminAuth() {
  return getAuth(initializeAdminApp())
}

export function getAdminFirestore() {
  return getFirestore(initializeAdminApp())
}
