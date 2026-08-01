import { createHash } from "node:crypto"

import type { DocumentData, Firestore } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

import {
  calculateCashSessionCloseV2,
  CashSessionCloseValidationError,
} from "../../lib/finance/cash-session-close-v2.ts"
import {
  aggregateFinancialEntries,
  financialCachePatch,
  type FinancialLedgerEntry,
} from "../../lib/finance/payment-ledger-domain.ts"
import { FinancialLedgerError } from "./firestore-payment-ledger.ts"

export class FirestoreCashSessionClose {
  private readonly db: Firestore

  constructor(db: Firestore) {
    this.db = db
  }

  async close(input: {
    restaurantId: string
    sessionId: string
    cashierId: string
    countedPhysicalCash: number
    retainedFloat: number
    idempotencyKey: string
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const sessionRef = root.collection("cashSessions").doc(input.sessionId)
      const handoverRef = root.collection("cashHandovers").doc(`session-${input.sessionId}`)
      const ledgerQuery = root.collection("payments").where("sessionId", "==", input.sessionId)
      const [sessionSnapshot, ledgerSnapshot, handoverSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(ledgerQuery),
        transaction.get(handoverRef),
      ])
      if (!sessionSnapshot.exists) {
        throw new FinancialLedgerError("CASH_SESSION_NOT_FOUND", "Session caisse introuvable.")
      }
      const session = sessionSnapshot.data() || {}
      assertOwner(session, input.cashierId)
      const requestHash = closeRequestHash(input)
      if (session.status !== "open") {
        if (
          Number(session.closeVersion) === 2 &&
          session.closeIdempotencyKeyHash === hash(input.idempotencyKey) &&
          session.closeRequestHash === requestHash
        ) {
          return { replayed: true, close: readClose(session) }
        }
        throw new FinancialLedgerError(
          "CASH_SESSION_ALREADY_CLOSED",
          "Cette session de caisse est déjà clôturée."
        )
      }

      const aggregate = aggregateFinancialEntries(
        ledgerSnapshot.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() || {}),
        })) as FinancialLedgerEntry[]
      )
      const close = calculateCashSessionCloseV2({
        openingBalance: session.openingBalance,
        countedPhysicalCash: input.countedPhysicalCash,
        retainedFloat: input.retainedFloat,
        aggregate,
      })
      const now = Timestamp.now()
      const discrepancyStatus =
        close.cashCountDifference === 0 ? "balanced" : "pending_review"
      const systemTotal = close.expectedPhysicalCash + close.expectedMobileMoney
      const declaredTotal = close.countedPhysicalCash + close.expectedMobileMoney
      const closeSnapshot = {
        version: 2,
        ...close,
        systemCash: close.expectedPhysicalCash,
        systemMobileMoney: close.expectedMobileMoney,
        systemTotal,
        systemTotals: {
          cash: close.expectedPhysicalCash,
          mobileMoney: close.expectedMobileMoney,
          total: systemTotal,
        },
        declaredCash: close.countedPhysicalCash,
        declaredMobileMoney: close.expectedMobileMoney,
        declaredTotal,
        declaredTotals: {
          cash: close.countedPhysicalCash,
          mobileMoney: close.expectedMobileMoney,
          total: declaredTotal,
        },
        cashDifference: close.cashCountDifference,
        mobileMoneyDifference: 0,
        totalDifference: close.cashCountDifference,
        diff: {
          cash: close.cashCountDifference,
          mobileMoney: 0,
          total: close.cashCountDifference,
        },
        capturedAt: now,
        capturedBy: input.cashierId,
      }
      const isMobileOnlySettlement =
        close.expectedHandover === 0 && close.expectedMobileMoney > 0

      if (isMobileOnlySettlement && !handoverSnapshot.exists) {
        transaction.create(handoverRef, {
          restaurantId: input.restaurantId,
          sessionId: input.sessionId,
          cashierId: input.cashierId,
          expectedAmount: 0,
          declaredAmount: 0,
          declarationDifference: 0,
          cashierNote: null,
          status: "submitted",
          workflowVersion: 1,
          physicalHandoverRequired: false,
          automaticCashlessSettlement: true,
          submittedAt: now,
          submittedBy: input.cashierId,
          createdAt: now,
          updatedAt: now,
          correctionCount: 0,
        })
      }

      transaction.update(sessionRef, {
        ...financialCachePatch(aggregate),
        financialCacheVersion: 1,
        financialCacheUpdatedAt: now,
        closeVersion: 2,
        closeIdempotencyKeyHash: hash(input.idempotencyKey),
        closeRequestHash: requestHash,
        ...close,
        expectedMobileMoney: close.expectedMobileMoney,
        closingCash: close.countedPhysicalCash,
        closingMobileMoney: close.expectedMobileMoney,
        closingBalance: declaredTotal,
        declaredCash: close.countedPhysicalCash,
        declaredMobileMoney: close.expectedMobileMoney,
        declaredTotal,
        cashDifference: close.cashCountDifference,
        mobileMoneyDifference: 0,
        discrepancyAmount: close.cashCountDifference,
        discrepancyStatus,
        closeSnapshot,
        status: "closed",
        closedAt: now,
        closedBy: input.cashierId,
        ...(isMobileOnlySettlement ? {
          handoverId: handoverRef.id,
          handoverStatus: "submitted",
          handoverSubmittedAt: now,
          physicalHandoverRequired: false,
        } : {}),
        updatedAt: now,
      })
      return { replayed: false, close }
    })
  }
}

function assertOwner(session: DocumentData, cashierId: string) {
  const owners = [session.cashierId, session.userId, session.staffId].filter(Boolean).map(String)
  if (!owners.includes(cashierId)) {
    throw new FinancialLedgerError(
      "CASH_SESSION_OWNERSHIP_MISMATCH",
      "La session de caisse n'appartient pas au caissier actif."
    )
  }
}

function closeRequestHash(input: {
  countedPhysicalCash: number
  retainedFloat: number
}) {
  return hash(JSON.stringify({
    countedPhysicalCash: Math.round(Number(input.countedPhysicalCash)),
    retainedFloat: Math.round(Number(input.retainedFloat)),
  }))
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function readClose(session: DocumentData) {
  return {
    openingBalance: Number(session.openingBalance || 0),
    netCashSales: Number(session.netCashSales || 0),
    expectedPhysicalCash: Number(session.expectedPhysicalCash || 0),
    countedPhysicalCash: Number(session.countedPhysicalCash || 0),
    cashCountDifference: Number(session.cashCountDifference || 0),
    retainedFloat: Number(session.retainedFloat || 0),
    expectedHandover: Number(session.expectedHandover || 0),
    expectedMobileMoney: Number(session.expectedMobileMoney || 0),
  }
}

export { CashSessionCloseValidationError }
