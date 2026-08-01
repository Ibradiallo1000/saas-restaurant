import { createHash } from "node:crypto"

import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore"

import {
  CashHandoverValidationError,
  cleanHandoverNote,
  normalizeHandoverAmount,
  type CashHandoverStatus,
} from "../../lib/finance/cash-handover-domain.ts"
import { FinancialLedgerError } from "./firestore-payment-ledger.ts"

export class FirestoreCashHandover {
  private readonly db: Firestore

  constructor(db: Firestore) {
    this.db = db
  }

  async ensureForManagerReview(input: {
    restaurantId: string
    sessionId: string
    managerId: string
    idempotencyKey: string
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const sessionRef = root.collection("cashSessions").doc(input.sessionId)
      const handoverRef = root.collection("cashHandovers").doc(`session-${input.sessionId}`)
      const [sessionSnapshot, handoverSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(handoverRef),
      ])
      if (!sessionSnapshot.exists) {
        throw new FinancialLedgerError("CASH_SESSION_NOT_FOUND", "Session caisse introuvable.")
      }
      if (handoverSnapshot.exists) {
        return { id: handoverRef.id, replayed: true, status: handoverSnapshot.data()?.status }
      }
      const session = sessionSnapshot.data() || {}
      if (Number(session.closeVersion) !== 2 || !["closed", "pending_validation"].includes(String(session.status))) {
        throw new CashHandoverValidationError(
          "CASH_SESSION_V2_CLOSE_REQUIRED",
          "Seule une session clôturée V2 peut être préparée pour validation."
        )
      }
      const expectedAmount = normalizeHandoverAmount(session.expectedHandover, "expectedHandover")
      const now = Timestamp.now()
      transaction.create(handoverRef, {
        restaurantId: input.restaurantId,
        sessionId: input.sessionId,
        cashierId: String(session.cashierId || session.userId || session.staffId || ""),
        expectedAmount,
        declaredAmount: expectedAmount,
        declarationDifference: 0,
        cashierNote: null,
        status: "submitted",
        workflowVersion: 1,
        physicalHandoverRequired: expectedAmount > 0,
        managerRecovery: true,
        managerRecoveryBy: input.managerId,
        managerRecoveryIdempotencyHash: hash(input.idempotencyKey),
        statusHistory: [{ status: "submitted", at: now, actorId: input.managerId }],
        submittedAt: now,
        submittedBy: input.managerId,
        createdAt: now,
        updatedAt: now,
        correctionCount: 0,
      })
      transaction.update(sessionRef, {
        handoverId: handoverRef.id,
        handoverStatus: "submitted",
        handoverSubmittedAt: now,
        updatedAt: now,
      })
      return { id: handoverRef.id, replayed: false, status: "submitted" }
    })
  }

  async submit(input: {
    restaurantId: string
    sessionId: string
    cashierId: string
    declaredAmount: number
    note?: string | null
    idempotencyKey: string
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const sessionRef = root.collection("cashSessions").doc(input.sessionId)
      const handoverRef = root.collection("cashHandovers").doc(`session-${input.sessionId}`)
      const [sessionSnapshot, handoverSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(handoverRef),
      ])
      if (!sessionSnapshot.exists) {
        throw new FinancialLedgerError("CASH_SESSION_NOT_FOUND", "Session caisse introuvable.")
      }
      const session = sessionSnapshot.data() || {}
      assertSessionOwner(session, input.cashierId)
      if (Number(session.closeVersion) !== 2 || session.status === "open") {
        throw new CashHandoverValidationError(
          "CASH_SESSION_V2_CLOSE_REQUIRED",
          "La session doit être clôturée avec la clôture V2 avant la remise."
        )
      }
      const expectedAmount = normalizeHandoverAmount(session.expectedHandover, "expectedHandover")
      if (expectedAmount === 0) {
        throw new CashHandoverValidationError(
          "NO_PHYSICAL_HANDOVER_REQUIRED",
          "Aucune remise physique n'est requise pour cette session."
        )
      }
      const declaredAmount = normalizeHandoverAmount(input.declaredAmount, "declaredAmount")
      const note = cleanHandoverNote(input.note)
      const requestHash = hash(JSON.stringify({ declaredAmount, note }))
      const idempotencyHash = hash(input.idempotencyKey)
      const now = Timestamp.now()

      if (handoverSnapshot.exists) {
        const existing = handoverSnapshot.data() || {}
        if (
          existing.submitIdempotencyHash === idempotencyHash &&
          existing.submitRequestHash === requestHash
        ) {
          return { id: handoverRef.id, replayed: true, status: existing.status }
        }
        if (existing.status !== "correction_required") {
          throw new CashHandoverValidationError(
            "ACTIVE_HANDOVER_ALREADY_EXISTS",
            "Une remise active existe déjà pour cette session."
          )
        }
        transaction.update(handoverRef, {
          declaredAmount,
          expectedAmount,
          declarationDifference: declaredAmount - expectedAmount,
          cashierNote: note,
          status: "submitted",
          submitIdempotencyHash: idempotencyHash,
          submitRequestHash: requestHash,
          submittedAt: now,
          submittedBy: input.cashierId,
          updatedAt: now,
          correctionCount: FieldValue.increment(1),
        })
      } else {
        transaction.create(handoverRef, {
          restaurantId: input.restaurantId,
          sessionId: input.sessionId,
          cashierId: input.cashierId,
          expectedAmount,
          declaredAmount,
          declarationDifference: declaredAmount - expectedAmount,
          cashierNote: note,
          status: "submitted",
          workflowVersion: 1,
          submitIdempotencyHash: idempotencyHash,
          submitRequestHash: requestHash,
          submittedAt: now,
          submittedBy: input.cashierId,
          createdAt: now,
          updatedAt: now,
          correctionCount: 0,
        })
      }
      transaction.update(sessionRef, {
        handoverId: handoverRef.id,
        handoverStatus: "submitted",
        handoverSubmittedAt: now,
        updatedAt: now,
      })
      return { id: handoverRef.id, replayed: false, status: "submitted" }
    })
  }

  async review(input: {
    restaurantId: string
    handoverId: string
    managerId: string
    managerRole: string
    decision: Exclude<CashHandoverStatus, "submitted">
    receivedAmount?: number
    note?: string | null
    idempotencyKey: string
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const handoverRef = root.collection("cashHandovers").doc(input.handoverId)
      const handoverSnapshot = await transaction.get(handoverRef)
      if (!handoverSnapshot.exists) {
        throw new FinancialLedgerError("CASH_HANDOVER_NOT_FOUND", "Remise de caisse introuvable.")
      }
      const handover = handoverSnapshot.data() || {}
      const sessionRef = root.collection("cashSessions").doc(String(handover.sessionId))
      const cashMovementRef = root.collection("cashMovements").doc(`handover-${input.handoverId}-cash`)
      const mobileMovementRef = root.collection("cashMovements").doc(`handover-${input.handoverId}-mobile`)
      const legacyMovementRef = root.collection("cashMovements").doc(`session-${handover.sessionId}`)
      const legacyCashMovementRef = root.collection("cashMovements").doc(`session-${handover.sessionId}-cash`)
      const legacyMobileMovementRef = root.collection("cashMovements").doc(`session-${handover.sessionId}-mobile`)
      const cashAccountRef = root.collection("treasuryAccounts").doc("cash")
      const mobileAccountRef = root.collection("treasuryAccounts").doc("mobile_money")
      const [
        sessionSnapshot,
        cashMovementSnapshot,
        mobileMovementSnapshot,
        legacyMovementSnapshot,
        legacyCashMovementSnapshot,
        legacyMobileMovementSnapshot,
        cashAccountSnapshot,
        mobileAccountSnapshot,
      ] =
        await Promise.all([
          transaction.get(sessionRef),
          transaction.get(cashMovementRef),
          transaction.get(mobileMovementRef),
          transaction.get(legacyMovementRef),
          transaction.get(legacyCashMovementRef),
          transaction.get(legacyMobileMovementRef),
          transaction.get(cashAccountRef),
          transaction.get(mobileAccountRef),
        ])
      if (!sessionSnapshot.exists) {
        throw new FinancialLedgerError("CASH_SESSION_NOT_FOUND", "Session caisse introuvable.")
      }
      const receivedAmount =
        input.decision === "validated"
          ? normalizeHandoverAmount(input.receivedAmount, "receivedAmount")
          : null
      const note = cleanHandoverNote(
        input.note,
        input.decision === "correction_required" || input.decision === "rejected"
      )
      const requestHash = hash(JSON.stringify({ decision: input.decision, receivedAmount, note }))
      const idempotencyHash = hash(input.idempotencyKey)
      if (
        handover.reviewIdempotencyHash === idempotencyHash &&
        handover.reviewRequestHash === requestHash
      ) {
        return { id: input.handoverId, replayed: true, status: handover.status }
      }
      if (handover.status === "validated" || handover.status === "rejected") {
        throw new CashHandoverValidationError(
          "HANDOVER_ALREADY_FINAL",
          "Cette remise possède déjà une décision finale."
        )
      }
      if (!["submitted", "under_review"].includes(String(handover.status))) {
        throw new CashHandoverValidationError(
          "HANDOVER_REVIEW_NOT_ALLOWED",
          "Cette remise n'est pas disponible pour validation."
        )
      }

      const session = sessionSnapshot.data() || {}
      const now = Timestamp.now()
      if (
        input.decision === "validated" &&
        (
          session.treasuryPosted === true ||
          session.validatedByManager === true ||
          legacyMovementSnapshot.exists ||
          legacyCashMovementSnapshot.exists ||
          legacyMobileMovementSnapshot.exists
        ) &&
        handover.status !== "validated"
      ) {
        throw new CashHandoverValidationError(
          "SESSION_TREASURY_ALREADY_POSTED",
          "Cette session a déjà été publiée en trésorerie par un parcours antérieur."
        )
      }
      const update: Record<string, unknown> = {
        status: input.decision,
        managerId: input.managerId,
        managerRole: input.managerRole,
        managerNote: note,
        reviewIdempotencyHash: idempotencyHash,
        reviewRequestHash: requestHash,
        reviewedAt: now,
        updatedAt: now,
        statusHistory: FieldValue.arrayUnion({
          status: input.decision,
          at: now,
          actorId: input.managerId,
        }),
      }
      if (input.decision === "validated") {
        const declaredAmount = normalizeHandoverAmount(handover.declaredAmount, "declaredAmount")
        const mobileAmount = normalizeHandoverAmount(
          session.expectedMobileMoney ?? session.totalMobileMoney ?? session.totalMobile ?? 0,
          "expectedMobileMoney"
        )
        update.receivedAmount = receivedAmount
        update.receiptDifference = Number(receivedAmount) - declaredAmount
        update.validatedAt = now
        update.validatedBy = input.managerId
        const movementIds: string[] = []
        if (Number(receivedAmount) > 0 && !cashMovementSnapshot.exists) {
          transaction.create(cashMovementRef, movement(input, handover, "cash", Number(receivedAmount), now))
          creditAccount(transaction, cashAccountRef, cashAccountSnapshot.data(), "cash", Number(receivedAmount), now)
          movementIds.push(cashMovementRef.id)
        }
        if (mobileAmount > 0 && !mobileMovementSnapshot.exists) {
          transaction.create(mobileMovementRef, movement(input, handover, "mobile_money", mobileAmount, now))
          creditAccount(transaction, mobileAccountRef, mobileAccountSnapshot.data(), "mobile_money", mobileAmount, now)
          movementIds.push(mobileMovementRef.id)
        }
        update.cashMovementIds = [
          ...(cashMovementSnapshot.exists ? [cashMovementRef.id] : []),
          ...(mobileMovementSnapshot.exists ? [mobileMovementRef.id] : []),
          ...movementIds,
        ]
        transaction.update(sessionRef, {
          status: "validated",
          validatedByManager: true,
          validatedBy: input.managerId,
          validatedAt: now,
          handoverStatus: "validated",
          handoverReceivedAmount: receivedAmount,
          handoverReceiptDifference: Number(receivedAmount) - declaredAmount,
          treasuryPosted: true,
          treasuryPostedAt: now,
          treasuryPostedBy: input.managerId,
          cashMovementIds: update.cashMovementIds,
          updatedAt: now,
        })
      } else {
        transaction.update(sessionRef, {
          handoverStatus: input.decision,
          updatedAt: now,
        })
      }
      transaction.update(handoverRef, update)
      return { id: input.handoverId, replayed: false, status: input.decision }
    })
  }
}

