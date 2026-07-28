import { createHash } from "node:crypto"

import type { Firestore } from "firebase-admin/firestore"
import { FieldValue } from "firebase-admin/firestore"
import { logger } from "firebase-functions/v2"

type ServedLine = {
  orderItemId: string
  productId: string
  servedDelta: number
  servedQuantity: number
}

export function getNewlyServedLines(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ServedLine[] {
  const beforeItems = indexOrderItems(before.items)
  const afterItems = indexOrderItems(after.items)
  const served: ServedLine[] = []

  for (const [orderItemId, item] of afterItems) {
    const productId = String(item.productId ?? "")
    const afterServed = servedQuantity(item)
    const beforeServed = servedQuantity(beforeItems.get(orderItemId))
    const servedDelta = afterServed - beforeServed
    if (productId && servedDelta > 0) {
      served.push({
        orderItemId,
        productId,
        servedDelta,
        servedQuantity: afterServed,
      })
    }
  }
  return served
}

export async function handleServedOrderItemsForAutomaticStock(input: {
  db: Firestore
  restaurantId: string
  orderId: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  enabled: boolean
  restaurantAllowlist: readonly string[]
  articleAllowlist: readonly string[]
}) {
  const servedLines = getNewlyServedLines(input.before, input.after)
  logger.info("stock_v2_automatic_order_received", {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    newlyServedLineCount: servedLines.length,
    featureFlags: {
      enabled: input.enabled,
      restaurantAllowlist: input.restaurantAllowlist,
      articleAllowlist: input.articleAllowlist,
    },
  })
  if (
    !input.enabled
    || !input.restaurantAllowlist.includes(input.restaurantId)
    || servedLines.length === 0
  ) {
    logger.info("stock_v2_automatic_order_ignored", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      enabled: input.enabled,
      restaurantEnabled: input.restaurantAllowlist.includes(input.restaurantId),
      newlyServedLineCount: servedLines.length,
    })
    return { ignored: true, deductions: 0, anomalies: 0 }
  }

  for (const line of servedLines) {
    logger.info("stock_v2_automatic_product_line", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      orderItemId: line.orderItemId,
      productId: line.productId,
      newlyServedQuantity: line.servedDelta,
      servedQuantityVersion: line.servedQuantity,
    })
  }

  const restaurant = input.db.collection("restaurants").doc(input.restaurantId)
  const associationSnapshot = await input.db
    .collection("restaurants")
    .doc(input.restaurantId)
    .collection("stockAutomaticAssociationsV2")
    .where("status", "==", "active")
    .get()
  logger.info("stock_v2_automatic_associations_read", {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    associationCount: associationSnapshot.size,
  })
  const associationsByProduct = new Map<string, typeof associationSnapshot.docs>()
  for (const document of associationSnapshot.docs) {
    const productId = String(document.data().productId ?? "")
    associationsByProduct.set(productId, [
      ...(associationsByProduct.get(productId) ?? []),
      document,
    ])
  }
  let deductions = 0
  let anomalies = 0
  for (const line of servedLines) {
    const associations = associationsByProduct.get(line.productId) ?? []
    if (associations.length === 0) {
      const key = `missing-association:${input.orderId}:${line.orderItemId}:${line.servedQuantity}`
      const id = createHash("sha256").update(key).digest("hex")
      await restaurant.collection("stockAutomaticAnomaliesV2").doc(id).set({
        restaurantId: input.restaurantId,
        productId: line.productId,
        orderItemId: line.orderItemId,
        businessReference: input.orderId,
        requestedQuantity: line.servedDelta,
        servedQuantityVersion: line.servedQuantity,
        type: "MISSING_ASSOCIATION",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: false })
      anomalies += 1
      continue
    }

    for (const associationDocument of associations) {
      const association = associationDocument.data()
      const articleId = String(association.articleId ?? "")
      if (!isArticleEnabled(articleId, input.articleAllowlist)) continue
      const quantityPerSale = Number(association.quantity ?? 0)
      const quantity = line.servedDelta * quantityPerSale
      if (!(quantity > 0)) continue
      const outcome = await applyOneDeduction({
        db: input.db,
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        orderItemId: line.orderItemId,
        servedQuantityVersion: line.servedQuantity,
        associationId: associationDocument.id,
        articleId,
        productId: line.productId,
        quantity,
        quantityPerSale,
        unit: String(association.unit ?? ""),
      })
      if (outcome === "deducted") deductions += 1
      if (outcome === "anomaly") anomalies += 1
    }
  }
  return { ignored: false, deductions, anomalies }
}

