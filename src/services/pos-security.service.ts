import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  runTransaction,
  type Firestore,
  where,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"
import {
  ORDER_OPERATION_STATUS,
  ORDER_PAYMENT_STATUS,
  getOrderStatus,
  isOrderPaid,
  isOrderServed,
  normalizeOrderType,
} from "@/lib/order-lifecycle"
import { closeActiveTableSession } from "@/services/table-session.service"

import {
  buildPaymentIdempotencyKey,
  normalizePaymentProvider,
  PaymentLedgerService,
  type PaymentSource,
} from "@/services/payment-ledger.service"

type StaffAuditSnapshot = {
  userId: string
  staffId?: string | null
  staffName?: string | null
}

type PaymentInput = {
  db: Firestore
  restaurantId: string
  orderId: string
  method: "cash" | "mobile"
  paymentMethod: string
  paymentCode?: string | null
  cashSessionId?: string | null
  amount: number
  staff: StaffAuditSnapshot
  printedClient?: boolean
}

function resolvePaymentSource(order: any): PaymentSource {
  const normalizedType = normalizeOrderType(order.orderType || order.type)
  if (normalizedType === "delivery" || order.type === "delivery") return "delivery"
  if (order.source === "pos") return "pos"
  if (normalizedType === "dine_in" || order.source === "qr" || order.source === "client") return "qr_table"
  return "pos"
}

type RefundInput = {
  db: Firestore
  restaurantId: string
  orderId: string
  amount: number
  reason: string
  staff: StaffAuditSnapshot
}

type CancelInput = {
  db: Firestore
  restaurantId: string
  orderId: string
  reason?: string
  staff: StaffAuditSnapshot
}

export async function processOrderPaymentTransaction({
  db,
  restaurantId,
  orderId,
  method,
  paymentMethod,
  paymentCode = null,
  cashSessionId = null,
  amount,
  staff,
  printedClient = false,
}: PaymentInput) {
  if (!cashSessionId) {
    throw new Error("Session caisse obligatoire pour encaisser une commande.")
  }

  const orderRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS, orderId)
  const auditRef = doc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "auditLogs"))
  const paymentLedger = new PaymentLedgerService(db)

  const result = await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists()) {
      throw new Error("Commande introuvable.")
    }

    const before = { id: orderSnap.id, ...orderSnap.data() } as any
    if (isOrderPaid(before)) {
      throw new Error("Cette commande est deja payee.")
    }

    const normalizedType = normalizeOrderType(before.orderType || before.type)
    if (
      normalizedType === "dine_in" &&
      before.source !== "pos" &&
      !["pending_verification", "pending_cash"].includes(before.paymentStatus)
    ) {
      throw new Error("Invalid payment validation")
    }

    const paymentStatus = method === "cash" ? "paid" : ORDER_PAYMENT_STATUS.PENDING_MOBILE
    const currentOrderStatus = getOrderStatus(before)
    const closesDineInSession =
      method === "cash" &&
      normalizedType === "dine_in" &&
      currentOrderStatus === ORDER_OPERATION_STATUS.SERVED
    const tableRef =
      closesDineInSession && before.tableId
        ? doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLES, before.tableId)
        : null
    const tableSnap = tableRef ? await transaction.get(tableRef) : null
    const tableSessionId =
      tableSnap?.exists() && tableSnap.data().currentSessionId
        ? tableSnap.data().currentSessionId
        : before.sessionId
    const tableSessionRef =
      closesDineInSession && tableSessionId
        ? doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLE_SESSIONS, tableSessionId)
        : null
    const paymentType = method === "cash" ? "cash" : "mobile_money"
    const paymentProvider = method === "mobile" ? normalizePaymentProvider(paymentMethod) : null
    const idempotencyKey = buildPaymentIdempotencyKey([
      "order-payment",
      restaurantId,
      orderId,
      cashSessionId,
      paymentType,
      paymentProvider,
    ])
    const after = {
      paymentMethod,
      paymentType,
      paymentStatus,
      paymentIntentStatus: method === "cash" ? "verified" : "submitted",
      sessionActive: closesDineInSession ? false : before.sessionActive ?? normalizedType === "dine_in",
      closedAt: closesDineInSession ? serverTimestamp() : before.closedAt ?? null,
      paymentCode,
      cashierId: staff.userId,
      cashSessionId,
      paidAt: method === "cash" ? serverTimestamp() : null,
      printedClient: method === "cash" ? printedClient : before.printedClient ?? false,
      paymentVerificationStatus: method === "mobile" ? "pending_manual_review" : "not_required",
      paymentVerificationRequestedAt: method === "mobile" ? serverTimestamp() : null,
      needsCashCollection: method === "cash" ? false : before.needsCashCollection ?? false,
      updatedAt: serverTimestamp(),
    }

    await paymentLedger.createPaymentInTransaction(transaction, {
      restaurantId,
      orderId,
      sessionId: cashSessionId,
      cashierId: staff.userId,
      source: resolvePaymentSource(before),
      type: paymentType,
      provider: paymentProvider,
      amount,
      status: method === "cash" ? "confirmed" : "pending",
      idempotencyKey,
      orderUpdate: after,
    })
    if (tableRef) {
      transaction.update(tableRef, {
        status: "free",
        currentSessionId: null,
        currentOrderId: null,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      })
    }
    if (tableSessionRef) {
      transaction.update(tableSessionRef, {
        status: "closed",
        closedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      })
    }
    transaction.set(auditRef, {
      userId: staff.userId,
      staffId: staff.staffId ?? staff.userId,
      staffName: staff.staffName ?? null,
      action: method === "cash" ? "order_paid_cash" : "order_mobile_payment_requested",
      orderId,
      before: sanitizeAuditPayload(before),
      after: {
        paymentMethod,
        paymentType,
        paymentStatus,
        paymentIntentStatus: method === "cash" ? "verified" : "submitted",
        orderStatus: currentOrderStatus,
        paymentCode,
        cashierId: staff.userId,
        cashSessionId,
        paymentLedgerId: idempotencyKey,
      },
      createdAt: serverTimestamp(),
    })

    return before
  })


  return result
}

