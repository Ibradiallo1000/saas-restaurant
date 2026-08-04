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

// ============================================================================
// TYPES DE RÉPONSES API
// ============================================================================

interface ApiResponse<T = unknown> {
  ok: boolean
  data: T
  message?: string
  code?: string
  error?: {
    code: string
    message: string
    retryable?: boolean
  }
}

interface TableSessionResponse {
  id: string
  tableId: string
  status: "active" | "closed"
  startedAt: string
  endedAt: string | null
  totalDue: number
  orderCount: number
}

interface OrderResponse {
  id: string
  tableId: string
  sessionId: string
  total: number
  status: string
  paymentStatus: string
  itemCount: number
  createdAt: string
}

interface PaymentRequestResponse {
  id: string
  status: "pending" | "paid" | "failed"
  amount: number
  method: string
  provider: string | null
  createdAt: string
}

interface ReviewAccessResponse {
  accessGranted: boolean
  reviewId?: string
  orderId: string
}

interface TableSessionFullResponse {
  id: string
  tableId: string
  status: "active" | "closed"
  startedAt: string
  endedAt: string | null
  orders: OrderResponse[]
  totalAmount: number
  orderCount: number
}

// ============================================================================
// FONCTIONS API
// ============================================================================

export async function createCanonicalTableSession(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  tableId: string
}): Promise<TableSessionResponse> {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/table-sessions`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ tableId: input.tableId }),
    }
  )
  return parseResponse<TableSessionResponse>(response, "Impossible de préparer la session de table.")
}

export async function createCanonicalQrOrder(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  idempotencyKey: string
  body: Record<string, unknown>
}): Promise<OrderResponse> {
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
  return parseResponse<OrderResponse>(response, "La commande n’a pas pu être envoyée.")
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
}): Promise<PaymentRequestResponse> {
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
  return parseResponse<PaymentRequestResponse>(response, "La demande de paiement n’a pas pu être envoyée.")
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
}): Promise<PaymentRequestResponse> {
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
  return parseResponse<PaymentRequestResponse>(response, "La demande de paiement n’a pas pu être envoyée.")
}

export async function getCanonicalPublicOrder(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  orderId: string
}): Promise<OrderResponse> {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}`,
    { headers }
  )
  return parseResponse<OrderResponse>(response, "Impossible de charger le suivi de commande.")
}

export async function issueCanonicalReviewAccess(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  orderId: string
}): Promise<ReviewAccessResponse> {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/orders/${encodeURIComponent(input.orderId)}/review-access`,
    { method: "POST", headers }
  )
  return parseResponse<ReviewAccessResponse>(response, "Impossible d’ouvrir l’accès aux avis.")
}

export async function getCanonicalTableSession(input: {
  app: FirebaseApp
  user: User
  restaurantId: string
  tableSessionId: string
}): Promise<TableSessionFullResponse> {
  const headers = await publicHeaders(input.app, input.user)
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantId)}/table-sessions/${encodeURIComponent(input.tableSessionId)}`,
    { headers }
  )
  return parseResponse<TableSessionFullResponse>(response, "Impossible de charger la session de table.")
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

// ============================================================================
// FONCTIONS INTERNES - GESTION DES HEADERS
// ============================================================================

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
  
  // Récupération des tokens - on NE stocke PAS appCheckToken dans une variable exposée
  let idToken: string
  let appCheckToken: string
  
  try {
    // Exécution en parallèle pour la performance
    const [idTokenResult, appCheckTokenResult] = await Promise.all([
      user.getIdToken(),
      getToken(appCheck, false)
    ])
    
    idToken = idTokenResult
    appCheckToken = appCheckTokenResult.token
    
    // ⚠️ IMPORTANT: On ne logge JAMAIS le token App Check
    // et on ne l'inclut JAMAIS dans les réponses d'erreur
    
  } catch (error) {
    // Gestion des erreurs SANS exposer le token
    if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) {
      throw new PublicOrderApiError(
        "APP_CHECK_DEBUG_TOKEN_NOT_REGISTERED",
        "Le jeton App Check de développement n’est pas autorisé. Enregistrez le jeton affiché dans la console du navigateur dans Firebase Console > App Check > Gérer les jetons de débogage."
      )
    }
    throw new PublicOrderApiError(
      "APP_CHECK_TOKEN_FAILED",
      "La protection de la commande publique n’a pas pu être vérifiée. Réessayez ou contactez le restaurant.",
      true
    )
  }
  
  // Retour des headers - appCheckToken n'est exposé qu'ici, pas dans les logs ou les erreurs
  return {
    authorization: `Bearer ${idToken}`,
    "x-firebase-appcheck": appCheckToken,
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

  const debugToken =
  process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim()

if (!debugToken) {
  throw new PublicOrderApiError(
    "APP_CHECK_DEBUG_TOKEN_MISSING",
    "Le jeton App Check local est absent de .env.local."
  )
}

self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken
  console.info(
    "[APP_CHECK][DEBUG] Mode local activé. Firebase affiche le token de debug dans cette console ; enregistrez-le dans Firebase Console > App Check > Gérer les jetons de débogage."
  )
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

// ============================================================================
// PARSEUR DE RÉPONSES
// ============================================================================

/**
 * Parse une réponse API et retourne les données typées.
 * Ne manipule jamais directement les tokens ou données sensibles.
 */
async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null)
  
  if (!response.ok || body?.ok === false) {
    throw new PublicOrderApiError(
      body?.code ?? body?.error?.code ?? "NETWORK_ERROR",
      body?.message ?? body?.error?.message ?? fallback,
      body?.retryable === true || body?.error?.retryable === true
    )
  }

  if (body?.data !== undefined) {
    return body.data as T
  }

  return body as T
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

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