import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
  type Transaction,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export type PaymentSource = "pos" | "qr_table" | "delivery"
export type PaymentType = "cash" | "mobile_money"
export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded" | "voided"

const MAX_PAYMENT_AMOUNT = 10_000_000

export type PaymentLedgerInput = {
  restaurantId: string
  orderId: string
  sessionId: string
  cashierId: string
  source: PaymentSource
  type: PaymentType
  provider: string | null
  amount: number
  status?: PaymentStatus
  idempotencyKey: string
  retryOfPaymentId?: string | null
  failureReason?: string | null
  orderUpdate?: Record<string, any>
}

export type SessionPaymentAggregate = {
  totalCash: number
  totalMobile: number
  totalMobileMoney: number
  totalConfirmed: number
  totalPayments: number
  totalOrders: number
  totalsByProvider: Record<string, number>
  totalsBySource: Record<PaymentSource, number>
  statusCounts: Record<PaymentStatus, number>
}

type CreatePaymentResult = {
  id: string
  existed: boolean
  data: Record<string, any>
}

export class PaymentLedgerService {
  constructor(private db: Firestore) {}

  async createPayment(input: PaymentLedgerInput): Promise<CreatePaymentResult> {
    return runTransaction(this.db, async (transaction) => {
      return this.createPaymentInTransaction(transaction, input)
    })
  }

  async confirmPayment(input: {
    restaurantId: string
    idempotencyKey: string
    cashierId: string
    orderUpdate?: Record<string, any>
  }): Promise<CreatePaymentResult> {
    return runTransaction(this.db, async (transaction) => {
      return this.confirmPaymentInTransaction(transaction, input)
    })
  }

  async failPayment(input: {
    restaurantId: string
    idempotencyKey: string
    cashierId: string
    reason: string
  }): Promise<CreatePaymentResult> {
    return runTransaction(this.db, async (transaction) => {
      return this.failPaymentInTransaction(transaction, input)
    })
  }

  async aggregateSessionPayments(restaurantId: string, sessionId: string): Promise<SessionPaymentAggregate> {
    if (!restaurantId || !sessionId) {
      throw new Error("Session de paiement obligatoire.")
    }

    const snapshot = await getDocs(
      query(
        collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PAYMENTS),
        where("sessionId", "==", sessionId),
        where("status", "==", "confirmed"),
        limit(1000)
      )
    )
    const payments = snapshot.docs.map((paymentDoc) => ({
      id: paymentDoc.id,
      ...paymentDoc.data(),
    }))

    console.log("[payment-ledger] aggregateSessionPayments context", { restaurantId, sessionId })
    console.log("[payment-ledger] aggregateSessionPayments payments", payments)

