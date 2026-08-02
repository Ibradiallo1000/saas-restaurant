import { createHash } from "node:crypto"

import type {
  DocumentData,
  Firestore,
  Transaction,
} from "firebase-admin/firestore"
import { FieldValue, Timestamp } from "firebase-admin/firestore"

import {
  aggregateFinancialEntries,
  diffFinancialCache,
  financialCachePatch,
  type FinancialLedgerEntry,
  type FinancialPaymentMethod,
  type FinancialPaymentSource,
} from "../../lib/finance/payment-ledger-domain.ts"

export class FinancialLedgerError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export interface ConfirmedPaymentWrite {
  restaurantId: string
  paymentId: string
  orderId: string
  sessionId: string
  cashierId: string
  source: FinancialPaymentSource
  type: FinancialPaymentMethod
  provider: string | null
  paymentAccountId?: string | null
  amount: number
  receivedAmount: number
  changeDue: number
  externalReference: string | null
  idempotencyKey: string
}

export class FirestorePaymentLedger {
  private readonly db: Firestore

  constructor(db: Firestore) {
    this.db = db
  }

  async createConfirmedPaymentInTransaction(
    transaction: Transaction,
    input: ConfirmedPaymentWrite
  ) {
    const root = this.db.collection("restaurants").doc(input.restaurantId)
    const sessionRef = root.collection("cashSessions").doc(input.sessionId)
    const paymentRef = root.collection("payments").doc(input.paymentId)
    const ledgerQuery = root.collection("payments").where("sessionId", "==", input.sessionId)
    const accountResolution = await resolvePaymentAccount(transaction, this.db, root, input)
    const [sessionSnapshot, paymentSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(paymentRef),
      transaction.get(ledgerQuery),
    ])
    const session = sessionSnapshot.data()
    assertActiveCashierSession(sessionSnapshot.exists ? session ?? null : null, input.cashierId)

    if (paymentSnapshot.exists) {
      const existing = paymentSnapshot.data()
      if (
        existing?.status === "confirmed" &&
        existing?.idempotencyKey === input.idempotencyKey &&
        existing?.orderId === input.orderId &&
        Number(existing?.amount) === input.amount &&
        existing?.sessionId === input.sessionId &&
            existing?.cashierId === input.cashierId &&
            existing?.type === input.type &&
            (
              !existing?.paymentAccountId ||
              String(existing?.paymentAccountId || "") === String(accountResolution.accountId || "")
            )
      ) {
        const aggregate = aggregateFinancialEntries(ledgerSnapshot.docs.map(toEntry))
        const now = Timestamp.now()
        transaction.update(sessionRef, {
          ...financialCachePatch(aggregate),
          financialCacheVersion: 1,
          financialCacheUpdatedAt: now,
          financialCacheReconciledAt: now,
          financialCacheReconciledBy: input.cashierId,
          updatedAt: now,
        })
        return { id: paymentRef.id, replayed: true }
      }
      throw new FinancialLedgerError(
        "PAYMENT_IDEMPOTENCY_CONFLICT",
        "La clé de paiement existe avec un contenu différent."
      )
    }

    const now = Timestamp.now()
      const payment: FinancialLedgerEntry & Record<string, unknown> = {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      sessionId: input.sessionId,
      cashierId: input.cashierId,
      posStationId: String(session?.posStationId || "DEFAULT"),
      posStationName: String(session?.posStationName || "Caisse principale"),
      posStationCode: String(session?.posStationCode || "DEFAULT"),
      source: input.source,
      type: input.type,
      provider: input.provider,
      paymentAccountId: accountResolution.accountId,
      paymentAccountName: accountResolution.accountName,
      amount: input.amount,
      status: "confirmed",
      entryType: "payment",
      parentPaymentId: null,
      idempotencyKey: input.idempotencyKey,
      receivedAmount: input.receivedAmount,
      changeDue: input.changeDue,
      externalReference: input.externalReference,
      confirmedAt: now,
      confirmedBy: input.cashierId,
      createdAt: now,
      updatedAt: now,
      ledgerVersion: 1,
    }
    const aggregate = aggregateFinancialEntries([
      ...ledgerSnapshot.docs.map(toEntry),
      { id: paymentRef.id, ...payment },
    ])

