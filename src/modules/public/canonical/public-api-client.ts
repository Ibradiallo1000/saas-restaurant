import type { FirebaseApp } from "firebase/app"
import { resolveFirebaseAppCheckSiteKey } from "@/lib/firebase-app-check-config"
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check"
import type { User } from "firebase/auth"

declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
}

export class PublicOrderApiError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable = false) {
    super(message)
    this.name = "PublicOrderApiError"
    this.code = code
    this.retryable = retryable
  }
}

const appCheckInstances = new WeakMap<FirebaseApp, AppCheck>()

export async function createCanonicalTableSession(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  tableId: string
}) {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/table-sessions`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ tableId: input.tableId }),
    }
  )
  return parseResponse(response, "Impossible de préparer la session de table.")
}

export async function createCanonicalQrOrder(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  idempotencyKey: string
  body: Record<string, unknown>
}) {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders`,
    {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify(input.body),
    }
  )
  return parseResponse(response, "La commande n’a pas pu être envoyée.")
}

export async function requestCanonicalTablePayment(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  tableSessionId: string
  capability: string
  idempotencyKey: string
  method: "cash" | "mobile"
  provider?: string | null
  paymentProofSms?: string | null
}) {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/table-sessions/${encodeURIComponent(input.tableSessionId)}/payment-requests`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        capability: input.capability,
        idempotencyKey: input.idempotencyKey,
        method: input.method,
        provider: input.provider ?? null,
        paymentProofSms: input.paymentProofSms ?? null,
      }),
    }
  )
  return parseResponse(response, "La demande de paiement n’a pas pu être envoyée.")
}

export async function requestCanonicalOrderPayment(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  orderId: string
  idempotencyKey: string
  method: "cash" | "mobile"
  provider?: string | null
  paymentProofSms?: string | null
}) {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}/payment-requests`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        method: input.method,
        provider: input.provider ?? null,
        paymentProofSms: input.paymentProofSms ?? null,
      }),
    }
  )
  return parseResponse(response, "La demande de paiement n’a pas pu être envoyée.")
}

export async function getCanonicalPublicOrder(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  orderId: string
}) {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}`,
    { headers }
  )
  return parseResponse(response, "Impossible de charger le suivi de commande.")
}

export async function issueCanonicalReviewAccess(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  orderId: string
}) {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}/review-access`,
    { method: "POST", headers }
  )
  return parseResponse(response, "Impossible d’ouvrir l’accès aux avis.")
}

export function rememberQrCapability(orderId: string, capability: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(`oordera:qr-capability:${orderId}`, capability)
  }
}

export function getRememberedQrCapability(orderId: string) {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(`oordera:qr-capability:${orderId}`)
}

async function publicHeaders(app: FirebaseApp, user: User) {
  const localProof = localAppCheckProof(app)
  if (localProof) {
    const authorization = `Bearer ${await user.getIdToken()}`
    return {
      authorization,
      "x-firebase-appcheck": localProof,
    }
  }
  const siteKey = resolveFirebaseAppCheckSiteKey()
  if (!siteKey) {
    throw new PublicOrderApiError(
      "APP_CHECK_NOT_CONFIGURED",
      "La protection de la commande publique n’est pas configurée."
    )
  }
  let appCheck = appCheckInstances.get(app)
  if (!appCheck) {
    enableLocalAppCheckDebugToken()
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
    appCheckInstances.set(app, appCheck)
  }
  // Firebase Auth and App Check are independent proofs. Preparing both at the
  // same time removes one network round-trip from every public action while
  // preserving the exact same server-side verification.
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getToken(appCheck, false),
  ])
  return {
    authorization: `Bearer ${idToken}`,
    "x-firebase-appcheck": appCheckToken.token,
  }
}

function localAppCheckProof(app: FirebaseApp) {
  const enabled = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1"
  const projectId = app.options.projectId ?? ""
  const proof = process.env.NEXT_PUBLIC_ORDER_E2E_APP_CHECK_TOKEN?.trim() ?? ""
  if (!enabled) return null
  if (!projectId.startsWith("demo-")) {
    throw new PublicOrderApiError(
      "INVALID_EMULATOR_PROJECT",
      "La preuve App Check locale est interdite sur un projet Firebase réel."
    )
  }
  if (proof.length < 32) {
    throw new PublicOrderApiError(
      "APP_CHECK_NOT_CONFIGURED",
      "La preuve App Check locale est absente ou invalide."
    )
  }
  return proof
}

function enableLocalAppCheckDebugToken() {
  if (
    process.env.NODE_ENV === "production" ||
    typeof window === "undefined" ||
    !isLocalHostname(window.location.hostname)
  ) {
    return
  }

  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  console.info(
    "[APP_CHECK][DEBUG] Mode local activé. Firebase affiche le token de debug dans cette console ; enregistrez-le dans Firebase Console > App Check > Gérer les jetons de débogage."
  )
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

async function parseResponse(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) {
    throw new PublicOrderApiError(
      body?.code ?? body?.error?.code ?? "NETWORK_ERROR",
      body?.message ?? body?.error?.message ?? fallback,
      body?.retryable === true || body?.error?.retryable === true
    )
  }
  return body
}

export function stablePublicIdempotencyKey(scope: string, seed?: string) {
  const storageKey = `oordera:${scope}:idempotency`
  if (typeof window !== "undefined") {
    const existing = window.sessionStorage.getItem(storageKey)
    if (existing) return existing
    const value = normalizeKey(seed ?? crypto.randomUUID())
    window.sessionStorage.setItem(storageKey, value)
    return value
  }
  return normalizeKey(seed ?? `${Date.now()}-${Math.random()}`)
}

export function clearPublicIdempotencyKey(scope: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(`oordera:${scope}:idempotency`)
  }
}

function normalizeKey(value: string) {
  const normalized = value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 128)
  return normalized.length >= 16 ? normalized : `${normalized}-${"0".repeat(16)}`.slice(0, 16)
}