    return aggregatePaymentDocs(payments)
  }

  async snapshotSessionClose(input: {
    restaurantId: string
    sessionId: string
    closedBy: string
    closingBalance?: number
    declaredCash?: number
    declaredMobileMoney?: number
  }): Promise<SessionPaymentAggregate> {
    const { restaurantId, sessionId, closedBy, closingBalance } = input
    if (!restaurantId || !sessionId || !closedBy) {
      throw new Error("Session et caissier obligatoires pour la cloture.")
    }

    const aggregate = await this.aggregateSessionPayments(restaurantId, sessionId)
    const declaredCash = normalizeDeclaredAmount(input.declaredCash ?? null)
    const declaredMobileMoney = normalizeDeclaredAmount(input.declaredMobileMoney ?? null)
    const declaredTotal =
      declaredCash !== null || declaredMobileMoney !== null
        ? Number(declaredCash ?? 0) + Number(declaredMobileMoney ?? 0)
        : Math.round(Number(closingBalance ?? aggregate.totalConfirmed ?? 0))
    const cashDifference = Number(declaredCash ?? aggregate.totalCash) - aggregate.totalCash
    const mobileMoneyDifference =
      Number(declaredMobileMoney ?? aggregate.totalMobileMoney) - aggregate.totalMobileMoney
    const totalDifference = declaredTotal - aggregate.totalConfirmed
    const sessionRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, sessionId)

    await runTransaction(this.db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef)
      if (!sessionSnap.exists()) {
        throw new Error("Session caisse introuvable.")
      }

      const session = sessionSnap.data()
      if (session.status !== "open") {
        throw new Error("Seule une session ouverte peut etre cloturee.")
      }

      transaction.update(sessionRef, {
        ...aggregate,
        totalCalculated: aggregate.totalConfirmed,
        closingCash: declaredCash ?? aggregate.totalCash,
        closingMobileMoney: declaredMobileMoney ?? aggregate.totalMobileMoney,
        closingBalance: declaredTotal,
        declaredCash: declaredCash ?? aggregate.totalCash,
        declaredMobileMoney: declaredMobileMoney ?? aggregate.totalMobileMoney,
        declaredTotal,
        cashDifference,
        mobileMoneyDifference,
        discrepancyAmount: totalDifference,
        discrepancyStatus: totalDifference === 0 && cashDifference === 0 && mobileMoneyDifference === 0 ? "balanced" : "pending_review",
        closeSnapshot: {
          ...aggregate,
          declaredTotals: {
            cash: declaredCash ?? aggregate.totalCash,
            mobileMoney: declaredMobileMoney ?? aggregate.totalMobileMoney,
            total: declaredTotal,
          },
          systemTotals: {
            cash: aggregate.totalCash,
            mobileMoney: aggregate.totalMobileMoney,
            total: aggregate.totalConfirmed,
          },
          diff: {
            cash: cashDifference,
            mobileMoney: mobileMoneyDifference,
            total: totalDifference,
          },
          declaredCash: declaredCash ?? aggregate.totalCash,
          declaredMobileMoney: declaredMobileMoney ?? aggregate.totalMobileMoney,
          declaredTotal,
          systemCash: aggregate.totalCash,
          systemMobileMoney: aggregate.totalMobileMoney,
          systemTotal: aggregate.totalConfirmed,
          totalCalculated: aggregate.totalConfirmed,
          cashDifference,
          mobileMoneyDifference,
          totalDifference,
          discrepancyStatus: totalDifference === 0 && cashDifference === 0 && mobileMoneyDifference === 0 ? "balanced" : "pending_review",
          closedBy,
          createdAt: new Date().toISOString(),
        },
        closedAt: serverTimestamp(),
        status: "closed",
        updatedAt: serverTimestamp(),
      })
    })

    return aggregate
  }

  async createPaymentInTransaction(
    transaction: Transaction,
    input: PaymentLedgerInput
  ): Promise<CreatePaymentResult> {
    validatePaymentInput(input)

    const paymentId = normalizeIdempotencyKey(input.idempotencyKey)
    const sessionRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.CASH_SESSIONS, input.sessionId)
    const orderRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.ORDERS, input.orderId)
    const paymentRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.PAYMENTS, paymentId)

    const [sessionSnap, paymentSnap, orderSnap] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(paymentRef),
      transaction.get(orderRef),
    ])

    assertOpenSession(sessionSnap.exists() ? sessionSnap.data() : null, input.sessionId)
    assertOrderAmountMatches(orderSnap.exists() ? orderSnap.data() : null, input.amount)

    if (paymentSnap.exists()) {
      const existing = paymentSnap.data() as Record<string, any>
      if (existing.status === "confirmed") {
        return {
          id: paymentSnap.id,
          existed: true,
          data: existing,
        }
      }

      if (input.status === "confirmed" && existing.status === "pending") {
        assertOrderAmountMatches(orderSnap.exists() ? orderSnap.data() : null, Number(existing.amount || 0))
        const confirmedPayment = Object.assign({}, existing, {
          status: "confirmed" as PaymentStatus,
          cashierId: input.cashierId,
          confirmedBy: input.cashierId,
        }) as unknown as {
          type: PaymentType
          provider: string | null
          amount: number
          status: PaymentStatus
          source: PaymentSource
        }

        transaction.update(paymentRef, {
          status: "confirmed",
          confirmedAt: serverTimestamp(),
          confirmedBy: input.cashierId,
        })
        if (input.orderUpdate) {
          transaction.update(orderRef, input.orderUpdate)
        }
        applySessionAggregateCache(transaction, sessionRef, confirmedPayment)

        return {
          id: paymentSnap.id,
          existed: true,
          data: confirmedPayment,
        }
      }

      return {
        id: paymentSnap.id,
        existed: true,
        data: existing,
      }
    }

    const payment = {
      orderId: input.orderId,
      sessionId: input.sessionId,
      cashierId: input.cashierId,
      source: input.source,
      type: input.type,
      provider: input.type === "mobile_money" ? normalizeProvider(input.provider) : null,
      amount: normalizeAmount(input.amount),
      status: input.status ?? "pending",
      idempotencyKey: input.idempotencyKey,
      retryOfPaymentId: input.retryOfPaymentId ?? null,
      failureReason: input.status === "failed" ? input.failureReason ?? "payment_failed" : null,
      confirmedAt: input.status === "confirmed" ? serverTimestamp() : null,
      confirmedBy: input.status === "confirmed" ? input.cashierId : null,
      failedAt: input.status === "failed" ? serverTimestamp() : null,
      failedBy: input.status === "failed" ? input.cashierId : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    transaction.set(paymentRef, payment)
    if (input.orderUpdate) {
      transaction.update(orderRef, input.orderUpdate)
    }
    applySessionAggregateCache(transaction, sessionRef, payment)

    return {
      id: paymentId,
      existed: false,
      data: payment,
    }
  }

  async confirmPaymentInTransaction(
    transaction: Transaction,
    input: {
      restaurantId: string
      idempotencyKey: string
      cashierId: string
      orderUpdate?: Record<string, any>
    }
  ): Promise<CreatePaymentResult> {
    if (!input.restaurantId || !input.idempotencyKey || !input.cashierId) {
      throw new Error("Paiement invalide.")
    }

    const paymentId = normalizeIdempotencyKey(input.idempotencyKey)
    const paymentRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.PAYMENTS, paymentId)
    const paymentSnap = await transaction.get(paymentRef)

    if (!paymentSnap.exists()) {
      throw new Error("Paiement introuvable.")
    }

    const payment = { id: paymentSnap.id, ...paymentSnap.data() } as any
    const sessionRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.CASH_SESSIONS, payment.sessionId)
    const orderRef = payment.orderId
      ? doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.ORDERS, payment.orderId)
      : null
    const [sessionSnap, orderSnap] = await Promise.all([
      transaction.get(sessionRef),
      orderRef ? transaction.get(orderRef) : Promise.resolve(null),
    ])
    assertOpenSession(sessionSnap.exists() ? sessionSnap.data() : null, payment.sessionId)
    assertOrderAmountMatches(orderSnap?.exists() ? orderSnap.data() : null, Number(payment.amount || 0))

    if (payment.status === "confirmed") {
      return {
        id: paymentSnap.id,
        existed: true,
        data: payment,
      }
    }

    if (payment.status !== "pending") {
      throw new Error("Ce paiement ne peut pas etre confirme.")
    }

    const confirmedPayment = {
      ...payment,
      status: "confirmed" as PaymentStatus,
      cashierId: input.cashierId,
      confirmedBy: input.cashierId,
    }

    transaction.update(paymentRef, {
      status: "confirmed",
      confirmedAt: serverTimestamp(),
      confirmedBy: input.cashierId,
    })

    if (input.orderUpdate && orderRef) {
      transaction.update(orderRef, input.orderUpdate)
    }

    applySessionAggregateCache(transaction, sessionRef, confirmedPayment)

    return {
      id: paymentSnap.id,
      existed: false,
      data: confirmedPayment,
    }
  }

  async failPaymentInTransaction(
    transaction: Transaction,
    input: {
      restaurantId: string
      idempotencyKey: string
      cashierId: string
      reason: string
    }
  ): Promise<CreatePaymentResult> {
    if (!input.restaurantId || !input.idempotencyKey || !input.cashierId || !input.reason.trim()) {
      throw new Error("Echec paiement invalide.")
    }

    const paymentId = normalizeIdempotencyKey(input.idempotencyKey)
    const paymentRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.PAYMENTS, paymentId)
    const paymentSnap = await transaction.get(paymentRef)

    if (!paymentSnap.exists()) {
      throw new Error("Paiement introuvable.")
    }

    const payment = { id: paymentSnap.id, ...paymentSnap.data() } as any
    if (payment.status === "confirmed") {
      throw new Error("Un paiement confirme ne peut pas etre modifie.")
    }
    if (payment.status !== "pending") {
      return {
        id: paymentSnap.id,
        existed: true,
        data: payment,
      }
    }

    const sessionRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, input.restaurantId, COLLECTION_NAMES.CASH_SESSIONS, payment.sessionId)
    const sessionSnap = await transaction.get(sessionRef)
    assertOpenSession(sessionSnap.exists() ? sessionSnap.data() : null, payment.sessionId)

    transaction.update(paymentRef, {
      status: "failed",
      failedAt: serverTimestamp(),
      failedBy: input.cashierId,
      failureReason: input.reason.trim().slice(0, 300),
    })

    return {
      id: paymentSnap.id,
      existed: false,
      data: {
        ...payment,
        status: "failed",
        failedBy: input.cashierId,
        failureReason: input.reason.trim().slice(0, 300),
      },
    }
  }
}

