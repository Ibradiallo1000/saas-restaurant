import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Transaction,
} from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

import {
  automaticAssociationId,
  calculateServedDelta,
  servingEventId,
  servingProgressId,
} from "../../../modules/stock/automatic-simple/domain/served-stock.ts"
import { computeOrderAggregate } from "../aggregate/compute.ts"
import {
  commandProofId,
  commandRequestHash,
  ORDER_COMMAND_IDEMPOTENCY_COLLECTION,
  ORDER_COMMAND_IDEMPOTENCY_RETENTION_DAYS,
  sha256,
} from "../common/idempotency.ts"
import { OrderCommandError } from "./errors.ts"
import type {
  AnyOrderCommandInput,
  AtomicOrderCommandPort,
  CanonicalCommandResult,
  CommandMutationPlan,
  ConfirmOrderPaymentInput,
  OrderCommandName,
  OrderCommandState,
  OrderItemSnapshot,
  OrderSnapshot,
  PreparationMode,
} from "./types.ts"
import { commandHashPayload } from "./validation.ts"

interface StockApplication {
  warning?: string
  operationId?: string
  previousQuantity?: number
  deductedQuantity: number
  newQuantity?: number
}

export class FirestoreAtomicOrderCommandStore implements AtomicOrderCommandPort {
  private readonly db: Firestore

  constructor(db: Firestore) {
    this.db = db
  }

