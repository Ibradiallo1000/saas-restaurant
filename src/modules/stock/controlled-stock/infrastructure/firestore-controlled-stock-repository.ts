"use client"

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
} from "firebase/firestore"

import { ControlledStockError } from "../domain/errors"
import type {
  ControlledStockBalance,
  ControlledStockOperation,
  ControlledStockOperationCost,
  OperationListQuery,
  OperationResult,
  OperationWrite,
  StockOperationPage,
} from "../domain/models"
import type { ControlledStockRepository } from "../application/repositories"

const BALANCES = "stockBalancesV2"
const OPERATIONS = "stockOperationsV2"
const COSTS = "stockOperationCostsV2"
const IDEMPOTENCY = "stockIdempotencyV2"
const ARTICLES = "stockItemsV2"

export class FirestoreControlledStockRepository
  implements ControlledStockRepository
{
  constructor(private readonly db: Firestore) {}

  async getBalance(restaurantId: string, articleId: string) {
    const snapshot = await getDoc(this.balanceRef(restaurantId, articleId))
    return snapshot.exists()
      ? deserializeBalance(snapshot.data())
      : null
  }

  async applyAtomic(write: OperationWrite): Promise<OperationResult> {
    const restaurantId = String(write.operation.restaurantId)
    const articleId = String(write.operation.articleId)
    const idempotencyRef = doc(
      this.db,
      "restaurants",
      restaurantId,
      IDEMPOTENCY,
      encodeURIComponent(write.operation.idempotencyKey)
    )
    const operationRef = doc(
      this.db,
      "restaurants",
      restaurantId,
      OPERATIONS,
      write.operation.id
    )
    const balanceRef = this.balanceRef(restaurantId, articleId)
    const articleRef = doc(
      this.db,
      "restaurants",
      restaurantId,
      ARTICLES,
      articleId
    )
    const costRef = doc(
      this.db,
      "restaurants",
      restaurantId,
      COSTS,
      write.operation.id
    )

    return runTransaction(this.db, async (transaction) => {
      const idempotencySnapshot = await transaction.get(idempotencyRef)
      if (idempotencySnapshot.exists()) {
        const record = idempotencySnapshot.data()
        if (record.fingerprint !== fingerprint(write.operation)) {
          throw new ControlledStockError(
            "CONTROLLED_STOCK_IDEMPOTENCY_REUSED",
            "Cette clé d’idempotence appartient à une autre opération."
          )
        }
        const existingOperation = await transaction.get(
          doc(
            this.db,
            "restaurants",
            restaurantId,
            OPERATIONS,
            String(record.operationId)
          )
        )
        const existingBalance = await transaction.get(balanceRef)
        if (!existingOperation.exists() || !existingBalance.exists()) {
          throw new ControlledStockError(
            "CONTROLLED_STOCK_CONFLICT",
            "Résultat idempotent incomplet."
          )
        }
        return {
          operation: deserializeOperation(
            existingOperation.id,
            existingOperation.data()
          ),
          balance: deserializeBalance(existingBalance.data()),
          replayed: true,
        }
      }

      const [articleSnapshot, balanceSnapshot] = await Promise.all([
        transaction.get(articleRef),
        transaction.get(balanceRef),
      ])
      if (!articleSnapshot.exists()) {
        throw new ControlledStockError(
          "CONTROLLED_STOCK_ARTICLE_NOT_FOUND",
          "Article introuvable."
        )
      }
      const article = articleSnapshot.data()
      if (article.status !== "active") {
        throw new ControlledStockError(
          "CONTROLLED_STOCK_ARTICLE_ARCHIVED",
          "Article archivé."
        )
      }
      if (article.trackingMode === "NONE") {
        throw new ControlledStockError(
          "CONTROLLED_STOCK_TRACKING_DISABLED",
          "Article sans suivi quantitatif."
        )
      }
      const current = balanceSnapshot.exists()
        ? deserializeBalance(balanceSnapshot.data())
        : null
      const currentQuantity = current?.quantity ?? 0
      const currentVersion = current?.version ?? 0
      if (
        write.operation.expectedVersion !== currentVersion ||
        write.operation.quantityBefore !== currentQuantity ||
        write.balance.version !== currentVersion + 1
      ) {
        throw new ControlledStockError(
          "CONTROLLED_STOCK_CONFLICT",
          "Le stock a changé. Rechargez avant de recommencer."
        )
      }
      if (
        write.operation.quantityAfter < 0 ||
        write.balance.quantity !== write.operation.quantityAfter
      ) {
        throw new ControlledStockError(
          "CONTROLLED_STOCK_CONFLICT",
          "Solde incohérent."
        )
      }

      transaction.set(operationRef, serializeOperation(write.operation))
      transaction.set(balanceRef, {
        ...serializeBalance(write.balance),
        lastOperationId: write.operation.id,
      })
      transaction.set(idempotencyRef, {
        restaurantId,
        articleId,
        operationId: write.operation.id,
        fingerprint: fingerprint(write.operation),
        createdAt: String(write.operation.createdAt),
        createdBy: String(write.operation.createdBy),
      })
      if (write.cost) transaction.set(costRef, serializeCost(write.cost))
      return {
        operation: write.operation,
        balance: write.balance,
        replayed: false,
        ...(write.cost ? { cost: write.cost } : {}),
      }
    })
  }

  async listOperations(
    query: OperationListQuery
  ): Promise<StockOperationPage> {
    const snapshot = await getDocs(
      collection(
        this.db,
        "restaurants",
        query.restaurantId,
        OPERATIONS
      )
    )
    let items = snapshot.docs.map((entry) =>
      deserializeOperation(entry.id, entry.data())
    )
    if (query.articleId) {
      items = items.filter(
        (item) => String(item.articleId) === query.articleId
      )
    }
    if (query.type && query.type !== "ALL") {
      items = items.filter((item) => item.type === query.type)
    }
    if (query.from) {
      items = items.filter(
        (item) => String(item.occurredAt) >= String(query.from)
      )
    }
    if (query.to) {
      items = items.filter(
        (item) => String(item.occurredAt) <= String(query.to)
      )
    }
    items.sort((left, right) =>
      String(right.occurredAt).localeCompare(String(left.occurredAt))
    )
    const total = items.length
    const size = Math.min(100, Math.max(1, query.pageSize ?? 25))
    const cursorIndex = query.cursor
      ? items.findIndex((item) => item.id === query.cursor)
      : -1
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0
    const page = items.slice(start, start + size)
    return {
      items: page,
      total,
      nextCursor:
        start + size < total && page.length > 0
          ? page[page.length - 1].id
          : null,
    }
  }

  private balanceRef(restaurantId: string, articleId: string) {
    return doc(
      this.db,
      "restaurants",
      restaurantId,
      BALANCES,
      articleId
    )
  }
}