export function buildPaymentIdempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim().length > 0)
    .map((part) => String(part).trim())
    .join(":")
}

export function normalizePaymentProvider(provider: string | null | undefined) {
  return normalizeProvider(provider)
}

function validatePaymentInput(input: PaymentLedgerInput) {
  if (!input.restaurantId || !input.orderId || !input.sessionId || !input.cashierId || !input.idempotencyKey) {
    throw new Error("Paiement incomplet: session, caissier et idempotence obligatoires.")
  }
  if (!["pos", "qr_table", "delivery"].includes(input.source)) {
    throw new Error("Source de paiement invalide.")
  }
  if (!["cash", "mobile_money"].includes(input.type)) {
    throw new Error("Type de paiement invalide.")
  }
  if (!["pending", "confirmed", "failed", "refunded", "voided"].includes(input.status ?? "pending")) {
    throw new Error("Statut de paiement invalide.")
  }
  normalizeAmount(input.amount)
}

function normalizeAmount(amount: number) {
  const value = Math.round(Number(amount || 0))
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Montant de paiement invalide.")
  }
  if (value > MAX_PAYMENT_AMOUNT) {
    throw new Error("Montant de paiement au-dessus du plafond de securite.")
  }
  return value
}

function normalizeDeclaredAmount(amount: number | null) {
  if (amount === null) return null
  const value = Math.round(Number(amount || 0))
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Montant declare invalide.")
  }
  if (value > MAX_PAYMENT_AMOUNT) {
    throw new Error("Montant declare au-dessus du plafond de securite.")
  }
  return value
}

