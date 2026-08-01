import type { DocumentData, DocumentReference, Firestore } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

import {
  DEFAULT_POS_STATION_ID,
  resolvePosStation,
  resolveSessionPosStationId,
  resolveStaffDefaultPosStationId,
  resolveStaffPosStationIds,
} from "../../lib/pos-stations.ts"
import { FinancialLedgerError } from "./firestore-payment-ledger.ts"

export class FirestoreCashSessionOpen {
  private readonly db: Firestore

  constructor(db: Firestore) {
    this.db = db
  }

  async open(input: {
    restaurantId: string
    cashierId: string
    requestedBy: string
    requestedByRole: string
    posStationId?: string | null
    legacySessionId?: string | null
    deviceInstanceId?: string | null
    openingBalance?: number
  }) {
    const root = this.db.collection("restaurants").doc(input.restaurantId)
    const sessionRef = input.legacySessionId
      ? root.collection("cashSessions").doc(input.legacySessionId)
      : root.collection("cashSessions").doc()
    return this.db.runTransaction(async (transaction) => {
      const [restaurantSnapshot, staffSnapshot, userSnapshot, stationsSnapshot, openSessionsSnapshot, legacySessionSnapshot] = await Promise.all([
        transaction.get(root),
        transaction.get(root.collection("staff").doc(input.cashierId)),
        transaction.get(this.db.collection("users").doc(input.cashierId)),
        transaction.get(root.collection("posStations")),
        transaction.get(root.collection("cashSessions").where("status", "==", "open")),
        input.legacySessionId ? transaction.get(sessionRef) : Promise.resolve(null),
      ])
      if (!restaurantSnapshot.exists) throw error("RESTAURANT_NOT_FOUND", "Restaurant introuvable.")
      const staff = staffSnapshot.data() ?? {}
      const user = userSnapshot.data() ?? {}
      const role = String(staff.role || user.role || "")
      const belongs = staffSnapshot.exists || user.restaurantId === input.restaurantId
      if (!belongs || !["cashier", "manager", "owner"].includes(role) || staff.active === false || user.active === false) {
        throw error("FORBIDDEN", "Ce compte ne peut pas ouvrir de session de caisse.")
      }
      if (input.requestedBy !== input.cashierId && !["manager", "owner"].includes(input.requestedByRole)) {
        throw error("FORBIDDEN", "Seul un Manager ou Owner peut ouvrir la session d’un autre caissier.")
      }

      const allowed = resolveStaffPosStationIds(staff)
      const requestedStationId = String(input.posStationId || resolveStaffDefaultPosStationId(staff))
      if (!allowed.includes(requestedStationId)) throw error("POS_STATION_FORBIDDEN", "Ce caissier n’est pas affecté à ce poste.")
      const stationSnapshot = stationsSnapshot.docs.find((entry) => entry.id === requestedStationId)
      const station = requestedStationId === DEFAULT_POS_STATION_ID
        ? resolvePosStation(null)
        : resolvePosStation(stationSnapshot ? { id: stationSnapshot.id, ...stationSnapshot.data() } : null)
      if (requestedStationId !== DEFAULT_POS_STATION_ID && !stationSnapshot) throw error("POS_STATION_NOT_FOUND", "Poste de caisse introuvable.")
      if (!station.isActive) throw error("POS_STATION_INACTIVE", "Ce poste de caisse est désactivé.")

      if (input.legacySessionId) {
        if (!legacySessionSnapshot?.exists) throw error("CASH_SESSION_NOT_FOUND", "Demande de caisse introuvable.")
        const legacy = legacySessionSnapshot.data() ?? {}
        if (!["pending", "requested", "pending_approval", "opening_requested"].includes(String(legacy.status || ""))) {
          throw error("INVALID_CASH_SESSION_STATUS", "Cette demande de caisse ne peut plus être ouverte.")
        }
        const legacyCashierId = String(legacy.cashierId || legacy.userId || legacy.staffId || "")
        if (legacyCashierId && legacyCashierId !== input.cashierId) throw error("FORBIDDEN", "Cette demande appartient à un autre caissier.")
      }

      const openSessions: Array<DocumentData & { id: string }> = openSessionsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      const existingCashierSession = openSessions.find((session) => String(session.cashierId || session.userId || session.staffId) === input.cashierId)
      if (existingCashierSession) {
        return { sessionId: existingCashierSession.id, replayed: true, session: existingCashierSession }
      }
      if (openSessions.some((session) => resolveSessionPosStationId(session) === requestedStationId)) {
        throw error("POS_STATION_ALREADY_OPEN", "Une session est déjà ouverte sur ce poste.")
      }

      const stationRef: DocumentReference | null = stationSnapshot?.ref ?? null
      if (stationRef && stationSnapshot?.data()?.activeSessionId) {
        throw error("POS_STATION_ALREADY_OPEN", "Une session est déjà ouverte sur ce poste.")
      }
      const restaurant = restaurantSnapshot.data() ?? {}
      if (requestedStationId === DEFAULT_POS_STATION_ID && restaurant.defaultPosStationActiveSessionId) {
        throw error("POS_STATION_ALREADY_OPEN", "Une session est déjà ouverte sur la caisse principale.")
      }

      const now = Timestamp.now()
      const cashierName = String(staff.nomComplet || staff.name || staff.staffName || user.nomComplet || user.name || user.email || "Caissier")
      const session: DocumentData = {
        restaurantId: input.restaurantId,
        cashierId: input.cashierId,
        userId: input.cashierId,
        staffId: input.cashierId,
        cashierName,
        staffName: cashierName,
        posStationId: station.id,
        posStationName: station.name,
        posStationCode: station.code,
        posCatalogScopeSnapshot: {
          mode: station.catalogMode,
          allowedCategoryIds: station.allowedCategoryIds,
          allowedProductIds: station.allowedProductIds,
          excludedProductIds: station.excludedProductIds,
        },
        deviceInstanceId: cleanDeviceId(input.deviceInstanceId),
        status: "open",
        openedAt: now,
        closedAt: null,
        openingBalance: normalizeOpeningBalance(input.openingBalance),
        closingBalance: null,
        totalCash: 0,
        totalMobile: 0,
        totalOrders: 0,
        validatedByManager: false,
        approvedBy: input.requestedBy,
        approvedRole: input.requestedByRole,
        createdAt: now,
        updatedAt: now,
      }
      if (input.legacySessionId) transaction.update(sessionRef, session)
      else transaction.create(sessionRef, session)
      if (stationRef) transaction.update(stationRef, { activeSessionId: sessionRef.id, updatedAt: now, updatedBy: input.requestedBy })
      else transaction.update(root, { defaultPosStationActiveSessionId: sessionRef.id, updatedAt: now })
      return { sessionId: sessionRef.id, replayed: false, session: { id: sessionRef.id, ...session } }
    })
  }
}

function error(code: string, message: string) { return new FinancialLedgerError(code, message) }
function normalizeOpeningBalance(value: unknown) { const amount = Math.round(Number(value || 0)); if (!Number.isFinite(amount) || amount < 0) throw error("INVALID_OPENING_BALANCE", "Fond de caisse invalide."); return amount }
function cleanDeviceId(value: unknown) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 128) : null }
