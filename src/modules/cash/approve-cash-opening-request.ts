import type { User } from "firebase/auth"
import { doc, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"
import { openCashSession } from "@/modules/pos/canonical/cash-session-command-client"

export async function approveCashOpeningRequest({
  db,
  restaurantId,
  request,
  user,
}: {
  db: Firestore
  restaurantId: string
  request: any
  user: User
}) {
  const cashierId = request.cashierId || request.userId || request.staffId
  if (!cashierId) throw new Error("Utilisateur de caisse introuvable.")
  const result = await openCashSession({
    restaurantId,
    user,
    cashierId,
    posStationId: request.posStationId || null,
    legacySessionId: request.source === "session" ? request.id : null,
    openingBalance: Number(request.openingBalance || request.initialAmount || 0),
    deviceInstanceId: request.deviceInstanceId || null,
  })
  if (request.source !== "session" && request.id) {
    await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests", request.id), {
      status: "approved",
      sessionId: result.sessionId,
      approvedBy: user.uid,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return result.sessionId
}
