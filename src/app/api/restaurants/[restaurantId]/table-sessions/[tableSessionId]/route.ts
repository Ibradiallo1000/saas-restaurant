import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"
import { assertPublicOrderSecurityConfigured } from "@/server/orders/public-security-config"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ restaurantId: string; tableSessionId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { restaurantId, tableSessionId } = await context.params
    assertPublicOrderSecurityConfigured(restaurantId)
    await authenticatePublic(request)

    const db = getAdminFirestore()
    const restaurantRef = db.collection("restaurants").doc(restaurantId)
    const sessionRef = restaurantRef.collection("tableSessions").doc(tableSessionId)

    const sessionSnapshot = await sessionRef.get()
    if (!sessionSnapshot.exists) {
      return NextResponse.json(
        { ok: false, error: { code: "SESSION_NOT_FOUND", message: "Session de table introuvable." } },
        { status: 404 }
      )
    }

    const session = { id: sessionSnapshot.id, ...sessionSnapshot.data() } as Record<string, unknown>

    // Lire toutes les commandes liées à cette session
    const [canonicalOrders, legacyOrders] = await Promise.all([
      restaurantRef.collection("orders").where("tableSessionId", "==", tableSessionId).get(),
      restaurantRef.collection("orders").where("sessionId", "==", tableSessionId).get(),
    ])

    const ordersMap = new Map<string, FirebaseFirestore.DocumentData>()
    canonicalOrders.docs.forEach((doc) => ordersMap.set(doc.id, { id: doc.id, ...doc.data() }))
    legacyOrders.docs.forEach((doc) => {
      if (!ordersMap.has(doc.id)) {
        ordersMap.set(doc.id, { id: doc.id, ...doc.data() })
      }
    })

    const orders = Array.from(ordersMap.values())

    // Calculer les agrégats depuis les commandes
    let totalOrdered = 0
    let totalPaid = 0
    let totalCancelled = 0
    let totalDiscount = 0
    let totalRefunded = 0

    const simplifiedOrders = orders.map((order: any) => {
      const orderTotal = Number(order.totalAmount ?? order.total ?? 0)
      totalOrdered += orderTotal

      if (isPaidStatus(order.paymentStatus)) {
        totalPaid += orderTotal
      }

      totalDiscount += Number(order.discountAmount ?? 0)
      totalRefunded += Number(order.refundTotal ?? 0)

      // Calculer les annulations depuis les items
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const cancelledQty = Number(item.cancelledQuantity ?? 0)
          if (cancelledQty > 0) {
            totalCancelled += cancelledQty * Number(item.unitPrice ?? 0)
          }
        })
      }

      return {
        id: order.id,
        displayId: order.displayId ?? order.id?.slice(0, 8).toUpperCase(),
        total: orderTotal,
        paymentStatus: order.paymentStatus ?? "unpaid",
        orderStatus: order.orderStatus ?? order.kitchenStatus ?? order.status,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        createdAt: order.createdAt,
        createdBy: order.createdBy,
      }
    })

    const totalDue = Math.max(0, totalOrdered - totalCancelled - totalDiscount - totalRefunded - totalPaid)

    // Utiliser les agrégats stockés s'ils existent et sont cohérents
    const storedTotalOrdered = Number(session.totalOrdered ?? 0)
    const shouldUseStored = storedTotalOrdered > 0 && storedTotalOrdered === totalOrdered

    const response = {
      ok: true,
      session: {
        id: session.id,
        tableId: session.tableId,
        zoneId: session.zoneId,
        status: session.status,
        totalAmount: session.totalAmount ?? totalDue,
        paymentRequest: session.paymentRequest ?? { status: "none" },
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        closedAt: session.closedAt,
        totalOrdered: shouldUseStored ? Number(session.totalOrdered) : totalOrdered,
        totalPaid: shouldUseStored ? Number(session.totalPaid) : totalPaid,
        totalCancelled: shouldUseStored ? Number(session.totalCancelled) : totalCancelled,
        totalDiscount: shouldUseStored ? Number(session.totalDiscount) : totalDiscount,
        totalRefunded: shouldUseStored ? Number(session.totalRefunded) : totalRefunded,
        totalDue: shouldUseStored ? Number(session.totalDue) : totalDue,
        aggregateVersion: shouldUseStored ? Number(session.aggregateVersion ?? 0) : 0,
      },
      orders: simplifiedOrders,
      counts: {
        totalOrdered: shouldUseStored ? Number(session.totalOrdered) : totalOrdered,
        totalPaid: shouldUseStored ? Number(session.totalPaid) : totalPaid,
        totalCancelled,
        totalDiscount,
        totalRefunded,
        totalDue: shouldUseStored ? Number(session.totalDue) : totalDue,
        orderCount: orders.length,
        paidOrderCount: orders.filter((o: any) => isPaidStatus(o.paymentStatus)).length,
        unpaidOrderCount: orders.filter((o: any) => !isPaidStatus(o.paymentStatus)).length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[TABLE_SESSION_GET]", error)

    if (error instanceof Error && error.message === "Table introuvable") {
      return NextResponse.json(
        { ok: false, error: { code: "TABLE_NOT_FOUND", message: error.message } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Impossible de charger la session.",
        },
      },
      { status: 500 }
    )
  }
}

async function authenticatePublic(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : ""
  const appCheckToken = request.headers.get("x-firebase-appcheck") ?? ""
  if (!idToken || !appCheckToken) throw new Error("missing public proof")
  await verifyOrderAppCheckToken(appCheckToken)
  const decoded = await getAdminAuth().verifyIdToken(idToken, true)
  if (decoded.firebase?.sign_in_provider !== "anonymous") {
    throw new Error("anonymous authentication required")
  }
}

function isPaidStatus(status: string | null | undefined): boolean {
  return ["paid", "verified", "paye", "validated"].includes(String(status ?? "").toLowerCase())
}