    transaction.create(paymentRef, payment)
    applyTreasuryAccountMovement(transaction, {
      root,
      account: accountResolution,
      payment: { id: paymentRef.id, ...payment },
      movementId: `payment-${paymentRef.id}`,
      direction: "in",
      amount: input.amount,
      now,
      actorId: input.cashierId,
      label: "Encaissement confirmé",
    })
    transaction.update(sessionRef, {
      ...financialCachePatch(aggregate),
      financialCacheVersion: 1,
      financialCacheUpdatedAt: now,
      updatedAt: now,
    })
    return { id: paymentRef.id, replayed: false }
  }

  async refundPayment(input: {
    restaurantId: string
    paymentId: string
    cashierId: string
    amount: number
    reason: string
    idempotencyKey: string
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const paymentRef = root.collection("payments").doc(input.paymentId)
      const refundId = stableEntryId("refund", input.idempotencyKey)
      const refundRef = root.collection("payments").doc(refundId)
      const [paymentSnapshot, refundSnapshot] = await Promise.all([
        transaction.get(paymentRef),
        transaction.get(refundRef),
      ])
      if (!paymentSnapshot.exists) {
        throw new FinancialLedgerError("PAYMENT_NOT_FOUND", "Paiement introuvable.")
      }
      const payment = toEntry(paymentSnapshot)
      if (payment.entryType === "refund" || payment.status !== "confirmed") {
        throw new FinancialLedgerError(
          "PAYMENT_NOT_REFUNDABLE",
          "Seul un encaissement confirmé peut être remboursé."
        )
      }
      const sessionRef = root.collection("cashSessions").doc(payment.sessionId)
      const orderRef = root.collection("orders").doc(payment.orderId)
      const ledgerQuery = root.collection("payments").where("sessionId", "==", payment.sessionId)
      const accountResolution = await resolveRefundAccount(transaction, root, payment)
      const [sessionSnapshot, ledgerSnapshot, orderSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(ledgerQuery),
        transaction.get(orderRef),
      ])
      assertSessionCashier(
        sessionSnapshot.exists ? sessionSnapshot.data() ?? null : null,
        input.cashierId
      )

      if (refundSnapshot.exists) {
        const existing = toEntry(refundSnapshot)
        if (
          existing.entryType === "refund" &&
          existing.parentPaymentId === input.paymentId &&
          Number(existing.amount) === normalizeAmount(input.amount)
        ) {
          return { id: refundId, replayed: true }
        }
        throw new FinancialLedgerError(
          "PAYMENT_IDEMPOTENCY_CONFLICT",
          "La clé de remboursement existe avec un contenu différent."
        )
      }

      const priorRefunds = ledgerSnapshot.docs
        .map(toEntry)
        .filter(
          (entry) =>
            entry.entryType === "refund" &&
            entry.parentPaymentId === input.paymentId &&
            entry.status === "confirmed"
        )
        .reduce((total, entry) => total + Number(entry.amount), 0)
      const amount = normalizeAmount(input.amount)
      if (priorRefunds + amount > Number(payment.amount)) {
        throw new FinancialLedgerError(
          "REFUND_AMOUNT_EXCEEDS_PAYMENT",
          "Le remboursement dépasse le montant encaissé."
        )
      }
      const reason = input.reason.trim()
      if (!reason) {
        throw new FinancialLedgerError("REFUND_REASON_REQUIRED", "Le motif est obligatoire.")
      }

      const now = Timestamp.now()
      const refund: FinancialLedgerEntry & Record<string, unknown> = {
        restaurantId: input.restaurantId,
        orderId: payment.orderId,
        sessionId: payment.sessionId,
        cashierId: input.cashierId,
        posStationId: String((payment as any).posStationId || sessionSnapshot.data()?.posStationId || "DEFAULT"),
        posStationName: String((payment as any).posStationName || sessionSnapshot.data()?.posStationName || "Caisse principale"),
        posStationCode: String((payment as any).posStationCode || sessionSnapshot.data()?.posStationCode || "DEFAULT"),
        source: payment.source,
        type: payment.type,
        provider: payment.provider ?? null,
        paymentAccountId: accountResolution.accountId,
        paymentAccountName: accountResolution.accountName,
        amount,
        status: "confirmed",
        entryType: "refund",
        parentPaymentId: input.paymentId,
        idempotencyKey: input.idempotencyKey,
        reason: reason.slice(0, 300),
        confirmedAt: now,
        confirmedBy: input.cashierId,
        createdAt: now,
        updatedAt: now,
        ledgerVersion: 1,
      }
      const aggregate = aggregateFinancialEntries([
        ...ledgerSnapshot.docs.map(toEntry),
        { id: refundId, ...refund },
      ])

      transaction.create(refundRef, refund)
      applyTreasuryAccountMovement(transaction, {
        root,
        account: accountResolution,
        payment: { id: refundRef.id, ...refund },
        movementId: `refund-${refundRef.id}`,
        direction: "out",
        amount,
        now,
        actorId: input.cashierId,
        label: "Remboursement confirmé",
      })
      transaction.update(sessionRef, {
        ...financialCachePatch(aggregate),
        financialCacheVersion: 1,
        financialCacheUpdatedAt: now,
        updatedAt: now,
      })
      if (orderSnapshot.exists) {
        const nextRefundTotal = priorRefunds + amount
        const fullyRefunded = nextRefundTotal === Number(payment.amount)
        transaction.update(orderRef, {
          refunded: true,
          refundStatus: fullyRefunded ? "refunded" : "partially_refunded",
          refundTotal: nextRefundTotal,
          paymentStatus: fullyRefunded ? "refunded" : orderSnapshot.data()?.paymentStatus ?? "paid",
          refundedAt: now,
          updatedAt: now,
        })
      }
      return { id: refundId, replayed: false }
    })
  }

  async voidPayment(input: {
    restaurantId: string
    paymentId: string
    cashierId: string
    reason: string
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const paymentRef = root.collection("payments").doc(input.paymentId)
      const paymentSnapshot = await transaction.get(paymentRef)
      if (!paymentSnapshot.exists) {
        throw new FinancialLedgerError("PAYMENT_NOT_FOUND", "Paiement introuvable.")
      }
      const payment = toEntry(paymentSnapshot)
      const sessionRef = root.collection("cashSessions").doc(payment.sessionId)
      const orderRef = root.collection("orders").doc(payment.orderId)
      const [sessionSnapshot, orderSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(orderRef),
      ])
      assertSessionCashier(
        sessionSnapshot.exists ? sessionSnapshot.data() ?? null : null,
        input.cashierId
      )
      if (payment.status === "voided") return { id: input.paymentId, replayed: true }
      if (payment.status === "confirmed") {
        throw new FinancialLedgerError(
          "REFUND_REQUIRED_AFTER_CONFIRMATION",
          "Un paiement confirmé doit être remboursé, pas annulé."
        )
      }
      if (payment.status !== "pending") {
        throw new FinancialLedgerError(
          "PAYMENT_NOT_VOIDABLE",
          "Ce paiement ne peut pas être annulé."
        )
      }
      const reason = input.reason.trim()
      if (!reason) {
        throw new FinancialLedgerError("VOID_REASON_REQUIRED", "Le motif est obligatoire.")
      }
      const now = Timestamp.now()
      transaction.update(paymentRef, {
        status: "voided",
        voidedAt: now,
        voidedBy: input.cashierId,
        voidReason: reason.slice(0, 300),
        updatedAt: now,
      })
      if (orderSnapshot.exists) {
        transaction.update(orderRef, {
          paymentStatus: "unpaid",
          paymentIntentStatus: "voided",
          paymentVoidReason: reason.slice(0, 300),
          updatedAt: now,
        })
      }
      return { id: input.paymentId, replayed: false }
    })
  }

  async reconcileSession(input: {
    restaurantId: string
    sessionId: string
    actorId: string
    repair?: boolean
  }) {
    return this.db.runTransaction(async (transaction) => {
      const root = this.db.collection("restaurants").doc(input.restaurantId)
      const sessionRef = root.collection("cashSessions").doc(input.sessionId)
      const ledgerQuery = root.collection("payments").where("sessionId", "==", input.sessionId)
      const [sessionSnapshot, ledgerSnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(ledgerQuery),
      ])
      if (!sessionSnapshot.exists) {
        throw new FinancialLedgerError("SESSION_NOT_FOUND", "Session caisse introuvable.")
      }
      const aggregate = aggregateFinancialEntries(ledgerSnapshot.docs.map(toEntry))
      const differences = diffFinancialCache(sessionSnapshot.data() || {}, aggregate)
      if (input.repair && Object.keys(differences).length > 0) {
        transaction.update(sessionRef, {
          ...financialCachePatch(aggregate),
          financialCacheVersion: 1,
          financialCacheUpdatedAt: Timestamp.now(),
          financialCacheReconciledAt: Timestamp.now(),
          financialCacheReconciledBy: input.actorId,
          updatedAt: Timestamp.now(),
        })
      }
      return {
        ok: Object.keys(differences).length === 0,
        repaired: Boolean(input.repair && Object.keys(differences).length > 0),
        aggregate,
        differences,
      }
    })
  }
}

