import { createHash } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { verifyTableCapability } from "@/server/orders/create/security"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; tableSessionId: string }> }
) {
  try {
    const { restaurantId, tableSessionId } = await context.params
    const uid = await authenticatePublic(request)
    const body = await request.json()
    const method = body?.method === "cash" ? "cash" : body?.method === "mobile" ? "mobile" : null
    const idempotencyKey =
      typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
    if (!method || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return failure("INVALID_COMMAND", "Demande de paiement invalide.", 400)
    }
    const db = getAdminFirestore()
    const restaurantRef = db.collection("restaurants").doc(restaurantId)
    const sessionRef = restaurantRef.collection("tableSessions").doc(tableSessionId)
    const proofRef = restaurantRef
      .collection("publicPaymentRequestIdempotency")
      .doc(createHash("sha256").update(`${tableSessionId}:${idempotencyKey}`).digest("hex"))
    const result = await db.runTransaction(async (transaction) => {
      const [sessionSnapshot, proofSnapshot, ownedOrders] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(proofRef),
        transaction.get(
          restaurantRef
            .collection("orders")
            .where("tableSessionId", "==", tableSessionId)
            .where("createdBy", "==", uid)
            .limit(1)
        ),
      ])
      if (proofSnapshot.exists) return { replayed: true }
      if (!sessionSnapshot.exists || sessionSnapshot.data()?.status !== "active" || ownedOrders.empty) {
        throw new PublicPaymentError("FORBIDDEN", "Session de table invalide.", 403)
      }
      const tableId = String(sessionSnapshot.data()?.tableId ?? "")
      verifyTableCapability({
        token: typeof body?.capability === "string" ? body.capability : null,
        restaurantId,
        tableId,
        tableSessionId,
      })
      const currentStatus = sessionSnapshot.data()?.paymentRequest?.status
      if (["validated", "pending_confirmation"].includes(currentStatus)) {
        throw new PublicPaymentError(
          "PAYMENT_ALREADY_CONFIRMED",
          "Le paiement est déjà confirmé ou en cours de validation.",
          409
        )
      }
      const paymentRequest = {
        status: body?.paymentProofSms ? "pending_confirmation" : "requested",
        method,
        provider: method === "mobile" && typeof body?.provider === "string" ? body.provider : null,
        paymentProofSms:
          typeof body?.paymentProofSms === "string" && body.paymentProofSms.trim()
            ? body.paymentProofSms.trim().slice(0, 2000)
            : null,
        requestedBy: uid,
        requestedAt: FieldValue.serverTimestamp(),
      }
      transaction.update(sessionRef, { paymentRequest })
      transaction.create(proofRef, {
        restaurantId,
        tableSessionId,
        requestedBy: uid,
        method,
        createdAt: FieldValue.serverTimestamp(),
      })
      return { replayed: false }
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof PublicPaymentError) {
      return failure(error.code, error.message, error.status)
    }
    return failure("UNAUTHENTICATED", "Session publique invalide.", 401)
  }
}

async function authenticatePublic(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : ""
  const appCheckToken = request.headers.get("x-firebase-appcheck") ?? ""
  if (!idToken || !appCheckToken) throw new Error("missing token")
  await verifyOrderAppCheckToken(appCheckToken)
  const decoded = await getAdminAuth().verifyIdToken(idToken, true)
  if (decoded.firebase?.sign_in_provider !== "anonymous") throw new Error("not anonymous")
  return decoded.uid
}

class PublicPaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status })
}