function assertOrderAmountMatches(order: Record<string, any> | null, paymentAmount: number) {
  if (!order) {
    throw new Error("Commande introuvable pour ce paiement.")
  }

  const expectedAmount = Math.round(Number(order.total ?? order.totalAmount ?? 0))
  const normalizedPaymentAmount = normalizeAmount(paymentAmount)
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    throw new Error("Montant commande invalide.")
  }
  if (expectedAmount !== normalizedPaymentAmount) {
    throw new Error("Le montant du paiement ne correspond pas a la commande.")
  }
}

function normalizeProvider(provider: string | null | undefined) {
  if (!provider) return null
  return String(provider)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
}

function normalizeIdempotencyKey(key: string) {
  const normalized = String(key)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 180)

  if (!normalized) {
    throw new Error("Cle d'idempotence obligatoire.")
  }

  return normalized
}

function assertOpenSession(session: Record<string, any> | null, sessionId: string) {
  if (!session) {
    throw new Error(`Session caisse introuvable: ${sessionId}`)
  }
  if (session.status !== "open") {
    throw new Error("Aucun paiement ne peut etre enregistre sur une session fermee.")
  }
}

function applySessionAggregateCache(
  transaction: Transaction,
  sessionRef: ReturnType<typeof doc>,
  payment: {
    type: PaymentType
    provider: string | null
    amount: number
    status: PaymentStatus
    source: PaymentSource
  }
) {
  if (payment.status !== "confirmed") return

  const provider = payment.provider || "unknown"
  const patch: Record<string, any> = {
    totalCash: payment.type === "cash" ? increment(payment.amount) : increment(0),
    totalMobile: payment.type === "mobile_money" ? increment(payment.amount) : increment(0),
    totalMobileMoney: payment.type === "mobile_money" ? increment(payment.amount) : increment(0),
    totalOrders: increment(1),
    totalPayments: increment(1),
    totalConfirmed: increment(payment.amount),
    [`totalsBySource.${payment.source}`]: increment(payment.amount),
    updatedAt: serverTimestamp(),
  }

  if (payment.type === "mobile_money") {
    patch[`totalsByProvider.${provider}`] = increment(payment.amount)
  }

  transaction.update(sessionRef, patch)
}

