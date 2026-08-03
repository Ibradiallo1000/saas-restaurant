import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { createTableCapability } from "@/server/orders/create/security"
import { assertPublicOrderSecurityConfigured } from "@/server/orders/public-security-config"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"

type RouteContext = {
  params: Promise<{ restaurantId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params
    assertPublicOrderSecurityConfigured(restaurantId)
    await authenticatePublic(request)
    const body = await request.json().catch(() => null)
    const tableId = typeof body?.tableId === "string" ? body.tableId.trim() : ""

    console.log("restaurantId:", restaurantId)
    console.log("tableId:", tableId)

    if (!restaurantId || !tableId) {
      return NextResponse.json({ error: "restaurantId et tableId requis" }, { status: 400 })
    }

    const db = getAdminFirestore()
    const tableRef = db.collection("restaurants").doc(restaurantId).collection("tables").doc(tableId)
    const sessionsRef = db.collection("restaurants").doc(restaurantId).collection("tableSessions")
    const visitsRef = db.collection("restaurants").doc(restaurantId).collection("visits")

    const initialTableSnap = await tableRef.get()
    if (!initialTableSnap.exists) {
      throw new Error("Table introuvable")
    }

    const result = await db.runTransaction(async (transaction) => {
      const tableSnap = await transaction.get(tableRef)

      if (!tableSnap.exists) {
        throw new Error("Table introuvable")
      }

      const table = tableSnap.data() || {}
      const tableName = typeof table.name === "string" ? table.name : tableId
      const zoneId = typeof table.zoneId === "string" && table.zoneId ? table.zoneId : "main"

      // The table's currentSessionId is the single source of truth for which
      // session is active. A session stays active as long as the table is
      // occupied; there is no automatic 30-minute expiry. The table is only
      // released explicitly by the staff (closeActiveTableSession), at which
      // point currentSessionId is cleared and a new scan creates a new session.
      const currentSessionId =
        typeof table.currentSessionId === "string" ? table.currentSessionId : ""
      if (currentSessionId) {
        const existingSessionRef = sessionsRef.doc(currentSessionId)
        const existingSessionSnap = await transaction.get(existingSessionRef)
        const existingSession = existingSessionSnap.data() || {}

        if (existingSessionSnap.exists && existingSession.status === "active") {
          transaction.update(existingSessionRef, {
            lastActivityAt: FieldValue.serverTimestamp(),
          })
          transaction.update(tableRef, {
            status: "occupied",
            updatedAt: FieldValue.serverTimestamp(),
            lastActivityAt: FieldValue.serverTimestamp(),
          })
          transaction.create(visitsRef.doc(), {
            tableId,
            sessionId: currentSessionId,
            tableSessionId: currentSessionId,
            createdAt: FieldValue.serverTimestamp(),
          })

          return {
            tableId,
            tableName,
            zoneId,
            sessionId: currentSessionId,
            tableSessionId: currentSessionId,
            totalAmount: Number(existingSession.totalAmount || 0),
            status: "active",
          }
        }

        if (existingSessionSnap.exists) {
          // Session was closed (table released explicitly). A new scan must
          // create a fresh session instead of resurrecting the closed one.
          transaction.update(existingSessionRef, {
            lastActivityAt: FieldValue.serverTimestamp(),
            closedReason: "closed_table_pointer",
          })
        }
      }

      // No active session for this table: create a new one.
      const sessionRef = sessionsRef.doc()
      transaction.create(sessionRef, {
        tableId,
        zoneId,
        createdAt: FieldValue.serverTimestamp(),
        startedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        closedAt: null,
        totalAmount: 0,
        status: "active",
        paymentRequest: { status: "none" },
      })
      transaction.update(tableRef, {
        status: "occupied",
        currentSessionId: sessionRef.id,
        updatedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      })
      transaction.create(visitsRef.doc(), {
        tableId,
        sessionId: sessionRef.id,
        tableSessionId: sessionRef.id,
        createdAt: FieldValue.serverTimestamp(),
      })

      return {
        tableId,
        tableName,
        zoneId,
        sessionId: sessionRef.id,
        tableSessionId: sessionRef.id,
        totalAmount: 0,
        status: "active",
      }
    })

    const capability = createTableCapability({
      restaurantId,
      tableId: result.tableId,
      tableSessionId: result.tableSessionId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      capability,
    })
  } catch (error) {
    console.error("Session error:", error)

    if (error instanceof Error && error.message === "Table introuvable") {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de preparer la session de table",
      },
      { status: 500 }
    )
  }
}

async function authenticatePublic(request: Request) {
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

