"use client"

import {
  doc,
  runTransaction,
  Timestamp,
  type Firestore,
  type Transaction,
} from "firebase/firestore"

import {
  automaticAssociationId,
  calculateServedDelta,
  servingEventId,
  servingProgressId,
} from "../domain/served-stock.ts"

export type ServedStockResult = {
  servedQuantity: number
  deductedQuantity: number
  replayed: boolean
  warning?: string
  operationId?: string
  previousQuantity?: number
  newQuantity?: number
}

export async function markOrderItemAsServedAndDeductStock(input: {
  db: Firestore
  restaurantId: string
  orderId: string
  orderItemId: string
  actorId: string
  servedQuantity?: number
}): Promise<ServedStockResult> {
  console.info("[stock:auto-simple] entry", {
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    servedQuantity: input.servedQuantity,
  })
  try {
    const result = await executeServedStockTransaction(input)
    console.info("[stock:auto-simple] completed", result)
    return result
  } catch (error: any) {
    console.error("[stock:auto-simple] first attempt failed", {
      code: error?.code,
      message: error?.message,
    })
    if (error?.code !== "permission-denied" && error?.code !== "aborted") throw error
    console.info("[stock:auto-simple] retry", {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
    })
    const result = await executeServedStockTransaction(input)
    console.info("[stock:auto-simple] completed after retry", result)
    return result
  }
}