function aggregatePaymentDocs(payments: Array<Record<string, any>>): SessionPaymentAggregate {
  const aggregate: SessionPaymentAggregate = {
    totalCash: 0,
    totalMobile: 0,
    totalMobileMoney: 0,
    totalConfirmed: 0,
    totalPayments: 0,
    totalOrders: 0,
    totalsByProvider: {},
    totalsBySource: {
      pos: 0,
      qr_table: 0,
      delivery: 0,
    },
    statusCounts: {
      pending: 0,
      confirmed: 0,
      failed: 0,
      refunded: 0,
      voided: 0,
    },
  }
  const seenIdempotencyKeys = new Set<string>()

  payments.forEach((payment) => {
    const status = payment.status as PaymentStatus
    if (status && aggregate.statusCounts[status] !== undefined) {
      aggregate.statusCounts[status] += 1
    }
    if (status !== "confirmed") return

    if (payment.type !== "cash" && payment.type !== "mobile_money") {
      console.error("[payment-ledger] Invalid confirmed payment type", {
        id: payment.id,
        idempotencyKey: payment.idempotencyKey,
        type: payment.type,
        amount: payment.amount,
      })
      throw new Error(`Type de paiement invalide dans le ledger: ${payment.type || "missing"}`)
    }

    const idempotencyKey = String(payment.idempotencyKey || payment.id || "").trim()
    if (!idempotencyKey) {
      console.error("[payment-ledger] Confirmed payment without idempotencyKey", payment)
      throw new Error("Paiement confirme sans cle d'idempotence.")
    }
    if (seenIdempotencyKeys.has(idempotencyKey)) {
      console.warn("[payment-ledger] Duplicate payment ignored during aggregation", {
        id: payment.id,
        idempotencyKey,
        type: payment.type,
        amount: payment.amount,
      })
      return
    }
    seenIdempotencyKeys.add(idempotencyKey)

    const amount = Number(payment.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error("[payment-ledger] Invalid confirmed payment amount", {
        id: payment.id,
        idempotencyKey,
        type: payment.type,
        amount: payment.amount,
      })
      throw new Error("Montant de paiement confirme invalide.")
    }

    aggregate.totalPayments += 1
    aggregate.totalOrders += 1
    aggregate.totalConfirmed += amount

    const source = payment.source as PaymentSource
    if (source && aggregate.totalsBySource[source] !== undefined) {
      aggregate.totalsBySource[source] += amount
    }

    if (payment.type === "cash") {
      aggregate.totalCash += amount
      return
    }

    if (payment.type === "mobile_money") {
      const provider = payment.provider || "unknown"
      aggregate.totalMobile += amount
      aggregate.totalMobileMoney += amount
      aggregate.totalsByProvider[provider] = (aggregate.totalsByProvider[provider] || 0) + amount
    }
  })

  return aggregate
}