  async execute(
    commandName: OrderCommandName,
    input: AnyOrderCommandInput,
    transition: (state: OrderCommandState) => CommandMutationPlan
  ): Promise<CanonicalCommandResult> {
    const restaurantRef = this.db.collection("restaurants").doc(input.restaurantId)
    const orderRef = restaurantRef.collection("orders").doc(input.orderId)
    const orderItemId = "orderItemId" in input ? input.orderItemId : null
    const itemRef = orderItemId ? orderRef.collection("orderItems").doc(orderItemId) : null
    const requestHash = commandRequestHash({
      commandName,
      ...commandHashPayload(input),
    })
    const commandId = commandProofId({
      restaurantId: input.restaurantId,
      actorId: input.actor.id,
      commandName,
      orderId: input.orderId,
      orderItemId,
      idempotencyKey: input.idempotencyKey,
    })
    const proofRef = restaurantRef
      .collection(ORDER_COMMAND_IDEMPOTENCY_COLLECTION)
      .doc(commandId)
    const auditRef = orderRef.collection("commandAudit").doc(commandId)

    try {
      return await this.db.runTransaction(async (transaction) => {
        const proofSnapshot = await transaction.get(proofRef)
        if (proofSnapshot.exists) {
          return replayProof(proofSnapshot.data(), input, commandName, requestHash)
        }

        const orderSnapshot = await transaction.get(orderRef)
        if (!orderSnapshot.exists) {
          throw new OrderCommandError("ORDER_NOT_FOUND", "Commande introuvable.")
        }
        const order = toOrderSnapshot(orderSnapshot.id, orderSnapshot.data() ?? {})
        assertOrderTenant(order, input.restaurantId)

        const itemSnapshots = await transaction.get(orderRef.collection("orderItems"))
        const items = itemSnapshots.docs.map((snapshot) =>
          toOrderItemSnapshot(snapshot.id, snapshot.data())
        )
        items.forEach((entry) => assertItemTenant(entry, input.restaurantId, input.orderId))
        const item = orderItemId ? items.find((entry) => entry.id === orderItemId) ?? null : null
        if (itemRef && !item) throw new OrderCommandError("ORDER_ITEM_NOT_FOUND", "Ligne introuvable.")
        order.hasUnaggregatedCancellation = items.some((entry) => entry.cancelledQuantity > 0)

        const plan = transition({ order, item, items })
        const effectiveItems = items.map((entry) =>
          itemRef && entry.id === orderItemId && plan.itemUpdate
            ? { ...entry, ...plan.itemUpdate } as OrderItemSnapshot
            : entry
        )
        const effectivePayment = String(plan.orderUpdate?.paymentStatus ?? order.paymentStatus)
        const aggregate = computeOrderAggregate({
          parent: {
            orderStatus: order.orderStatus,
            kitchenStatus: order.kitchenStatus,
            paymentStatus: effectivePayment,
            aggregateVersion: order.aggregateVersion,
            orderAggregate: order.orderAggregate,
            embeddedItems: order.embeddedItems,
            canonicalItemCount: order.canonicalItemCount,
          },
          items: effectiveItems,
        })
        const now = Timestamp.now()
        const stock = plan.stock
          ? await prepareStockWrites(transaction, restaurantRef, input, plan, now)
          : null
        const paymentId = plan.paymentLedger
          ? await preparePaymentWrites(
              transaction,
              restaurantRef,
              orderRef,
              input as ConfirmOrderPaymentInput,
              plan,
              commandId,
              now
            )
          : undefined

        if (plan.itemUpdate && itemRef) {
          transaction.update(itemRef, withMutationMetadata(plan.itemUpdate, input, commandName, now))
        }
        const aggregateVersion = aggregate.projectionChanged
          ? order.aggregateVersion + 1
          : order.aggregateVersion
        const aggregateUpdate = aggregate.projectionChanged ? {
          orderStatus: aggregate.orderStatus,
          kitchenStatus: aggregate.kitchenStatus,
          orderAggregate: aggregate.orderAggregate,
          aggregateVersion,
          aggregateUpdatedAt: now,
          aggregateSource: commandName,
          aggregateReason: commandName,
          ...(aggregate.projectedItems ? { items: aggregate.projectedItems } : {}),
          updatedAt: now,
        } : {}
        if (plan.orderUpdate || aggregate.projectionChanged) {
          transaction.update(orderRef, {
            ...(plan.orderUpdate ? withPaymentMetadata(plan.orderUpdate, input, now) : {}),
            ...aggregateUpdate,
          })
        }

        const version = Number(plan.result.version)
        const response: CanonicalCommandResult = {
          ok: true,
          commandName,
          orderId: input.orderId,
          orderItemId,
          status: "APPLIED",
          version,
          replayed: false,
          ...(stock?.warning ? { warning: stock.warning } : {}),
          ...(stock ? {
            stock: {
              operationId: stock.operationId,
              previousQuantity: stock.previousQuantity,
              deductedQuantity: stock.deductedQuantity,
              newQuantity: stock.newQuantity,
            },
          } : {}),
          ...(paymentId ? { paymentId } : {}),
        }
        const persistedResponse = sanitizeUndefined(response)
        const expiresAt = Timestamp.fromMillis(
          now.toMillis() +
            ORDER_COMMAND_IDEMPOTENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000
        )

        transaction.create(auditRef, {
          schemaVersion: 1,
          commandName,
          commandId,
          actorId: input.actor.id,
          actorType: input.actor.role === "system" ? "system" : "staff",
          actorRole: input.actor.role,
          sourceChannel: input.sourceChannel,
          restaurantId: input.restaurantId,
          orderId: input.orderId,
          orderItemId,
          before: plan.before,
          after: plan.after,
          idempotencyKeyHash: sha256(input.idempotencyKey),
          requestHash,
          result: "APPLIED",
          stockOperationId: stock?.operationId ?? null,
          paymentId: paymentId ?? null,
          aggregate: aggregate.projectionChanged ? {
            changed: true,
            before: { orderStatus: order.orderStatus, aggregateVersion: order.aggregateVersion },
            after: { orderStatus: aggregate.orderStatus, aggregateVersion },
            trigger: commandName,
            reason: commandName,
            warnings: aggregate.warnings,
            legacyProjection: aggregate.legacyProjection,
          } : { changed: false },
          occurredAt: now,
        })
        transaction.create(proofRef, {
          schemaVersion: 1,
          commandName,
          commandId,
          restaurantId: input.restaurantId,
          actorId: input.actor.id,
          actorRole: input.actor.role,
          orderId: input.orderId,
          orderItemId,
          idempotencyKeyHash: sha256(input.idempotencyKey),
          requestHash,
          response: persistedResponse,
          createdAt: now,
          expiresAt,
        })

        return response
      })
    } catch (error) {
      if (error instanceof OrderCommandError) throw error
      if (planErrorLooksLikeStock(error)) {
        throw new OrderCommandError(
          "STOCK_DEDUCTION_FAILED",
          "La déduction du stock a échoué.",
          true
        )
      }
      throw error
    }
  }
}