export function resolveFinancialSource(order: Record<string, unknown>): FinancialPaymentSource {
  const type = String(order.serviceMode || order.orderType || order.type || "").toLowerCase()
  const source = String(order.source || "").toLowerCase()
  if (type === "delivery") return "delivery"
  if (type === "table" || type === "dine_in" || source === "qr" || source === "client") {
    return "qr_table"
  }
  if (source === "pos") return "pos"
  return "legacy"
}

function assertActiveCashierSession(session: DocumentData | null, cashierId: string) {
  if (!session || session.status !== "open") {
    throw new FinancialLedgerError("CASH_SESSION_NOT_OPEN", "La session de caisse n'est pas ouverte.")
  }
  assertSessionCashier(session, cashierId)
}

function assertSessionCashier(session: DocumentData | null, cashierId: string) {
  if (!session) {
    throw new FinancialLedgerError("CASH_SESSION_NOT_FOUND", "Session caisse introuvable.")
  }
  const owners = [session.cashierId, session.userId, session.staffId]
    .filter(Boolean)
    .map(String)
  if (!owners.includes(cashierId)) {
    throw new FinancialLedgerError(
      "CASH_SESSION_OWNERSHIP_MISMATCH",
      "La session de caisse n'appartient pas au caissier actif."
    )
  }
}