function assertSessionOwner(session: DocumentData, cashierId: string) {
  const owners = [session.cashierId, session.userId, session.staffId].filter(Boolean).map(String)
  if (!owners.includes(cashierId)) {
    throw new FinancialLedgerError(
      "CASH_SESSION_OWNERSHIP_MISMATCH",
      "La session de caisse n'appartient pas au caissier actif."
    )
  }
}

function movement(
  input: { restaurantId: string; handoverId: string; managerId: string; managerRole: string },
  handover: DocumentData,
  accountId: "cash" | "mobile_money",
  amount: number,
  now: Timestamp
) {
  return {
    restaurantId: input.restaurantId,
    type: "deposit",
    source: "cash_handover",
    direction: "in",
    amount,
    accountId,
    paymentMethod: accountId,
    paymentProvider: accountId,
    sessionId: handover.sessionId,
    sourceSessionId: handover.sessionId,
    handoverId: input.handoverId,
    label: accountId === "cash" ? "Remise physique de caisse validée" : "Mobile Money de session validé",
    createdBy: input.managerId,
    createdByRole: input.managerRole,
    createdAt: now,
    occurredAt: now,
  }
}

function creditAccount(
  transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  existing: DocumentData | undefined,
  kind: "cash" | "mobile_money",
  amount: number,
  now: Timestamp
) {
  if (existing) {
    transaction.update(ref, { balance: FieldValue.increment(amount), updatedAt: now })
  } else {
    transaction.create(ref, {
      id: kind,
      name: kind === "cash" ? "Cash physique" : "Mobile Money",
      kind,
      provider: kind,
      balance: amount,
      currency: "FCFA",
      active: true,
      createdAt: now,
      updatedAt: now,
    })
  }
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export { CashHandoverValidationError }
