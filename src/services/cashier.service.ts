"use client"

import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"
import { PaymentLedgerService } from "@/services/payment-ledger.service"

export type CashSession = {
  id: string
  restaurantId: string
  cashierId: string
  status: "open" | "closed" | "pending_validation" | "validated" | "rejected"
  openedAt: any
  closedAt?: any
  openingBalance: number
  closingBalance?: number
  closingCash?: number
  closingMobileMoney?: number
  declaredCash?: number
  declaredMobileMoney?: number
  declaredTotal?: number
  cashDifference?: number
  mobileMoneyDifference?: number
  discrepancyAmount?: number
  discrepancyStatus?: "balanced" | "pending_review" | "validated" | "investigate"
  closeVersion?: number
  expectedPhysicalCash?: number
  countedPhysicalCash?: number
  cashCountDifference?: number
  retainedFloat?: number
  expectedHandover?: number
  expectedMobileMoney?: number
  netCashSales?: number
  closeSnapshot?: Record<string, any>
  totalCash: number
  totalMobile: number
  totalOrders: number
  validatedByManager: boolean
  validatedAt?: any
  validatedBy?: string
  depositCreated?: boolean
}

export type CashMovement = {
  id: string
  restaurantId: string
  type: "deposit" | "expense" | "transfer"
  amount: number
  source: "session" | "manual"
  sessionId?: string | null
  reason?: string | null
  category?: string | null
  createdAt: any
  createdBy: string
}

export class CashierService {
  constructor(private db: Firestore) {}

  async openShift(restaurantId: string, cashierId: string, openingBalance = 0) {
    const existing = await this.getCurrentSession(restaurantId, cashierId)
    if (existing) {
      throw new Error("Une session est deja ouverte pour ce caissier.")
    }

    return addDoc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS), {
      restaurantId,
      cashierId,
      status: "open",
      openedAt: serverTimestamp(),
      closedAt: null,
      openingBalance: Number(openingBalance || 0),
      closingBalance: null,
      totalCash: 0,
      totalMobile: 0,
      totalOrders: 0,
      validatedByManager: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  /**
   * @deprecated Compatibility-only client closure. Active POS screens use the
   * transactional server-side CLOSE_SESSION V2 command.
   */
  async closeShift(
    restaurantId: string,
    sessionId: string,
    closingBalance:
      | number
      | {
          declaredCash?: number
          declaredMobileMoney?: number
          closingBalance?: number
          closedBy?: string
        }
  ) {
    const ledger = new PaymentLedgerService(this.db)
    const declared =
      typeof closingBalance === "number"
        ? { closingBalance }
        : closingBalance

    await ledger.snapshotSessionClose({
      restaurantId,
      sessionId,
      closedBy: declared.closedBy || sessionId,
      closingBalance: declared.closingBalance,
      declaredCash: declared.declaredCash,
      declaredMobileMoney: declared.declaredMobileMoney,
    })
  }

  /**
   * @deprecated Legacy validation path kept for historical compatibility.
   * New manager validation must use TreasuryService.postCashSessionMovementToTreasury.
   */
  async validateShift(restaurantId: string, sessionId: string, validatorId: string) {
    const sessionRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, sessionId)
    const movementRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS, `session-${sessionId}`)

    await runTransaction(this.db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef)
      const movementSnap = await transaction.get(movementRef)
      if (!sessionSnap.exists()) {
        throw new Error("Session caisse introuvable.")
      }

      const session = sessionSnap.data()
      if (session.validatedByManager || session.status === "validated") return

      const amount = Number(
        session.closeSnapshot?.systemTotal ??
          session.closeSnapshot?.systemTotals?.total ??
          Number(session.totalCash || 0) + Number(session.totalMobile || 0)
      )

      transaction.update(sessionRef, {
        status: "validated",
        validatedByManager: true,
        validatedBy: validatorId,
        validatedAt: serverTimestamp(),
        depositCreated: true,
        updatedAt: serverTimestamp(),
      })

      if (movementSnap.exists()) {
        console.info("[finance] depot session deja existant", { sessionId, amount })
        return
      }

      console.info("[finance] creation depot session", { sessionId, amount })
      transaction.set(movementRef, {
        restaurantId,
        type: "deposit",
        amount,
        source: "session",
        sessionId,
        createdAt: serverTimestamp(),
        createdBy: validatorId,
        reason: "Validation manager de session caisse",
        category: "session",
      })
    })
  }

  async getCurrentSession(restaurantId: string, cashierId: string): Promise<CashSession | null> {
    if (!restaurantId || !cashierId) return null

    const snapshot = await getDocs(
      query(
        collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS),
        where("cashierId", "==", cashierId),
        where("status", "==", "open"),
        orderBy("openedAt", "desc"),
        limit(1)
      )
    )

    if (snapshot.empty) return null
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CashSession
  }

  async calculateSessionTotals(restaurantId: string, sessionId: string) {
    const ledger = new PaymentLedgerService(this.db)
    return ledger.aggregateSessionPayments(restaurantId, sessionId)
  }
}