async function executeServedStockTransaction(input: {
  db: Firestore
  restaurantId: string
  orderId: string
  orderItemId: string
  actorId: string
  servedQuantity?: number
}): Promise<ServedStockResult> {
  const restaurantPath = ["restaurants", input.restaurantId] as const
  const orderRef = doc(input.db, ...restaurantPath, "orders", input.orderId)
  const orderItemRef = doc(orderRef, "orderItems", input.orderItemId)

  return runTransaction(input.db, async (transaction) => {
    console.info("[stock:auto-simple] transaction started", {
      orderPath: orderRef.path,
      orderItemPath: orderItemRef.path,
    })
    const [orderSnapshot, orderItemSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(orderItemRef),
    ])
    if (!orderSnapshot.exists()) throw new Error("Commande introuvable.")

    const order = orderSnapshot.data()
    if (String(order.restaurantId ?? "") !== input.restaurantId) {
      throw new Error("Commande hors restaurant.")
    }
    if (!orderItemSnapshot.exists()) {
      const error = Object.assign(
        new Error(
          `ORDER_ITEM_NOT_FOUND: ${input.restaurantId}/${input.orderId}/${input.orderItemId}`
        ),
        {
          code: "ORDER_ITEM_NOT_FOUND",
          restaurantId: input.restaurantId,
          orderId: input.orderId,
          orderItemId: input.orderItemId,
        }
      )
      throw error
    }
    const embeddedItems = Array.isArray(order.items) ? order.items : []
    const embeddedIndex = embeddedItems.findIndex(
      (item: any, index: number) => stableOrderItemId(item, index) === input.orderItemId
    )
    const embeddedItem = embeddedIndex >= 0 ? embeddedItems[embeddedIndex] : null
    const line = orderItemSnapshot.data()

    const productId = String(line.productId ?? "")
    const orderedQuantity = Number(line.quantity ?? 0)
    const currentServedQuantity = normalizedServedQuantity(line)
    const requestedServedQuantity = input.servedQuantity ?? orderedQuantity
    if (!productId || !(orderedQuantity > 0)) {
      throw new Error("Ligne de commande invalide.")
    }
    if (
      !Number.isFinite(requestedServedQuantity)
      || requestedServedQuantity < currentServedQuantity
      || requestedServedQuantity > orderedQuantity
    ) {
      throw new Error("La quantité servie doit être croissante et ne peut pas dépasser la commande.")
    }

    const productRef = doc(input.db, ...restaurantPath, "products", productId)
    const productSnapshot = await transaction.get(productRef)
    const articleId = productSnapshot.exists()
      ? String(productSnapshot.data().stockArticleId ?? "")
      : ""
    console.info("[stock:auto-simple] product association resolved", {
      productId,
      productPath: productRef.path,
      articleId,
    })

    if (!articleId) {
      markLineServed(transaction, {
        orderRef,
        orderItemRef,
        embeddedItems,
        embeddedIndex,
        requestedServedQuantity,
        orderedQuantity,
        actorId: input.actorId,
      })
      return warningResult(
        requestedServedQuantity,
        "Produit servi, mais aucune association d’inventaire active n’a été trouvée."
      )
    }

    const associationId = automaticAssociationId(productId, articleId)
    const associationRef = doc(
      input.db,
      ...restaurantPath,
      "stockAutomaticAssociationsV2",
      associationId
    )
    const articleRef = doc(input.db, ...restaurantPath, "stockItemsV2", articleId)
    const balanceRef = doc(input.db, ...restaurantPath, "stockBalancesV2", articleId)
    const progressId = servingProgressId(input.orderId, input.orderItemId, articleId)
    const progressRef = doc(
      input.db,
      ...restaurantPath,
      "stockServingProgressV2",
      progressId
    )
    const eventId = servingEventId(
      input.orderId,
      input.orderItemId,
      articleId,
      requestedServedQuantity
    )
    const operationRef = doc(input.db, ...restaurantPath, "stockOperationsV2", eventId)
    const idempotencyRef = doc(
      input.db,
      ...restaurantPath,
      "stockIdempotencyV2",
      eventId
    )
    const [
      associationSnapshot,
      articleSnapshot,
      balanceSnapshot,
      progressSnapshot,
      idempotencySnapshot,
    ] = await Promise.all([
      transaction.get(associationRef),
      transaction.get(articleRef),
      transaction.get(balanceRef),
      transaction.get(progressRef),
      transaction.get(idempotencyRef),
    ])
    console.info("[stock:auto-simple] stock documents read", {
      associationPath: associationRef.path,
      associationExists: associationSnapshot.exists(),
      articlePath: articleRef.path,
      articleExists: articleSnapshot.exists(),
      balancePath: balanceRef.path,
      balanceExists: balanceSnapshot.exists(),
      progressPath: progressRef.path,
      progressExists: progressSnapshot.exists(),
      idempotencyPath: idempotencyRef.path,
      idempotencyExists: idempotencySnapshot.exists(),
    })

    if (
      !associationSnapshot.exists()
      || associationSnapshot.data().status !== "active"
      || String(associationSnapshot.data().productId ?? "") !== productId
      || String(associationSnapshot.data().articleId ?? "") !== articleId
    ) {
      markLineServed(transaction, {
        orderRef,
        orderItemRef,
        embeddedItems,
        embeddedIndex,
        requestedServedQuantity,
        orderedQuantity,
        actorId: input.actorId,
      })
      return warningResult(
        requestedServedQuantity,
        "Produit servi, mais aucune association d’inventaire active n’a été trouvée."
      )
    }
    if (
      !articleSnapshot.exists()
      || articleSnapshot.data().status !== "active"
      || articleSnapshot.data().trackingMode !== "AUTOMATIC_SIMPLE"
    ) {
      markLineServed(transaction, {
        orderRef,
        orderItemRef,
        embeddedItems,
        embeddedIndex,
        requestedServedQuantity,
        orderedQuantity,
        actorId: input.actorId,
      })
      return warningResult(
        requestedServedQuantity,
        "Produit servi, mais l’article lié n’autorise pas la déduction automatique."
      )
    }
    if (!balanceSnapshot.exists()) {
      throw new Error("Balance de stock introuvable.")
    }

    const processedServedQuantity = progressSnapshot.exists()
      ? Number(progressSnapshot.data().servedQuantity ?? 0)
      : 0
    const quantityPerSale = Number(associationSnapshot.data().quantity ?? 0)
    const { servedDelta, quantityToDeduct } = calculateServedDelta({
      orderedQuantity,
      requestedServedQuantity,
      processedServedQuantity,
      quantityPerSale,
    })
    if (idempotencySnapshot.exists() || servedDelta === 0) {
      return {
        servedQuantity: requestedServedQuantity,
        deductedQuantity: 0,
        replayed: true,
      }
    }

    const balance = balanceSnapshot.data()
    const quantityBefore = Number(balance.quantity ?? 0)
    const quantityAfter = quantityBefore - quantityToDeduct
    console.info("[stock:auto-simple] deduction calculated", {
      articleId,
      quantityBefore,
      requestedServedQuantity,
      processedServedQuantity,
      quantityPerSale,
      quantityToDeduct,
      quantityAfter,
    })
    if (quantityAfter < 0) {
      markLineServed(transaction, {
        orderRef,
        orderItemRef,
        embeddedItems,
        embeddedIndex,
        requestedServedQuantity,
        orderedQuantity,
        actorId: input.actorId,
      })
      return warningResult(
        requestedServedQuantity,
        "Produit servi, mais le stock disponible est insuffisant pour appliquer la déduction."
      )
    }

    const now = Timestamp.now()
    markLineServed(transaction, {
      orderRef,
      orderItemRef,
      embeddedItems,
      embeddedIndex,
      requestedServedQuantity,
      orderedQuantity,
      actorId: input.actorId,
      servedAt: now,
    })
    transaction.update(balanceRef, {
      quantity: quantityAfter,
      version: Number(balance.version ?? 0) + 1,
      lastOperationAt: now,
      lastOperationId: eventId,
    })
    transaction.set(operationRef, {
      restaurantId: input.restaurantId,
      articleId,
      productId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      associationId,
      type: "AUTOMATIC_DEDUCTION",
      quantityBefore,
      quantityAfter,
      variation: -quantityToDeduct,
      unit: String(associationSnapshot.data().unit ?? balance.unit ?? ""),
      servedQuantityBefore: processedServedQuantity,
      servedQuantityAfter: requestedServedQuantity,
      quantityPerSale,
      businessReference: input.orderId,
      idempotencyKey: eventId,
      occurredAt: now,
      createdAt: now,
      createdBy: input.actorId,
    })
    transaction.set(progressRef, {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      productId,
      articleId,
      associationId,
      servedQuantity: requestedServedQuantity,
      lastOperationId: eventId,
      updatedAt: now,
      updatedBy: input.actorId,
    })
    transaction.set(idempotencyRef, {
      restaurantId: input.restaurantId,
      articleId,
      operationId: eventId,
      fingerprint: [
        input.orderId,
        input.orderItemId,
        articleId,
        requestedServedQuantity,
        quantityToDeduct,
      ].join("|"),
      createdAt: now,
      createdBy: input.actorId,
    })
    console.info("[stock:auto-simple] transaction writes queued", {
      balancePath: balanceRef.path,
      operationPath: operationRef.path,
      progressPath: progressRef.path,
      idempotencyPath: idempotencyRef.path,
      quantityBefore,
      quantityAfter,
    })
    return {
      servedQuantity: requestedServedQuantity,
      deductedQuantity: quantityToDeduct,
      replayed: false,
      operationId: eventId,
      previousQuantity: quantityBefore,
      newQuantity: quantityAfter,
    }
  })
}