export async function validateMobilePaymentTransaction({
  db,
  restaurantId,
  orderId,
  cashSessionId = null,
  amount,
  staff,
  printedClient = false,
}: Omit<PaymentInput, "method" | "paymentMethod">) {
  if (!cashSessionId) {
    throw new Error("Session caisse obligatoire pour valider un paiement.")
  }

  const orderRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS, orderId)
  const auditRef = doc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "auditLogs"))
  const paymentLedger = new PaymentLedgerService(db)

  const result = await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists()) {
      throw new Error("Commande introuvable.")
    }

    const before = { id: orderSnap.id, ...orderSnap.data() } as any
    if (isOrderPaid(before)) {
      throw new Error("Cette commande est deja payee.")
    }

    const normalizedType = normalizeOrderType(before.orderType || before.type)
    const isPendingMobileMoney =
      (before.paymentStatus === "pending_mobile" || before.paymentStatus === "pending") &&
      before.paymentType === "mobile_money" &&
      before.paymentMethod &&
      before.paymentMethod !== "cash"
    if (
      normalizedType === "dine_in" &&
      before.source !== "pos" &&
      !isPendingMobileMoney &&
      before.paymentStatus !== "pending_verification"
    ) {
      throw new Error("Invalid payment validation")
    }

    const currentOrderStatus = getOrderStatus(before)
    const closesDineInSession =
      normalizedType === "dine_in" && currentOrderStatus === ORDER_OPERATION_STATUS.SERVED
    const tableRef =
      closesDineInSession && before.tableId
        ? doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLES, before.tableId)
        : null
    const tableSnap = tableRef ? await transaction.get(tableRef) : null
    const tableSessionId =
      tableSnap?.exists() && tableSnap.data().currentSessionId
        ? tableSnap.data().currentSessionId
        : before.sessionId
    const tableSessionRef =
      closesDineInSession && tableSessionId
        ? doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLE_SESSIONS, tableSessionId)
        : null

    const paymentProvider = normalizePaymentProvider(before.paymentMethod || "mobile_money")
    const idempotencyKey = buildPaymentIdempotencyKey([
      "order-payment",
      restaurantId,
      orderId,
      cashSessionId,
      "mobile_money",
      paymentProvider,
    ])
    const after = {
      paymentStatus: "paid",
      paymentIntentStatus: "verified",
      sessionActive: closesDineInSession ? false : before.sessionActive ?? normalizedType === "dine_in",
      closedAt: closesDineInSession ? serverTimestamp() : before.closedAt ?? null,
      paymentType: "mobile_money",
      paymentMethod: before.paymentMethod || "mobile_money",
      cashierId: staff.userId,
      cashSessionId,
      paidAt: serverTimestamp(),
      printedClient,
      paymentVerificationStatus: "verified",
      paymentVerifiedAt: serverTimestamp(),
      paymentVerifiedBy: staff.userId,
      updatedAt: serverTimestamp(),
    }

    await paymentLedger.createPaymentInTransaction(transaction, {
      restaurantId,
      orderId,
      sessionId: cashSessionId,
      cashierId: staff.userId,
      source: resolvePaymentSource(before),
      type: "mobile_money",
      provider: paymentProvider,
      amount,
      status: "confirmed",
      idempotencyKey,
      orderUpdate: after,
    })
    if (tableRef) {
      transaction.update(tableRef, {
        status: "free",
        currentSessionId: null,
        currentOrderId: null,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      })
    }
    if (tableSessionRef) {
      transaction.update(tableSessionRef, {
        status: "closed",
        closedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      })
    }
    transaction.set(auditRef, {
      userId: staff.userId,
      staffId: staff.staffId ?? staff.userId,
      staffName: staff.staffName ?? null,
      action: "order_mobile_payment_verified",
      orderId,
      before: sanitizeAuditPayload(before),
      after: {
        paymentStatus: "paid",
        paymentIntentStatus: "verified",
        orderStatus: currentOrderStatus,
        cashSessionId,
        amount,
        paymentLedgerId: idempotencyKey,
      },
      createdAt: serverTimestamp(),
    })

    return before
  })


  return result
}