async function prepareStockWrites(
  transaction: Transaction,
  restaurantRef: DocumentReference,
  input: AnyOrderCommandInput,
  plan: CommandMutationPlan,
  now: Timestamp
): Promise<StockApplication> {
  const stock = plan.stock
  if (!stock) return { deductedQuantity: 0 }

  const productRef = restaurantRef.collection("products").doc(stock.productId)
  const productSnapshot = await transaction.get(productRef)
  const articleId = productSnapshot.exists
    ? stringOr(productSnapshot.data()?.stockArticleId, "")
    : ""
  if (!articleId) {
    return warning("Produit servi sans association d’inventaire active.")
  }

  const associationId = automaticAssociationId(stock.productId, articleId)
  const associationRef = restaurantRef
    .collection("stockAutomaticAssociationsV2")
    .doc(associationId)
  const articleRef = restaurantRef.collection("stockItemsV2").doc(articleId)
  const balanceRef = restaurantRef.collection("stockBalancesV2").doc(articleId)
  const progressId = servingProgressId(input.orderId, stock.orderItemId, articleId)
  const progressRef = restaurantRef.collection("stockServingProgressV2").doc(progressId)
  const operationId = servingEventId(
    input.orderId,
    stock.orderItemId,
    articleId,
    stock.servedQuantityAfter
  )
  const operationRef = restaurantRef.collection("stockOperationsV2").doc(operationId)
  const stockProofRef = restaurantRef.collection("stockIdempotencyV2").doc(operationId)
  const [associationSnapshot, articleSnapshot, balanceSnapshot, progressSnapshot, proofSnapshot] =
    await Promise.all([
      transaction.get(associationRef),
      transaction.get(articleRef),
      transaction.get(balanceRef),
      transaction.get(progressRef),
      transaction.get(stockProofRef),
    ])

  if (
    !associationSnapshot.exists ||
    associationSnapshot.data()?.status !== "active" ||
    stringOr(associationSnapshot.data()?.productId, "") !== stock.productId ||
    stringOr(associationSnapshot.data()?.articleId, "") !== articleId
  ) {
    return warning("Produit servi sans association d’inventaire active.")
  }
  if (
    !articleSnapshot.exists ||
    articleSnapshot.data()?.status !== "active" ||
    articleSnapshot.data()?.trackingMode !== "AUTOMATIC_SIMPLE"
  ) {
    return warning("Article servi sans déduction automatique active.")
  }
  if (!balanceSnapshot.exists) {
    throw Object.assign(new Error("Balance de stock introuvable."), { stockFailure: true })
  }

  const processed = progressSnapshot.exists
    ? numberOr(progressSnapshot.data()?.servedQuantity, 0)
    : stock.servedQuantityBefore
  const quantityPerSale = numberOr(associationSnapshot.data()?.quantity, 0)
  let delta: ReturnType<typeof calculateServedDelta>
  try {
    delta = calculateServedDelta({
      orderedQuantity: stock.servedQuantityAfter,
      requestedServedQuantity: stock.servedQuantityAfter,
      processedServedQuantity: processed,
      quantityPerSale,
    })
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      stockFailure: true,
    })
  }
  if (proofSnapshot.exists || delta.servedDelta === 0) {
    return { operationId, deductedQuantity: 0 }
  }

  const balance = balanceSnapshot.data() ?? {}
  const quantityBefore = numberOr(balance.quantity, 0)
  const quantityAfter = quantityBefore - delta.quantityToDeduct
  const insufficient = quantityAfter < 0
  const appliedQuantityAfter = insufficient ? quantityBefore : quantityAfter
  const deductedQuantity = insufficient ? 0 : delta.quantityToDeduct
  const operationType = insufficient
    ? "AUTOMATIC_DEDUCTION_SKIPPED_INSUFFICIENT_STOCK"
    : "AUTOMATIC_DEDUCTION"

  if (!insufficient) {
    transaction.update(balanceRef, {
      quantity: appliedQuantityAfter,
      version: numberOr(balance.version, 0) + 1,
      lastOperationAt: now,
      lastOperationId: operationId,
    })
  }
  transaction.create(operationRef, {
    restaurantId: input.restaurantId,
    articleId,
    productId: stock.productId,
    orderId: input.orderId,
    orderItemId: stock.orderItemId,
    associationId,
    type: operationType,
    status: insufficient ? "WARNING" : "APPLIED",
    warningCode: insufficient ? "INSUFFICIENT_STOCK" : null,
    quantityBefore,
    quantityAfter: appliedQuantityAfter,
    variation: -deductedQuantity,
    requestedDeduction: delta.quantityToDeduct,
    unit: stringOr(associationSnapshot.data()?.unit ?? balance.unit, ""),
    servedQuantityBefore: processed,
    servedQuantityAfter: stock.servedQuantityAfter,
    quantityPerSale,
    businessReference: input.orderId,
    idempotencyKey: operationId,
    occurredAt: now,
    createdAt: now,
    createdBy: input.actor.id,
  })
  transaction.set(progressRef, {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    orderItemId: stock.orderItemId,
    productId: stock.productId,
    articleId,
    associationId,
    servedQuantity: stock.servedQuantityAfter,
    lastOperationId: operationId,
    warningCode: insufficient ? "INSUFFICIENT_STOCK" : null,
    updatedAt: now,
    updatedBy: input.actor.id,
  })
  transaction.create(stockProofRef, {
    restaurantId: input.restaurantId,
    articleId,
    operationId,
    fingerprint: [
      input.orderId,
      stock.orderItemId,
      articleId,
      stock.servedQuantityAfter,
      delta.quantityToDeduct,
    ].join("|"),
    result: insufficient ? "WARNING" : "APPLIED",
    createdAt: now,
    createdBy: input.actor.id,
  })

  return {
    operationId,
    previousQuantity: quantityBefore,
    deductedQuantity,
    newQuantity: appliedQuantityAfter,
    ...(insufficient
      ? { warning: "Service enregistré, mais stock insuffisant : aucune déduction appliquée." }
      : {}),
  }
}

