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
import {
  DEFAULT_POS_STATION_ID,
  normalizePaymentProviderToBalanceKey,
  resolvePaymentBalances,
  resolveSessionPosStationId,
} from "../../lib/pos-stations.ts"

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
      const [sessionSnapshot, ledgerSnapshot, handoverSnapshot, restaurantSnapshot, stationsSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(ledgerQuery),
        transaction.get(handoverRef),
        transaction.get(root),
        transaction.get(root.collection("posStations")),
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
      const openingPaymentBalances = resolvePaymentBalances(session.openingPaymentBalances)
      const closingPaymentBalances = applyPaymentSessionTotals(openingPaymentBalances, aggregate.totalsByProvider)
      const mobileMoneyPostedAtPayment = calculateMobileMoneyPostedAtPayment(
        ledgerSnapshot.docs.map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() || {}),
        })) as FinancialLedgerEntry[]
      )
      const mobileMoneyPendingTreasuryPost = Math.max(0, close.expectedMobileMoney - mobileMoneyPostedAtPayment)
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
        posStationId: String(session.posStationId || "DEFAULT"),
        posStationName: String(session.posStationName || "Caisse principale"),
        posStationCode: String(session.posStationCode || "DEFAULT"),
        openingPaymentBalances,
        sessionPaymentBalanceChanges: buildPaymentBalanceChanges(aggregate.totalsByProvider),
        closingPaymentBalances,
        mobileMoneyPostedAtPayment,
        mobileMoneyPendingTreasuryPost,
      }
      const isMobileOnlySettlement =
        close.expectedHandover === 0 && close.expectedMobileMoney > 0

      if (isMobileOnlySettlement && !handoverSnapshot.exists) {
        transaction.create(handoverRef, {
          restaurantId: input.restaurantId,
          sessionId: input.sessionId,
          cashierId: input.cashierId,
          posStationId: String(session.posStationId || "DEFAULT"),
          posStationName: String(session.posStationName || "Caisse principale"),
          posStationCode: String(session.posStationCode || "DEFAULT"),
          expectedAmount: 0,
          declaredAmount: 0,
          declarationDifference: 0,
          cashierNote: null,
          status: "submitted",
          workflowVersion: 1,
          physicalHandoverRequired: false,
          automaticCashlessSettlement: true,
          mobileMoneyPostedAtPayment,
          mobileMoneyPendingTreasuryPost,
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
        openingPaymentBalances,
        sessionPaymentBalanceChanges: buildPaymentBalanceChanges(aggregate.totalsByProvider),
        closingPaymentBalances,
        mobileMoneyPostedAtPayment,
        mobileMoneyPendingTreasuryPost,
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
      const stationId = resolveSessionPosStationId(session)
      if (stationId === DEFAULT_POS_STATION_ID) {
        if (restaurantSnapshot.data()?.defaultPosStationActiveSessionId === input.sessionId) {
          transaction.update(root, {
            defaultPosStationActiveSessionId: null,
            defaultPosStationCashFloat: {
              amount: close.retainedFloat,
              updatedAt: now,
              updatedBy: input.cashierId,
            },
            updatedAt: now,
          })
        }
      } else {
        const stationSnapshot = stationsSnapshot.docs.find((entry) => entry.id === stationId)
        if (stationSnapshot?.data()?.activeSessionId === input.sessionId) {
          transaction.update(stationSnapshot.ref, {
            activeSessionId: null,
            cashFloat: {
              amount: close.retainedFloat,
              updatedAt: now,
              updatedBy: input.cashierId,
            },
            updatedAt: now,
            updatedBy: input.cashierId,
          })
        }
      }
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
    openingPaymentBalances: resolvePaymentBalances(session.openingPaymentBalances),
    sessionPaymentBalanceChanges: resolvePaymentBalances(session.sessionPaymentBalanceChanges),
    closingPaymentBalances: resolvePaymentBalances(session.closingPaymentBalances),
  }
}

function buildPaymentBalanceChanges(totalsByProvider: Record<string, number> | undefined) {
  const changes = resolvePaymentBalances(null)
  for (const [provider, amount] of Object.entries(totalsByProvider || {})) {
    const key = normalizePaymentProviderToBalanceKey(provider)
    if (!key) continue
    const value = Math.round(Number(amount || 0))
    if (Number.isFinite(value)) changes[key] += value
  }
  return changes
}

function applyPaymentSessionTotals(
  openingPaymentBalances: Record<string, number>,
  totalsByProvider: Record<string, number> | undefined
) {
  const closing = resolvePaymentBalances(openingPaymentBalances)
  const changes = buildPaymentBalanceChanges(totalsByProvider)
  for (const [key, amount] of Object.entries(changes)) {
    closing[key as keyof typeof closing] = Math.max(0, Number(closing[key as keyof typeof closing] || 0) + Number(amount || 0))
  }
  return closing
}

function calculateMobileMoneyPostedAtPayment(entries: FinancialLedgerEntry[]) {
  return entries.reduce((total, entry) => {
    if (entry.status !== "confirmed" || entry.type !== "mobile_money" || !entry.paymentAccountId) return total
    const amount = Math.round(Number(entry.amount || 0))
    if (!Number.isFinite(amount) || amount <= 0) return total
    return total + (entry.entryType === "refund" ? -amount : amount)
  }, 0)
}

export { CashSessionCloseValidationError }
