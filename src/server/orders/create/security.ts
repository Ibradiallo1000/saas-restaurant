import { createHmac, timingSafeEqual } from "node:crypto"

import type { DecodedIdToken } from "firebase-admin/auth"
import type { NextRequest } from "next/server"

import { getAdminAuth, getAdminFirestore } from "../../firebase-admin"
import { verifyOrderAppCheckToken } from "../verify-app-check.ts"
import { CanonicalOrderError } from "./errors.ts"
import type { OrderPrincipal } from "./types.ts"
import { parseCreateOrderRequest } from "./validation.ts"
import { assertPublicOrderSecurityConfigured } from "../public-security-config.ts"

export async function resolveOrderPrincipal(input: {
  request: NextRequest
  restaurantId: string
  body: unknown
}): Promise<OrderPrincipal> {
  const command = parseCreateOrderRequest(input.body)
  if (command.channel === "pos") {
    const token = await requireIdToken(input.request)
    return resolveStaffPrincipal(input.restaurantId, token)
  }

  assertPublicOrderSecurityConfigured(input.restaurantId)
  await requireAppCheck(input.request)
  const token = await requireIdToken(input.request)
  if (command.channel === "qr_table") {
    verifyTableCapability({
      token: command.tableContext?.capability ?? null,
      restaurantId: input.restaurantId,
      tableId: command.tableContext?.tableId ?? "",
      tableSessionId: command.tableContext?.tableSessionId ?? "",
    })
  }
  return { kind: "public", uid: token.uid, roles: [] }
}

async function requireIdToken(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!token) {
    throw new CanonicalOrderError("UNAUTHENTICATED", "Authentification obligatoire.")
  }
  try {
    return await getAdminAuth().verifyIdToken(token, true)
  } catch {
    throw new CanonicalOrderError("UNAUTHENTICATED", "Authentification invalide.")
  }
}

async function requireAppCheck(request: NextRequest) {
  const token = request.headers.get("x-firebase-appcheck")
  if (!token) {
    throw new CanonicalOrderError("APP_CHECK_REQUIRED", "App Check est obligatoire.")
  }
  try {
    await verifyOrderAppCheckToken(token)
  } catch {
    throw new CanonicalOrderError("APP_CHECK_REQUIRED", "App Check est invalide.")
  }
}

export async function resolveStaffPrincipal(
  restaurantId: string,
  token: DecodedIdToken
): Promise<OrderPrincipal> {
  const db = getAdminFirestore()
  const [rootUser, staff] = await Promise.all([
    db.collection("users").doc(token.uid).get(),
    db.collection("restaurants").doc(restaurantId).collection("staff").doc(token.uid).get(),
  ])
  const root = rootUser.data() ?? {}
  const member = staff.data() ?? {}
  if (root.active === false || root.actif === false || member.active === false || member.actif === false) {
    throw new CanonicalOrderError("FORBIDDEN", "Ce compte est inactif.")
  }
  const rootMatches = root.restaurantId === restaurantId
  const staffMatches = staff.exists && (member.restaurantId == null || member.restaurantId === restaurantId)
  if (!rootMatches && !staffMatches && !["super_admin", "admin"].includes(root.role)) {
    throw new CanonicalOrderError("FORBIDDEN", "Accès refusé à ce restaurant.")
  }
  const roles = [...new Set([
    ...(Array.isArray(member.roles) ? member.roles : []),
    member.role,
    root.role,
  ].filter((role): role is string => typeof role === "string" && Boolean(role)))]
  return { kind: "staff", uid: token.uid, roles }
}

export function verifyTableCapability(input: {
  token: string | null
  restaurantId: string
  tableId: string
  tableSessionId: string
}) {
  const secret = process.env.ORDER_QR_CAPABILITY_SECRET
  if (!secret || secret.length < 32 || !input.token) {
    throw new CanonicalOrderError("INVALID_TABLE_CAPABILITY", "Capacité QR invalide.")
  }
  const [encodedPayload, encodedSignature] = input.token.split(".")
  if (!encodedPayload || !encodedSignature) {
    throw new CanonicalOrderError("INVALID_TABLE_CAPABILITY", "Capacité QR invalide.")
  }
  const expected = createHmac("sha256", secret).update(encodedPayload).digest()
  const received = Buffer.from(encodedSignature, "base64url")
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new CanonicalOrderError("INVALID_TABLE_CAPABILITY", "Capacité QR invalide.")
  }
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
    if (
      payload.restaurantId !== input.restaurantId ||
      payload.tableId !== input.tableId ||
      payload.tableSessionId !== input.tableSessionId ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      throw new Error("invalid")
    }
  } catch {
    throw new CanonicalOrderError("INVALID_TABLE_CAPABILITY", "Capacité QR invalide.")
  }
}

export function createTableCapability(input: {
  restaurantId: string
  tableId: string
  tableSessionId: string
  expiresAt: number
}) {
  const secret = process.env.ORDER_QR_CAPABILITY_SECRET
  if (!secret || secret.length < 32) {
    throw new CanonicalOrderError(
      "INVALID_TABLE_CAPABILITY",
      "La capacité QR n’est pas configurée."
    )
  }
  const encodedPayload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url")
  return `${encodedPayload}.${signature}`
}