function fingerprint(operation: ControlledStockOperation) {
  return [
    operation.type,
    operation.articleId,
    operation.variation,
    operation.observedQuantity ?? "",
    operation.reason ?? "",
    operation.businessReference ?? "",
    operation.originalOperationId ?? "",
  ].join("|")
}

function serializeBalance(balance: ControlledStockBalance) {
  return {
    restaurantId: String(balance.restaurantId),
    articleId: String(balance.articleId),
    quantity: balance.quantity,
    unit: balance.unit,
    version: balance.version,
    lastOperationAt: String(balance.lastOperationAt),
    lastControlAt: balance.lastControlAt
      ? String(balance.lastControlAt)
      : null,
    lastSupplyAt: balance.lastSupplyAt
      ? String(balance.lastSupplyAt)
      : null,
  }
}

function deserializeBalance(data: any): ControlledStockBalance {
  return {
    restaurantId: String(data.restaurantId) as ControlledStockBalance["restaurantId"],
    articleId: String(data.articleId) as ControlledStockBalance["articleId"],
    quantity: Number(data.quantity),
    unit: data.unit,
    version: Number(data.version),
    lastOperationAt: String(data.lastOperationAt) as ControlledStockBalance["lastOperationAt"],
    ...(data.lastControlAt
      ? {
          lastControlAt: String(
            data.lastControlAt
          ) as NonNullable<ControlledStockBalance["lastControlAt"]>,
        }
      : {}),
    ...(data.lastSupplyAt
      ? {
          lastSupplyAt: String(
            data.lastSupplyAt
          ) as NonNullable<ControlledStockBalance["lastSupplyAt"]>,
        }
      : {}),
  }
}

function serializeOperation(operation: ControlledStockOperation) {
  return {
    ...operation,
    restaurantId: String(operation.restaurantId),
    articleId: String(operation.articleId),
    createdBy: String(operation.createdBy),
    occurredAt: String(operation.occurredAt),
    createdAt: String(operation.createdAt),
  }
}

function deserializeOperation(
  id: string,
  data: any
): ControlledStockOperation {
  return {
    ...data,
    id,
    restaurantId: String(data.restaurantId),
    articleId: String(data.articleId),
    createdBy: String(data.createdBy),
    occurredAt: String(data.occurredAt),
    createdAt: String(data.createdAt),
  } as ControlledStockOperation
}

function serializeCost(cost: ControlledStockOperationCost) {
  return {
    restaurantId: String(cost.restaurantId),
    operationId: cost.operationId,
    totalCost: cost.totalCost,
    unitCost: cost.unitCost,
    updatedAt: String(cost.updatedAt),
    updatedBy: String(cost.updatedBy),
  }
}