async function preparePaymentWrites(
  transaction: Transaction,
  restaurantRef: DocumentReference,
  orderRef: DocumentReference,
  input: ConfirmOrderPaymentInput,
  plan: CommandMutationPlan,
  paymentId: string,
  now: Timestamp
) {
  const ledger = plan.paymentLedger
  if (!ledger) throw new OrderCommandError("INVALID_COMMAND", "Plan de paiement invalide.")
  const sessionRef = restaurantRef.collection("cashSessions").doc(ledger.cashSessionId)
  const paymentRef = restaurantRef.collection("payments").doc(paymentId)
  const [sessionSnapshot, paymentSnapshot] = await Promise.all([
    transaction.get(sessionRef),
    transaction.get(paymentRef),
  ])
  if (!sessionSnapshot.exists || sessionSnapshot.data()?.status !== "open") {
    throw new OrderCommandError("INVALID_COMMAND", "La session de caisse n'est pas ouverte.")
  }
  if (paymentSnapshot.exists) {
    throw new OrderCommandError("IDEMPOTENCY_CORRUPTED", "Le ledger existe sans preuve de commande.")
  }
  transaction.create(paymentRef, {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    sessionId: ledger.cashSessionId,
    cashierId: input.actor.id,
    source: "pos",
    type: ledger.method,
    provider: ledger.provider,
    externalReference: ledger.externalReference,
    amount: ledger.amount,
    receivedAmount: ledger.receivedAmount,
    changeDue: ledger.changeDue,
    status: "confirmed",
    idempotencyKeyHash: sha256(input.idempotencyKey),
    confirmedAt: now,
    confirmedBy: input.actor.id,
    createdAt: now,
  })
  void orderRef
  return paymentRef.id
}

function withMutationMetadata(
  update: Record<string, unknown>,
  input: AnyOrderCommandInput,
  commandName: OrderCommandName,
  now: Timestamp
) {
  const result: Record<string, unknown> = {
    ...update,
    updatedAt: now,
    updatedBy: input.actor.id,
  }
  if (commandName === "MarkOrderItemServed") {
    result.servedAt = now
    result.servedBy = input.actor.id
  }
  if (commandName === "CancelOrderItemQuantity") {
    result.cancelledAt = now
    result.cancelledBy = input.actor.id
  }
  return result
}

