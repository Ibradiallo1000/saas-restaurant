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
      order: serializePublicOrder({ id: orderSnapshot.id, ...order }),
      orderItems: itemSnapshots.docs.map((snapshot) =>
        serializePublicOrder({ id: snapshot.id, ...snapshot.data() })
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

// Champs internes/sensibles jamais exposés via l'API publique.
// Le client de suivi n'a besoin que des données d'affichage et de statut.
// createdBy est conservé pour le marquage "Toi" / "Invitée" côté client.
// statusHistory, timestamps et kitchenStatus sont nécessaires au stepper.
const SENSITIVE_ORDER_FIELDS = new Set([
  "clientRequestId",
  "idempotencyKey",
  "requestHash",
  "aggregateVersion",
  "schemaVersion",
  "cashSessionId",
  "cashierId",
  "originPosStationId",
  "originPosStationName",
  "originPosStationCode",
  "paymentCode",
  "paymentProofSms",
  "paymentReference",
  "preparationStationId",
  "preparationStationName",
  "preparationStationCode",
  "portionReserved",
  "serverTimestamps",
])

function serializePublicOrder(value: any): any {
  if (value?.toDate instanceof Function) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(serializePublicOrder)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_ORDER_FIELDS.has(key))
        .map(([key, child]) => [key, serializePublicOrder(child)])
    )
  }
  return value
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status })
}
