"use client"

import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Firestore,
  writeBatch,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export type TableStatus = "free" | "occupied"
export type TableSessionStatus = "active" | "closed"

export type RestaurantTableRecord = {
  id: string
  name: string
  zoneId: string
  status: TableStatus
  currentSessionId: string | null
  createdAt?: unknown
  updatedAt?: unknown
  lastActivityAt?: unknown
}

export type TableSessionRecord = {
  id: string
  tableId: string
  zoneId: string
  startedAt?: unknown
  lastActivityAt?: unknown
  closedAt: unknown | null
  status: TableSessionStatus
}

export type ActiveTableSession = {
  tableId: string
  tableName: string
  zoneId: string
  sessionId: string
  status?: "active"
  startedAt?: unknown
  lastActivityAt?: unknown
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000

function restaurantCollection(db: Firestore, restaurantId: string, name: string) {
  return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, name)
}

function restaurantDoc(
  db: Firestore,
  restaurantId: string,
  collectionName: string,
  documentId: string
) {
  return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, collectionName, documentId)
}

export async function createRestaurantTable(
  db: Firestore,
  restaurantId: string,
  input: { name: string; zoneId: string }
) {
  const name = input.name.trim()
  const zoneId = input.zoneId.trim() || "main"

  if (!name) throw new Error("Le nom de table est obligatoire.")

  return addDoc(restaurantCollection(db, restaurantId, COLLECTION_NAMES.TABLES), {
    name,
    zoneId,
    status: "free",
    currentSessionId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: null,
  })
}

export async function createRestaurantTablesBatch(
  db: Firestore,
  restaurantId: string,
  input: { zoneId: string; count: number; prefix?: string; existingNames?: string[] }
) {
  const zoneId = input.zoneId.trim()
  const prefix = (input.prefix?.trim() || "T").toUpperCase()
  const count = Math.min(Math.max(Math.floor(input.count), 1), 100)
  const existingNames = new Set((input.existingNames || []).map((name) => name.trim().toUpperCase()))

  if (!zoneId) throw new Error("La zone est obligatoire.")

  const names: string[] = []
  let index = 1

  while (names.length < count) {
    const name = `${prefix}${index}`
    if (!existingNames.has(name)) {
      names.push(name)
      existingNames.add(name)
    }
    index += 1
  }

  const batch = writeBatch(db)
  const tablesRef = restaurantCollection(db, restaurantId, COLLECTION_NAMES.TABLES)

  for (const name of names) {
    const tableRef = doc(tablesRef)
    batch.set(tableRef, {
      name,
      zoneId,
      status: "free",
      currentSessionId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActivityAt: null,
    })
  }

  await batch.commit()

  return names
}

export async function getOrCreateActiveTableSession(
  db: Firestore,
  restaurantId: string,
  tableId: string
): Promise<ActiveTableSession> {
  const tableRef = restaurantDoc(db, restaurantId, COLLECTION_NAMES.TABLES, tableId)
  const sessionsRef = restaurantCollection(db, restaurantId, COLLECTION_NAMES.TABLE_SESSIONS)

  return runTransaction(db, async (transaction) => {
    const tableSnap = await transaction.get(tableRef)

    if (!tableSnap.exists()) {
      throw new Error("Table introuvable.")
    }

    const table = tableSnap.data() as RestaurantTableRecord
    const tableName = table.name || tableId
    const zoneId = table.zoneId || "main"

    if (table.currentSessionId) {
      const existingSessionRef = restaurantDoc(
        db,
        restaurantId,
        COLLECTION_NAMES.TABLE_SESSIONS,
        table.currentSessionId
      )
      const existingSessionSnap = await transaction.get(existingSessionRef)
      const existingSession = existingSessionSnap.data() as TableSessionRecord | undefined

      if (
        existingSessionSnap.exists() &&
        existingSession?.status === "active" &&
        !isSessionExpired(existingSession.lastActivityAt ?? existingSession.startedAt)
      ) {
        transaction.update(existingSessionRef, {
          lastActivityAt: serverTimestamp(),
        })
        transaction.update(tableRef, {
          status: "occupied",
          updatedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
        })

        return {
          tableId,
          tableName,
          zoneId,
          sessionId: table.currentSessionId,
          startedAt: existingSession.startedAt,
          lastActivityAt: existingSession.lastActivityAt,
        }
      }

      if (existingSessionSnap.exists() && existingSession?.status === "active") {
        transaction.update(existingSessionRef, {
          status: "closed",
          closedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
        })
      }
    }

    const sessionRef = doc(sessionsRef)
    transaction.set(sessionRef, {
      tableId,
      zoneId,
      startedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      closedAt: null,
      status: "active",
    })
    transaction.update(tableRef, {
      status: "occupied",
      currentSessionId: sessionRef.id,
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    })

    return {
      tableId,
      tableName,
      zoneId,
      sessionId: sessionRef.id,
    }
  })
}

export async function getTableSessionSnapshot(
  db: Firestore,
  restaurantId: string,
  tableId: string
): Promise<ActiveTableSession | null> {
  const tableSnap = await getDoc(
    restaurantDoc(db, restaurantId, COLLECTION_NAMES.TABLES, tableId)
  )

  if (!tableSnap.exists()) return null

  const table = tableSnap.data() as RestaurantTableRecord
  if (!table.currentSessionId) {
    return {
      tableId,
      tableName: table.name || tableId,
      zoneId: table.zoneId || "main",
      sessionId: "",
    }
  }

  return {
    tableId,
    tableName: table.name || tableId,
    zoneId: table.zoneId || "main",
    sessionId: table.currentSessionId,
  }
}

export async function recordTableVisit(
  db: Firestore,
  restaurantId: string,
  input: { tableId: string; sessionId: string }
) {
  await addDoc(restaurantCollection(db, restaurantId, COLLECTION_NAMES.VISITS), {
    tableId: input.tableId,
    sessionId: input.sessionId,
    createdAt: serverTimestamp(),
  })
}

export async function closeActiveTableSession(
  db: Firestore,
  restaurantId: string,
  tableId: string
) {
  const tableRef = restaurantDoc(db, restaurantId, COLLECTION_NAMES.TABLES, tableId)

  await runTransaction(db, async (transaction) => {
    const tableSnap = await transaction.get(tableRef)
    if (!tableSnap.exists()) throw new Error("Table introuvable.")

    const table = tableSnap.data() as RestaurantTableRecord
    if (table.currentSessionId) {
      const sessionRef = restaurantDoc(
        db,
        restaurantId,
        COLLECTION_NAMES.TABLE_SESSIONS,
        table.currentSessionId
      )
      transaction.update(sessionRef, {
        status: "closed",
        closedAt: serverTimestamp(),
      })
    }

    transaction.update(tableRef, {
      status: "free",
      currentSessionId: null,
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    })
  })
}

function isSessionExpired(value: unknown) {
  const lastActivityMs = timestampToMillis(value)
  if (!lastActivityMs) return false

  return Date.now() - lastActivityMs > SESSION_TIMEOUT_MS
}

function timestampToMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis()

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis()
  }

  return null
}
