import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export async function approveCashOpeningRequest({
  db,
  restaurantId,
  request,
  approverId,
  approverRole,
}: {
  db: Firestore
  restaurantId: string
  request: any
  approverId: string
  approverRole: string
}) {
  const cashierId = request.cashierId || request.userId || request.staffId
  if (!cashierId) throw new Error("Utilisateur de caisse introuvable.")

  const staffId = request.staffId || cashierId
  const sessionId = request.sessionId || request.id
  const sessionPayload = {
    restaurantId,
    cashierId,
    userId: cashierId,
    staffId,
    staffName: request.staffName || request.cashierName || "Caissier",
    cashierName: request.cashierName || request.staffName || "Caissier",
    staffPhone: request.staffPhone || null,
    status: "open",
    openedAt: serverTimestamp(),
    closedAt: null,
    openingBalance: Number(request.openingBalance || 0),
    closingBalance: null,
    totalCash: 0,
    totalMobile: 0,
    totalOrders: 0,
    validatedByManager: false,
    approvedBy: approverId,
    approvedRole: approverRole,
    approvedAt: serverTimestamp(),
    createdAt: request.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await runTransaction(db, async (transaction) => {
    if (request.source === "session") {
      const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, request.id)
      transaction.update(sessionRef, { ...sessionPayload, activatedFrom: "cashSession" })
      return
    }

    const requestRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests", request.id)
    const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, sessionId)
    transaction.set(sessionRef, { ...sessionPayload, requestId: request.id, activatedFrom: "cashSessionRequest" })
    transaction.update(requestRef, {
      status: "approved",
      sessionId,
      approvedBy: approverId,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  return sessionId
}