function toEntry(snapshot: { id: string; data(): DocumentData | undefined }): FinancialLedgerEntry {
  return {
    id: snapshot.id,
    ...(snapshot.data() || {}),
  } as unknown as FinancialLedgerEntry
}

type PaymentAccountResolution = {
  accountId: string | null
  accountName: string | null
  accountRef: FirebaseFirestore.DocumentReference | null
  accountData: DocumentData | null
}

async function resolvePaymentAccount(
  transaction: Transaction,
  db: Firestore,
  root: FirebaseFirestore.DocumentReference,
  input: ConfirmedPaymentWrite
): Promise<PaymentAccountResolution> {
  if (input.type === "cash") return emptyPaymentAccountResolution()

  const provider = String(input.provider || "").trim()
  const explicitAccountId = cleanSafeId(input.paymentAccountId)
  let accountId = explicitAccountId

  if (!accountId && provider) {
    const configSnapshot = await transaction.get(
      db.collection("restaurantPaymentConfigs")
        .where("restaurantId", "==", input.restaurantId)
        .where("methodCode", "==", provider)
        .where("isActive", "==", true)
        .limit(1)
    )
    const config = configSnapshot.docs[0]?.data()
    accountId = cleanSafeId(config?.paymentAccountId)
  }

  if (!accountId) return emptyPaymentAccountResolution()
  return readPaymentAccount(transaction, root, accountId)
}