function markLineServed(
  transaction: Transaction,
  input: {
    orderRef: ReturnType<typeof doc>
    orderItemRef: ReturnType<typeof doc>
    embeddedItems: any[]
    embeddedIndex: number
    requestedServedQuantity: number
    orderedQuantity: number
    actorId: string
    servedAt?: Timestamp
  }
) {
  const servedAt = input.servedAt ?? Timestamp.now()
  const lineUpdate = {
    servedQuantity: input.requestedServedQuantity,
    status: input.requestedServedQuantity >= input.orderedQuantity ? "served" : "preparing",
    servedAt,
    servedBy: input.actorId,
  }
  transaction.update(input.orderItemRef, lineUpdate)
  if (input.embeddedIndex >= 0) {
    const nextItems = input.embeddedItems.map((item, index) =>
      index === input.embeddedIndex ? { ...item, ...lineUpdate } : item
    )
    transaction.update(input.orderRef, { items: nextItems, updatedAt: servedAt })
  }
}

function stableOrderItemId(item: any, index: number) {
  return String(item?.id ?? item?.orderItemId ?? `${item?.productId ?? "item"}-${index}`)
}

function normalizedServedQuantity(item: any) {
  const explicit = Number(item?.servedQuantity)
  if (Number.isFinite(explicit) && explicit >= 0) return explicit
  return String(item?.status ?? "").toLowerCase() === "served"
    ? Number(item?.quantity ?? 0)
    : 0
}

function warningResult(servedQuantity: number, warning: string): ServedStockResult {
  return {
    servedQuantity,
    deductedQuantity: 0,
    replayed: false,
    warning,
  }
}
