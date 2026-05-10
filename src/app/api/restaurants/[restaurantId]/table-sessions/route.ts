import { NextResponse } from "next/server"
import { FieldValue, Timestamp } from "firebase-admin/firestore"

import { getAdminFirestore } from "@/server/firebase-admin"

const SESSION_TIMEOUT_MS = 30 * 60 * 1000

type RouteContext = {
  params: Promise<{ restaurantId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params
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
      const currentSessionId =
        typeof table.currentSessionId === "string" ? table.currentSessionId : ""

      if (currentSessionId) {
        const existingSessionRef = sessionsRef.doc(currentSessionId)
        const existingSessionSnap = await transaction.get(existingSessionRef)
        const existingSession = existingSessionSnap.data() || {}

        if (
          existingSessionSnap.exists &&
          existingSession.status === "active" &&
          !isSessionExpired(existingSession.lastActivityAt || existingSession.startedAt)
        ) {
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
            createdAt: FieldValue.serverTimestamp(),
          })

          return {
            tableId,
            tableName,
            zoneId,
            sessionId: currentSessionId,
            status: "active",
          }
        }

        if (existingSessionSnap.exists && existingSession.status === "active") {
          transaction.update(existingSessionRef, {
            status: "closed",
            closedAt: FieldValue.serverTimestamp(),
            lastActivityAt: FieldValue.serverTimestamp(),
          })
        }
      }

      const sessionRef = sessionsRef.doc()
      transaction.create(sessionRef, {
        tableId,
        zoneId,
        startedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        closedAt: null,
        status: "active",
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
        createdAt: FieldValue.serverTimestamp(),
      })

      return {
        tableId,
        tableName,
        zoneId,
        sessionId: sessionRef.id,
        status: "active",
      }
    })

    return NextResponse.json(result)
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

function isSessionExpired(value: unknown) {
  const millis = timestampToMillis(value)
  if (!millis) return false
  return Date.now() - millis > SESSION_TIMEOUT_MS
}

function timestampToMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis()

  if (value && typeof value === "object" && "_seconds" in value) {
    const seconds = Number((value as { _seconds?: unknown })._seconds)
    return Number.isFinite(seconds) ? seconds * 1000 : null
  }

  return null
}
