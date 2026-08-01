import { createHash } from "node:crypto"

import { FieldValue } from "firebase-admin/firestore"
import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { assertPublicOrderSecurityConfigured } from "@/server/orders/public-security-config"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; orderId: string }> }
) {
  try {
    const { restaurantId, orderId } = await context.params
    assertPublicOrderSecurityConfigured(restaurantId)
    const uid = await authenticatePublic(request)
    const body = await request.json()
    const method = body?.method === "cash" ? "cash" : body?.method === "mobile" ? "mobile" : null
    const key = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
    if (!method || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
      return failure("INVALID_COMMAND", "Demande de paiement invalide.", 400)
    }
    const db = getAdminFirestore()
    const restaurantRef = db.collection("restaurants").doc(restaurantId)
    const orderRef = restaurantRef.collection("orders").doc(orderId)
    const proofRef = restaurantRef
      .collection("publicPaymentRequestIdempotency")
      .doc(createHash("sha256").update(`${orderId}:${key}`).digest("hex"))
    const requestRef = restaurantRef.collection("publicPaymentRequests").doc(orderId)
    const result = await db.runTransaction(async (transaction) => {
      const [orderSnapshot, proofSnapshot, requestSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(proofRef),
        transaction.get(requestRef),
      ])
      if (proofSnapshot.exists) return { replayed: true }
      const order = orderSnapshot.data()
      if (
        !orderSnapshot.exists ||
        order?.restaurantId !== restaurantId ||
        order?.createdBy !== uid ||
        !["public_takeaway", "public_delivery"].includes(String(order?.source))
      ) {
        throw new PublicPaymentError("FORBIDDEN", "Commande publique inaccessible.", 403)
      }
      if (order?.paymentStatus === "paid") {
        throw new PublicPaymentError("PAYMENT_ALREADY_CONFIRMED", "Paiement déjà confirmé.", 409)
      }
      const paymentRequest = {
        restaurantId,
        orderId,
        clientId: uid,
        method,
        provider: method === "mobile" && typeof body?.provider === "string" ? body.provider : null,
        paymentProofSms:
          typeof body?.paymentProofSms === "string" && body.paymentProofSms.trim()
            ? body.paymentProofSms.trim().slice(0, 2000)
            : null,
        status: body?.paymentProofSms ? "pending_confirmation" : "requested",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: requestSnapshot.exists
          ? requestSnapshot.data()?.createdAt ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
      }
      transaction.set(requestRef, paymentRequest)
      transaction.update(orderRef, {
        paymentMethod: method,
        paymentProofSms: paymentRequest.paymentProofSms,
        paymentProofSubmittedAt: paymentRequest.paymentProofSms
          ? FieldValue.serverTimestamp()
          : null,
        paymentProofStatus: paymentRequest.paymentProofSms ? "submitted" : "not_required",
        paymentRequest: {
          status: paymentRequest.status,
          method,
          provider: paymentRequest.provider,
          requestedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.create(proofRef, {
        restaurantId,
        orderId,
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
  return decoded.uid
}

class PublicPaymentError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message)
  }
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status })
}