function withPaymentMetadata(
  update: Record<string, unknown>,
  input: AnyOrderCommandInput,
  now: Timestamp
) {
  return {
    ...update,
    paidAt: now,
    paidBy: input.actor.id,
    updatedAt: now,
  }
}

function replayProof(
  data: DocumentData | undefined,
  input: AnyOrderCommandInput,
  commandName: OrderCommandName,
  requestHash: string
): CanonicalCommandResult {
  if (!data || data.requestHash !== requestHash) {
    throw new OrderCommandError(
      "IDEMPOTENCY_CONFLICT",
      "Cette clé a déjà été utilisée pour une commande différente."
    )
  }
  if (
    data.restaurantId !== input.restaurantId ||
    data.actorId !== input.actor.id ||
    data.commandName !== commandName ||
    data.orderId !== input.orderId ||
    !data.response
  ) {
    throw new OrderCommandError("IDEMPOTENCY_CORRUPTED", "La preuve d'idempotence est incohérente.")
  }
  return { ...(data.response as CanonicalCommandResult), replayed: true }
}

function toOrderSnapshot(id: string, data: DocumentData): OrderSnapshot {
  return {
    id,
    restaurantId: stringOr(data.restaurantId, ""),
    paymentStatus: stringOr(data.paymentStatus, "unpaid"),
    paymentVersion: positiveVersion(data.paymentVersion),
    totalAmount: numberOr(data.totalAmount, numberOr(data.total, 0)),
    total: numberOr(data.total, numberOr(data.totalAmount, 0)),
    hasUnaggregatedCancellation: false,
    orderStatus: stringOr(data.orderStatus, stringOr(data.kitchenStatus, "pending")),
    kitchenStatus: stringOr(data.kitchenStatus, stringOr(data.orderStatus, "pending")),
    aggregateVersion: positiveVersion(data.aggregateVersion),
    orderAggregate: isRecord(data.orderAggregate) ? data.orderAggregate : null,
    embeddedItems: Array.isArray(data.items) ? data.items : null,
    canonicalItemCount: numberOr(data.canonicalItemCount, Array.isArray(data.items) ? data.items.length : 0),
  }
}

function toOrderItemSnapshot(id: string, data: DocumentData): OrderItemSnapshot {
  return {
    id,
    orderId: stringOr(data.orderId, ""),
    restaurantId: stringOr(data.restaurantId, ""),
    productId: stringOr(data.productId, ""),
    preparationMode: preparationMode(data.preparationMode),
    status: itemStatus(data.status),
    quantity: numberOr(data.quantity, 0),
    servedQuantity: numberOr(data.servedQuantity, data.status === "served" ? data.quantity : 0),
    cancelledQuantity: numberOr(data.cancelledQuantity, 0),
    version: positiveVersion(data.version),
  }
}

function assertOrderTenant(order: OrderSnapshot, restaurantId: string) {
  if (order.restaurantId !== restaurantId) {
    throw new OrderCommandError("RESTAURANT_MISMATCH", "Commande hors restaurant.")
  }
}

function assertItemTenant(item: OrderItemSnapshot, restaurantId: string, orderId: string) {
  if (item.restaurantId !== restaurantId || item.orderId !== orderId) {
    throw new OrderCommandError("RESTAURANT_MISMATCH", "Ligne hors commande ou restaurant.")
  }
}

function preparationMode(value: unknown): PreparationMode {
  return value === "kitchen" || value === "bar" || value === "direct" ? value : "direct"
}

function itemStatus(value: unknown): OrderItemSnapshot["status"] {
  return value === "pending" ||
    value === "preparing" ||
    value === "ready" ||
    value === "served" ||
    value === "cancelled"
    ? value
    : "pending"
}

function positiveVersion(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

function numberOr(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function warning(message: string): StockApplication {
  return { warning: message, deductedQuantity: 0 }
}

function planErrorLooksLikeStock(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "stockFailure" in error &&
      (error as { stockFailure?: unknown }).stockFailure
  )
}

function sanitizeUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
