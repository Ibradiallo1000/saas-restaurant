import {
  capabilitiesForControlledStockRole,
} from "../../../src/modules/stock/controlled-stock/application/authorization.ts"
import { ControlledStockError } from "../../../src/modules/stock/controlled-stock/domain/errors.ts"
import { InMemoryArticleRepository } from "../articles/article-test-kit.mjs"

export class InMemoryControlledStockRepository {
  balances = new Map()
  operations = []
  idempotency = new Map()
  writes = 0

  async getBalance(restaurantId, articleId) {
    return clone(this.balances.get(key(restaurantId, articleId))) ?? null
  }

  async applyAtomic(write) {
    const idemKey = `${write.operation.restaurantId}::${write.operation.idempotencyKey}`
    const fingerprint = operationFingerprint(write.operation)
    const existing = this.idempotency.get(idemKey)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ControlledStockError(
          "CONTROLLED_STOCK_IDEMPOTENCY_REUSED",
          "Clé réutilisée."
        )
      }
      return { ...clone(existing.result), replayed: true }
    }
    const balanceKey = key(write.operation.restaurantId, write.operation.articleId)
    const current = this.balances.get(balanceKey)
    const currentVersion = current?.version ?? 0
    const currentQuantity = current?.quantity ?? 0
    if (
      write.operation.expectedVersion !== currentVersion ||
      write.operation.quantityBefore !== currentQuantity
    ) {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_CONFLICT",
        "Conflit."
      )
    }
    const result = {
      operation: clone(write.operation),
      balance: clone(write.balance),
      replayed: false,
      ...(write.cost ? { cost: clone(write.cost) } : {}),
    }
    this.operations.push(clone(write.operation))
    this.balances.set(balanceKey, clone(write.balance))
    this.idempotency.set(idemKey, {
      fingerprint,
      result: clone(result),
    })
    this.writes += 1
    return result
  }

  async listOperations(query) {
    let items = this.operations.filter(
      (item) => String(item.restaurantId) === query.restaurantId
    )
    if (query.articleId) {
      items = items.filter((item) => String(item.articleId) === query.articleId)
    }
    if (query.type && query.type !== "ALL") {
      items = items.filter((item) => item.type === query.type)
    }
    if (query.from) items = items.filter((item) => item.occurredAt >= query.from)
    if (query.to) items = items.filter((item) => item.occurredAt <= query.to)
    items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    const total = items.length
    const cursorIndex = query.cursor
      ? items.findIndex((item) => item.id === query.cursor)
      : -1
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0
    const size = query.pageSize ?? 25
    const page = items.slice(start, start + size)
    return {
      items: clone(page),
      total,
      nextCursor:
        start + size < total && page.length ? page[page.length - 1].id : null,
    }
  }
}

export function setupArticles(overrides = {}) {
  const articles = new InMemoryArticleRepository()
  const article = {
    id: "article-1",
    restaurantId: "restaurant-a",
    name: "Riz",
    baseUnit: "kg",
    packagings: [
      {
        id: "bag-25",
        kind: "bag",
        name: "Sac de 25 kg",
        quantity: 25,
        targetUnit: "kg",
        active: true,
      },
    ],
    lowStockThreshold: 5,
    outOfStockThreshold: 0,
    trackingMode: "CONTROLLED",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "actor-a",
    updatedBy: "actor-a",
    ...overrides,
  }
  articles.items.set(key(article.restaurantId, article.id), article)
  return { articles, article }
}

export function buildStockPrincipal(
  restaurantId = "restaurant-a",
  role = "manager"
) {
  return {
    actorId: "actor-a",
    role,
    capabilities: capabilitiesForControlledStockRole(role),
    scope: { restaurantId },
  }
}

export function supplyInput(overrides = {}) {
  return {
    restaurantId: "restaurant-a",
    articleId: "article-1",
    quantity: 10,
    unit: "kg",
    occurredAt: "2026-01-02T10:00:00.000Z",
    actorId: "actor-a",
    idempotencyKey: "supply-1",
    ...overrides,
  }
}

function operationFingerprint(operation) {
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

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

function key(restaurantId, articleId) {
  return `${restaurantId}::${articleId}`
}