export async function handleFullyRefundedOrderForAutomaticStock(input: {
  db: Firestore
  restaurantId: string
  orderId: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  enabled: boolean
  restaurantAllowlist: readonly string[]
}) {
  const total = Number(input.after.total ?? input.after.totalAmount ?? 0)
  const beforeRefund = Number(input.before.refundTotal ?? 0)
  const afterRefund = Number(input.after.refundTotal ?? 0)
  if (
    !input.enabled
    || !input.restaurantAllowlist.includes(input.restaurantId)
    || total <= 0
    || beforeRefund >= total
    || afterRefund < total
  ) return { ignored: true, compensations: 0 }

  const restaurant = input.db.collection("restaurants").doc(input.restaurantId)
  const deductions = await restaurant
    .collection("stockOperationsV2")
    .where("type", "==", "AUTOMATIC_DEDUCTION")
    .where("businessReference", "==", input.orderId)
    .get()
  let compensations = 0
  for (const deduction of deductions.docs) {
    const data = deduction.data()
    const amount = Math.abs(Number(data.variation ?? 0))
    if (!(amount > 0)) continue
    const stableKey = `automatic-compensation:refund:${input.orderId}:${deduction.id}`
    const stableId = createHash("sha256").update(stableKey).digest("hex")
    const balanceRef = restaurant.collection("stockBalancesV2").doc(String(data.articleId))
    const operationRef = restaurant.collection("stockOperationsV2").doc(stableId)
    const idempotencyRef = restaurant.collection("stockIdempotencyV2").doc(stableId)
    const applied = await input.db.runTransaction(async (transaction) => {
      const [idempotency, balance] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(balanceRef),
      ])
      if (idempotency.exists) return false
      if (!balance.exists) return false
      const current = Number(balance.data()?.quantity ?? 0)
      const version = Number(balance.data()?.version ?? 0)
      const now = new Date().toISOString()
      transaction.create(operationRef, {
        restaurantId: input.restaurantId,
        articleId: String(data.articleId),
        type: "AUTOMATIC_COMPENSATION",
        quantityBefore: current,
        variation: amount,
        quantityAfter: current + amount,
        unit: String(data.unit),
        occurredAt: now,
        createdAt: now,
        createdBy: "system",
        idempotencyKey: stableKey,
        expectedVersion: version,
        productId: String(data.productId),
        businessReference: input.orderId,
        originalOperationId: deduction.id,
        origin: "SYSTEM",
      })
      transaction.set(balanceRef, {
        ...balance.data(),
        quantity: current + amount,
        version: version + 1,
        lastOperationAt: now,
      })
      transaction.create(idempotencyRef, {
        restaurantId: input.restaurantId,
        articleId: String(data.articleId),
        operationId: stableId,
        fingerprint: `${data.articleId}|${data.productId}|${amount}|refund:${input.orderId}`,
        createdAt: now,
        createdBy: "system",
      })
      return true
    })
    if (applied) compensations += 1
  }
  return { ignored: false, compensations }
}

