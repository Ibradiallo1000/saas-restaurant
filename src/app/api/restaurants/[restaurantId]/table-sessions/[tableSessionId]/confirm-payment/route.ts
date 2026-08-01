import { createHash } from "node:crypto"

import { FieldValue } from "firebase-admin/firestore"
import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import {
  confirmOrderPayment,
  FirestoreAtomicOrderCommandStore,
  OrderCommandError,
} from "@/server/orders/commands"
import type { ActorRole } from "@/server/orders/commands/types"
import { resolveStaffPrincipal } from "@/server/orders/create/security"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; tableSessionId: string }> }
) {
  try {
    const { restaurantId, tableSessionId } = await context.params
    const principal = await authenticate(request, restaurantId)
    const body = await request.json().catch(() => null)
    const cashSessionId = stringField(body?.cashSessionId)
    const idempotencyKey = stringField(body?.idempotencyKey)
    const method = body?.method === "cash" ? "cash" : body?.method === "mobile_money" ? "mobile_money" : null
    const provider = method === "mobile_money" ? stringField(body?.provider) : null
    if (
      !cashSessionId ||
      !method ||
      (method === "mobile_money" && !provider) ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)
    ) return failure("INVALID_COMMAND", "Validation de session invalide.", 400)

    const db = getAdminFirestore()
    const restaurantRef = db.collection("restaurants").doc(restaurantId)
    const sessionRef = restaurantRef.collection("tableSessions").doc(tableSessionId)
    const [sessionSnapshot, canonicalOrders, legacyOrders] = await Promise.all([
      sessionRef.get(),
      restaurantRef.collection("orders").where("tableSessionId", "==", tableSessionId).get(),
      restaurantRef.collection("orders").where("sessionId", "==", tableSessionId).get(),
    ])
    if (!sessionSnapshot.exists) return failure("ORDER_NOT_FOUND", "Session de table introuvable.", 404)
    const paymentStatus = sessionSnapshot.data()?.paymentRequest?.status
    if (paymentStatus !== "requested" && paymentStatus !== "pending_confirmation" && paymentStatus !== "validated") {
      return failure("INVALID_TRANSITION", "Aucune demande de paiement ne peut être validée.", 409)
    }

    const orders = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
    canonicalOrders.docs.forEach((snapshot) => orders.set(snapshot.id, snapshot))
    legacyOrders.docs.forEach((snapshot) => orders.set(snapshot.id, snapshot))
    if (orders.size === 0) return failure("ORDER_NOT_FOUND", "Aucune commande pour cette session.", 404)

    const actorRole = resolveActorRole(principal.roles)
    const store = new FirestoreAtomicOrderCommandStore(db)
    let confirmedCount = 0
    for (const snapshot of orders.values()) {
      const order = snapshot.data()
      if (String(order.paymentStatus).toLowerCase() === "paid") continue
      const amount = authoritativeAmount(order)
      await confirmOrderPayment({ store }, {
        restaurantId,
        orderId: snapshot.id,
        actor: { id: principal.uid, role: actorRole, restaurantId },
        sourceChannel: "pos",
        idempotencyKey: scopedKey(idempotencyKey, snapshot.id),
        expectedPaymentVersion: Number(order.paymentVersion ?? 1),
        expectedAmount: amount,
        receivedAmount: amount,
        method,
        provider,
        externalReference: null,
        cashSessionId,
      })
      confirmedCount += 1
    }

    const batch = db.batch()
    const cashSessionSnapshot = await restaurantRef.collection("cashSessions").doc(cashSessionId).get()
    const cashSession = cashSessionSnapshot.data() || {}
    batch.update(sessionRef, {
      "paymentRequest.status": "validated",
      "paymentRequest.handledAt": FieldValue.serverTimestamp(),
      "paymentRequest.handledBy": principal.uid,
      "paymentRequest.posStationId": String(cashSession.posStationId || "DEFAULT"),
      "paymentRequest.posStationName": String(cashSession.posStationName || "Caisse principale"),
      "paymentRequest.posStationCode": String(cashSession.posStationCode || "DEFAULT"),
      status: "closed",
      closedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
    })
    const tableId = stringField(sessionSnapshot.data()?.tableId)
    if (tableId) {
      batch.update(restaurantRef.collection("tables").doc(tableId), {
        status: "free",
        currentSessionId: null,
        updatedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
    return NextResponse.json({ ok: true, confirmedCount, orderCount: orders.size })
  } catch (error) {
    if (error instanceof OrderCommandError) {
      return failure(error.code, error.message, error.status, error.retryable)
    }
    const code = typeof (error as any)?.code === "string" ? (error as any).code : "INTERNAL_ERROR"
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHENTICATED" ? 401 : 500
    return failure(code, status === 500 ? "Validation de session impossible." : (error as Error).message, status)
  }
}

async function authenticate(request: NextRequest, restaurantId: string) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!token) throw Object.assign(new Error("Authentification obligatoire."), { code: "UNAUTHENTICATED" })
  const decoded = await getAdminAuth().verifyIdToken(token, true).catch(() => {
    throw Object.assign(new Error("Authentification invalide."), { code: "UNAUTHENTICATED" })
  })
  const principal = await resolveStaffPrincipal(restaurantId, decoded)
  if (principal.kind !== "staff") throw Object.assign(new Error("Accès personnel obligatoire."), { code: "FORBIDDEN" })
  return principal
}

function resolveActorRole(roles: readonly string[]): ActorRole {
  for (const role of ["cashier", "manager", "owner"] as const) if (roles.includes(role)) return role
  throw Object.assign(new Error("Rôle caisse obligatoire."), { code: "FORBIDDEN" })
}

function authoritativeAmount(order: FirebaseFirestore.DocumentData) {
  const amount = Number(order.totalAmount || order.total)
  if (!Number.isFinite(amount) || amount <= 0) throw new OrderCommandError("PAYMENT_AMOUNT_MISMATCH", "Montant de commande invalide.")
  return amount
}

function scopedKey(key: string, orderId: string) {
  return createHash("sha256").update(`${key}:${orderId}`).digest("hex")
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function failure(code: string, message: string, status: number, retryable = false) {
  return NextResponse.json({ ok: false, error: { code, message, retryable } }, { status })
}
