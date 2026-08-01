import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; orderId: string }> }
) {
  try {
    const { restaurantId, orderId } = await context.params
    const uid = await authenticatePublic(request)
    const orderRef = getAdminFirestore()
      .collection("restaurants")
      .doc(restaurantId)
      .collection("orders")
      .doc(orderId)
    const [orderSnapshot, itemSnapshots] = await Promise.all([
      orderRef.get(),
      orderRef.collection("orderItems").orderBy("createdAt", "asc").get(),
    ])
    if (!orderSnapshot.exists) {
      return failure("ORDER_NOT_FOUND", "Commande introuvable.", 404)
    }
    const order = orderSnapshot.data() ?? {}
    if (
      order.restaurantId !== restaurantId ||
      order.createdBy !== uid ||
      !["qr_table", "public_takeaway", "public_delivery"].includes(String(order.source))
    ) {
      return failure("FORBIDDEN", "Cette commande n’appartient pas à cette session.", 403)
    }
    return NextResponse.json({
      ok: true,
      order: serialize({ id: orderSnapshot.id, ...order }),
      orderItems: itemSnapshots.docs.map((snapshot) =>
        serialize({ id: snapshot.id, ...snapshot.data() })
      ),
      legacy: itemSnapshots.empty,
    })
  } catch {
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

function serialize(value: any): any {
  if (value?.toDate instanceof Function) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]))
  }
  return value
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status })
}