export async function refundOrderTransaction({
  db,
  restaurantId,
  orderId,
  amount,
  reason,
  staff,
}: RefundInput) {
  const orderRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS, orderId)
  const refundRef = doc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "refunds"))
  const auditRef = doc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "auditLogs"))

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists()) {
      throw new Error("Commande introuvable.")
    }

    const before = { id: orderSnap.id, ...orderSnap.data() } as any
    const currentRefundTotal = Number(before.refundTotal ?? 0)
    const orderTotal = Number(before.total ?? before.totalAmount ?? 0)
    const nextRefundTotal = currentRefundTotal + amount

    if (!isOrderPaid(before)) {
      throw new Error("Impossible de rembourser une commande non payee.")
    }

    if (amount <= 0 || nextRefundTotal > orderTotal) {
      throw new Error("Montant de remboursement invalide.")
    }

    transaction.set(refundRef, {
      orderId,
      amount,
      reason,
      createdBy: staff.userId,
      staffId: staff.staffId ?? staff.userId,
      staffName: staff.staffName ?? null,
      createdAt: serverTimestamp(),
    })
    transaction.update(orderRef, {
      refunded: true,
      refundTotal: nextRefundTotal,
      updatedAt: serverTimestamp(),
    })
    transaction.set(auditRef, {
      userId: staff.userId,
      staffId: staff.staffId ?? staff.userId,
      staffName: staff.staffName ?? null,
      action: "order_refunded",
      orderId,
      before: sanitizeAuditPayload(before),
      after: {
        refunded: true,
        refundTotal: nextRefundTotal,
        refundAmount: amount,
        reason,
      },
      createdAt: serverTimestamp(),
    })
  })
}

export async function cancelOrderTransaction({
  db,
  restaurantId,
  orderId,
  reason = "",
  staff,
}: CancelInput) {
  const orderRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS, orderId)
  const auditRef = doc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "auditLogs"))

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef)
    if (!orderSnap.exists()) {
      throw new Error("Commande introuvable.")
    }

    const before = { id: orderSnap.id, ...orderSnap.data() } as any
    if (isOrderPaid(before)) {
      throw new Error("Impossible d'annuler une commande deja payee.")
    }

    transaction.update(orderRef, {
      cancelled: true,
      cancelledAt: serverTimestamp(),
      cancelledBy: staff.userId,
      cancelReason: reason || null,
      updatedAt: serverTimestamp(),
    })
    transaction.set(auditRef, {
      userId: staff.userId,
      staffId: staff.staffId ?? staff.userId,
      staffName: staff.staffName ?? null,
      action: "order_cancelled",
      orderId,
      before: sanitizeAuditPayload(before),
      after: {
        cancelled: true,
        cancelledBy: staff.userId,
        cancelReason: reason || null,
      },
      createdAt: serverTimestamp(),
    })
  })
}

export async function updateCashSessionTotals(
  db: Firestore,
  restaurantId: string,
  sessionId: string | null | undefined,
  method: "cash" | "mobile",
  amount: number
) {
  // Payment aggregates are now maintained by PaymentLedgerService.
  // Kept as a no-op compatibility shim for older callers.
  return
}

export async function releaseOrderTableIfNeeded(
  db: Firestore,
  restaurantId: string,
  order: any
) {
  if (!isOrderServed(order) || !order.tableId) return
  const tableSessionId = order.tableSessionId || order.sessionId

  if (tableSessionId) {
    const sessionOrders = await getOrdersForTableSession(db, restaurantId, tableSessionId)
    const hasOpenOrder = sessionOrders.some((sessionOrder) => {
      return !isOrderServed(sessionOrder) || !isOrderPaid(sessionOrder)
    })

    if (hasOpenOrder) return
  }

  await closeActiveTableSession(db, restaurantId, order.tableId)
  await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLES, order.tableId), {
    status: "free",
    currentSessionId: null,
    currentOrderId: null,
    updatedAt: serverTimestamp(),
  })
}

async function getOrdersForTableSession(
  db: Firestore,
  restaurantId: string,
  tableSessionId: string
) {
  const ordersRef = collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS)
  const byTableSession = await getDocs(query(ordersRef, where("tableSessionId", "==", tableSessionId)))
  const byLegacySession = await getDocs(query(ordersRef, where("sessionId", "==", tableSessionId)))
  const ordersById = new Map<string, any>()

  byTableSession.docs.forEach((orderDoc) => {
    ordersById.set(orderDoc.id, { id: orderDoc.id, ...orderDoc.data() })
  })
  byLegacySession.docs.forEach((orderDoc) => {
    ordersById.set(orderDoc.id, { id: orderDoc.id, ...orderDoc.data() })
  })

  return Array.from(ordersById.values())
}

function sanitizeAuditPayload(value: Record<string, any>) {
  const copy = { ...value }
  delete copy.customerPhone
  return copy
}