async function applyOneDeduction(input: {
  db: Firestore
  restaurantId: string
  orderId: string
  orderItemId: string
  servedQuantityVersion: number
  associationId: string
  articleId: string
  productId: string
  quantity: number
  quantityPerSale: number
  unit: string
}) {
  const restaurant = input.db.collection("restaurants").doc(input.restaurantId)
  const stableKey = [
    "automatic-deduction",
    input.restaurantId,
    input.orderId,
    input.orderItemId,
    input.articleId,
    input.servedQuantityVersion,
  ].join(":")
  const stableId = createHash("sha256").update(stableKey).digest("hex")
  const articleRef = restaurant.collection("stockItemsV2").doc(input.articleId)
  const productRef = restaurant.collection("products").doc(input.productId)
  const balanceRef = restaurant.collection("stockBalancesV2").doc(input.articleId)
  const operationRef = restaurant.collection("stockOperationsV2").doc(stableId)
  const idempotencyRef = restaurant.collection("stockIdempotencyV2").doc(stableId)
  const progressId = createHash("sha256")
    .update(`${input.restaurantId}|${input.orderId}|${input.orderItemId}|${input.articleId}`)
    .digest("hex")
  const progressRef = restaurant.collection("stockServingProgressV2").doc(progressId)
  const anomalyRef = restaurant.collection("stockAutomaticAnomaliesV2").doc(stableId)
  logger.info("stock_v2_automatic_transaction_start", {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    servedQuantityVersion: input.servedQuantityVersion,
    associationId: input.associationId,
    productId: input.productId,
    articleId: input.articleId,
    quantityToDeduct: input.quantity,
  })
  try {
    const outcome = await input.db.runTransaction(async (transaction) => {
    const [idempotency, article, product, balance, progress] = await Promise.all([
      transaction.get(idempotencyRef),
      transaction.get(articleRef),
      transaction.get(productRef),
      transaction.get(balanceRef),
      transaction.get(progressRef),
    ])
    logger.info("stock_v2_automatic_transaction_documents_read", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      productId: input.productId,
      articleId: input.articleId,
      articleExists: article.exists,
      productExists: product.exists,
      balanceExists: balance.exists,
      trackingMode: article.data()?.trackingMode ?? null,
      articleStatus: article.data()?.status ?? null,
      quantityBefore: balance.exists ? Number(balance.data()?.quantity ?? 0) : null,
      quantityToDeduct: input.quantity,
    })
    if (idempotency.exists) return "replayed" as const
    const previouslyProcessedServedQuantity = progress.exists
      ? Number(progress.data()?.servedQuantity ?? 0)
      : 0
    const newlyProcessedServedQuantity = Math.max(
      0,
      input.servedQuantityVersion - previouslyProcessedServedQuantity
    )
    const effectiveQuantity = newlyProcessedServedQuantity * input.quantityPerSale
    if (!(effectiveQuantity > 0)) return "replayed" as const
    if (
      !article.exists
      || article.data()?.status !== "active"
      || article.data()?.trackingMode !== "AUTOMATIC_SIMPLE"
      || !product.exists
      || !balance.exists
    ) {
      transaction.set(anomalyRef, anomaly(input, "INVALID_ASSOCIATION"))
      return "anomaly" as const
    }
    const current = Number(balance.data()?.quantity ?? 0)
    if (current < effectiveQuantity) {
      transaction.set(anomalyRef, anomaly(
        { ...input, quantity: effectiveQuantity },
        "INSUFFICIENT_STOCK"
      ))
      return "anomaly" as const
    }
    const now = new Date().toISOString()
    const version = Number(balance.data()?.version ?? 0)
    logger.info("stock_v2_automatic_transaction_write_planned", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      productId: input.productId,
      articleId: input.articleId,
      quantityBefore: current,
      quantityToDeduct: effectiveQuantity,
      quantityAfter: current - effectiveQuantity,
      balanceVersionBefore: version,
      balanceVersionAfter: version + 1,
    })
    const operation = {
      restaurantId: input.restaurantId,
      articleId: input.articleId,
      type: "AUTOMATIC_DEDUCTION",
      quantityBefore: current,
      variation: -effectiveQuantity,
      quantityAfter: current - effectiveQuantity,
      unit: input.unit,
      occurredAt: now,
      createdAt: now,
      createdBy: "system",
      idempotencyKey: stableKey,
      expectedVersion: version,
      productId: input.productId,
      businessReference: input.orderId,
      orderItemId: input.orderItemId,
      servedQuantityVersion: input.servedQuantityVersion,
      origin: "SYSTEM",
    }
    transaction.create(operationRef, operation)
    transaction.set(balanceRef, {
      ...balance.data(),
      quantity: current - effectiveQuantity,
      version: version + 1,
      lastOperationAt: now,
    })
    transaction.create(idempotencyRef, {
      restaurantId: input.restaurantId,
      articleId: input.articleId,
      operationId: stableId,
      fingerprint: `${input.articleId}|${input.productId}|${effectiveQuantity}|${input.orderId}|${input.orderItemId}|${input.servedQuantityVersion}`,
      createdAt: now,
      createdBy: "system",
    })
    transaction.set(progressRef, {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      articleId: input.articleId,
      productId: input.productId,
      servedQuantity: input.servedQuantityVersion,
      updatedAt: now,
    })
    return "deducted" as const
    })
    logger.info("stock_v2_automatic_transaction_end", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      productId: input.productId,
      articleId: input.articleId,
      quantityToDeduct: input.quantity,
      outcome,
    })
    return outcome
  } catch (error) {
    logger.error("stock_v2_automatic_transaction_error", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      productId: input.productId,
      articleId: input.articleId,
      quantityToDeduct: input.quantity,
      error,
    })
    throw error
  }
}

function anomaly(
  input: {
    restaurantId: string
    orderId: string
    articleId: string
    productId: string
    quantity: number
  },
  type: "INVALID_ASSOCIATION" | "INSUFFICIENT_STOCK"
) {
  return {
    restaurantId: input.restaurantId,
    articleId: input.articleId,
    productId: input.productId,
    businessReference: input.orderId,
    requestedQuantity: input.quantity,
    type,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  }
}

function isArticleEnabled(articleId: string, allowlist: readonly string[]) {
  return allowlist.length === 0 || allowlist.includes(articleId)
}

function indexOrderItems(value: unknown) {
  const result = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(value)) return result
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return
    const data = item as Record<string, unknown>
    const id = String(data.id ?? data.orderItemId ?? `${data.productId ?? "item"}-${index}`)
    result.set(id, data)
  })
  return result
}

function servedQuantity(item: Record<string, unknown> | undefined) {
  if (!item) return 0
  const total = Math.max(0, Number(item.quantity ?? 0))
  const explicit = Number(item.servedQuantity)
  if (Number.isFinite(explicit)) return Math.min(total, Math.max(0, explicit))
  const status = String(item.status ?? item.itemStatus ?? "").toLowerCase()
  return ["served", "picked_up", "completed", "delivered", "servie", "servies"].includes(status)
    ? total
    : 0
}

export function automaticStockEnvironment() {
  return {
    enabled: process.env.STOCK_AUTOMATIC_SIMPLE_ENABLED === "true",
    restaurantAllowlist: split(process.env.STOCK_AUTOMATIC_SIMPLE_RESTAURANTS),
    articleAllowlist: split(process.env.STOCK_AUTOMATIC_SIMPLE_ARTICLES),
  }
}

function split(value: string | undefined) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean)
}
