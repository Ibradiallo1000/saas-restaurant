import { randomUUID } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { assertPublicOrderSecurityConfigured } from "@/server/orders/public-security-config"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"

export const runtime = "nodejs"
const REVIEW_ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; orderId: string }> }
) {
  try {
    const { restaurantId, orderId } = await context.params
    assertPublicOrderSecurityConfigured(restaurantId)
    const uid = await authenticatePublic(request)
    const db = getAdminFirestore()
    const restaurantRef = db.collection("restaurants").doc(restaurantId)
    const orderRef = restaurantRef.collection("orders").doc(orderId)
    const accessRef = restaurantRef.collection("reviewAccess").doc(orderId)
    const result = await db.runTransaction(async (transaction) => {
      const [orderSnapshot, accessSnapshot] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(accessRef),
      ])
      const order = orderSnapshot.data()
      if (
        !orderSnapshot.exists ||
        order?.restaurantId !== restaurantId ||
        order?.createdBy !== uid ||
        !["qr_table", "public_takeaway", "public_delivery"].includes(String(order?.source))
      ) {
        throw new ReviewAccessError("FORBIDDEN", "Commande inaccessible.", 403)
      }
      if (order?.paymentStatus !== "paid" || order?.orderStatus !== "completed") {
        throw new ReviewAccessError(
          "REVIEW_NOT_ELIGIBLE",
          "L’avis sera disponible après le service et le paiement.",
          409
        )
      }
      if (accessSnapshot.exists) {
        const access = accessSnapshot.data() ?? {}
        if (access.clientId !== uid || access.restaurantId !== restaurantId) {
          throw new ReviewAccessError("FORBIDDEN", "Accès avis incohérent.", 403)
        }
        return { reviewToken: access.reviewToken, replayed: true }
      }
      const reviewToken = randomUUID()
      const now = new Date()
      transaction.create(accessRef, {
        restaurantId,
        orderId,
        clientId: uid,
        reviewToken,
        createdAt: now,
        expiresAt: new Date(now.getTime() + REVIEW_ACCESS_TTL_MS),
        version: 1,
      })
      return { reviewToken, replayed: false }
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof ReviewAccessError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status }
      )
    }
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "Session publique invalide." },
      { status: 401 }
    )
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

class ReviewAccessError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message)
  }
}