async function resolveRefundAccount(
  transaction: Transaction,
  root: FirebaseFirestore.DocumentReference,
  payment: FinancialLedgerEntry
): Promise<PaymentAccountResolution> {
  const accountId = cleanSafeId(payment.paymentAccountId)
  if (!accountId) return emptyPaymentAccountResolution()
  return readPaymentAccount(transaction, root, accountId)
}

async function readPaymentAccount(
  transaction: Transaction,
  root: FirebaseFirestore.DocumentReference,
  accountId: string
): Promise<PaymentAccountResolution> {
  const accountRef = root.collection("treasuryAccounts").doc(accountId)
  const accountSnapshot = await transaction.get(accountRef)
  if (!accountSnapshot.exists) {
    throw new FinancialLedgerError(
      "PAYMENT_ACCOUNT_NOT_FOUND",
      "Le compte financier rattaché au paiement est introuvable."
    )
  }
  const accountData = accountSnapshot.data() || {}
  if (accountData.active === false) {
    throw new FinancialLedgerError(
      "PAYMENT_ACCOUNT_INACTIVE",
      "Le compte financier rattaché au paiement est inactif."
    )
  }
  return {
    accountId,
    accountName: typeof accountData.name === "string" ? accountData.name : accountId,
    accountRef,
    accountData,
  }
}

function applyTreasuryAccountMovement(
  transaction: Transaction,
  input: {
    root: FirebaseFirestore.DocumentReference
    account: PaymentAccountResolution
    payment: FinancialLedgerEntry & Record<string, unknown>
    movementId: string
    direction: "in" | "out"
    amount: number
    now: Timestamp
    actorId: string
    label: string
  }
) {
  if (!input.account.accountRef || !input.account.accountId) return
  const signedAmount = input.direction === "in" ? input.amount : -input.amount
  transaction.update(input.account.accountRef, {
    balance: FieldValue.increment(signedAmount),
    updatedAt: input.now,
    updatedBy: input.actorId,
  })
  transaction.create(input.root.collection("cashMovements").doc(input.movementId), {
    restaurantId: input.payment.restaurantId,
    type: input.direction === "in" ? "deposit" : "expense",
    source: input.payment.entryType === "refund" ? "payment_refund" : "payment",
    direction: input.direction,
    amount: input.amount,
    accountId: input.account.accountId,
    accountName: input.account.accountName,
    paymentMethod: input.payment.type,
    paymentProvider: input.payment.provider ?? input.account.accountId,
    paymentId: input.payment.id,
    parentPaymentId: input.payment.parentPaymentId ?? null,
    orderId: input.payment.orderId,
    sessionId: input.payment.sessionId,
    sourceSessionId: input.payment.sessionId,
    cashierId: input.payment.cashierId,
    posStationId: input.payment.posStationId ?? "DEFAULT",
    posStationName: input.payment.posStationName ?? "Caisse principale",
    posStationCode: input.payment.posStationCode ?? "DEFAULT",
    label: input.label,
    createdBy: input.actorId,
    createdAt: input.now,
    occurredAt: input.now,
  })
}

function emptyPaymentAccountResolution(): PaymentAccountResolution {
  return {
    accountId: null,
    accountName: null,
    accountRef: null,
    accountData: null,
  }
}

function cleanSafeId(value: unknown) {
  if (typeof value !== "string") return null
  const id = value.trim()
  return /^[A-Za-z0-9_-]{1,160}$/.test(id) ? id : null
}

function stableEntryId(prefix: string, key: string) {
  return `${prefix}-${createHash("sha256").update(key).digest("hex").slice(0, 40)}`
}

function normalizeAmount(value: unknown) {
  const amount = Math.round(Number(value))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new FinancialLedgerError("INVALID_PAYMENT_AMOUNT", "Montant invalide.")
  }
  return amount
}
