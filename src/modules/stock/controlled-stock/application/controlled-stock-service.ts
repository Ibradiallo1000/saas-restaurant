import type { StockPrincipal } from "../../core/permissions"
import type {
  ActorId,
  IsoDateTime,
  RestaurantId,
  StockItemId,
} from "../../core/value-objects"
import type { ArticleRepository } from "../../articles/application/repositories"
import type { StockArticle } from "../../articles/domain/article"
import { ControlledStockError } from "../domain/errors.ts"
import type {
  ControlledStockBalance,
  ControlledStockOperation,
  AutomaticCompensationInput,
  AutomaticDeductionInput,
  CorrectionInput,
  LossInput,
  OperationListQuery,
  OperationResult,
  OperationWrite,
  PhysicalControlInput,
  SupplyInput,
} from "../domain/models"
import {
  assertQuantitativeArticle,
  nonNegative,
  optionalNonNegative,
  positive,
  requiredText,
  toBaseQuantity,
  validateLossReason,
  validateUnit,
  varianceType,
} from "../domain/validation.ts"
import {
  assertControlledStockAuthorization,
  canPerformControlledStockAction,
} from "./authorization.ts"
import type { ControlledStockRepository } from "./repositories"

export interface ControlledStockServiceDependencies {
  readonly articles: ArticleRepository
  readonly stock: ControlledStockRepository
  readonly now?: () => string
  readonly createId?: () => string
}

export class ControlledStockService {
  private readonly dependencies: ControlledStockServiceDependencies
  private readonly now: () => string
  private readonly createId: () => string

  constructor(dependencies: ControlledStockServiceDependencies) {
    this.dependencies = dependencies
    this.now = dependencies.now ?? (() => new Date().toISOString())
    this.createId =
      dependencies.createId ??
      (() => `stock-operation-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  }

  async recordSupply(
    input: SupplyInput,
    principal: StockPrincipal
  ): Promise<OperationResult> {
    assertControlledStockAuthorization(principal, "supply", input.restaurantId)
    const article = await this.requireArticle(input.restaurantId, input.articleId)
    const quantity = positive(input.quantity, "quantity")
    const unit = validateUnit(input.unit)
    const converted = toBaseQuantity(
      quantity,
      unit,
      article,
      input.packagingId
    )
    const totalCost = optionalNonNegative(input.totalCost, "totalCost")
    return this.applyVariation({
      article,
      principal,
      type: "APPROVISIONNEMENT",
      variation: converted,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      note: input.note,
      reference: input.reference,
      packagingId: input.packagingId,
      supplierId: input.supplierId,
      expenseId: input.expenseId,
      ...(totalCost === undefined
        ? {}
        : {
            cost: {
              totalCost,
              unitCost: totalCost / converted,
            },
          }),
    })
  }

  async recordPhysicalControl(
    input: PhysicalControlInput,
    principal: StockPrincipal
  ) {
    assertControlledStockAuthorization(principal, "control", input.restaurantId)
    const article = await this.requireArticle(input.restaurantId, input.articleId)
    if (article.trackingMode !== "CONTROLLED") {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_INVALID_INPUT",
        "Seuls les articles en contrôle manuel peuvent être contrôlés."
      )
    }
    const observed = nonNegative(input.observedQuantity, "observedQuantity")
    const unit = validateUnit(input.unit)
    const converted = toBaseQuantity(observed, unit, article)
    const balance = await this.getBalanceOrZero(article)
    const variation = converted - balance.quantity
    return this.applyVariation({
      article,
      principal,
      type: "CONTROLE_PHYSIQUE",
      variation,
      forcedQuantityAfter: converted,
      observedQuantity: converted,
      varianceType: varianceType(variation),
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion ?? balance.version,
      note: input.note,
    })
  }

  async recordLoss(input: LossInput, principal: StockPrincipal) {
    assertControlledStockAuthorization(principal, "loss", input.restaurantId)
    const article = await this.requireArticle(input.restaurantId, input.articleId)
    const quantity = toBaseQuantity(
      positive(input.quantity, "quantity"),
      validateUnit(input.unit),
      article
    )
    return this.applyVariation({
      article,
      principal,
      type: "PERTE",
      variation: -quantity,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      reason: validateLossReason(input.reason),
      note: input.note,
    })
  }

  async recordCorrection(
    input: CorrectionInput,
    principal: StockPrincipal
  ) {
    assertControlledStockAuthorization(
      principal,
      "correction",
      input.restaurantId
    )
    const article = await this.requireArticle(input.restaurantId, input.articleId)
    const amount = toBaseQuantity(
      positive(input.quantity, "quantity"),
      validateUnit(input.unit),
      article
    )
    const justification = requiredText(input.justification, "justification")
    return this.applyVariation({
      article,
      principal,
      type:
        input.direction === "POSITIVE"
          ? "CORRECTION_POSITIVE"
          : "CORRECTION_NEGATIVE",
      variation: input.direction === "POSITIVE" ? amount : -amount,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      reason: justification,
    })
  }

  async recordAutomaticDeduction(
    input: AutomaticDeductionInput,
    principal: StockPrincipal
  ) {
    assertControlledStockAuthorization(principal, "automatic_deduction", input.restaurantId)
    const article = await this.requireAutomaticArticle(input.restaurantId, input.articleId)
    const amount = toBaseQuantity(
      positive(input.quantity, "quantity"),
      validateUnit(input.unit),
      article
    )
    return this.applyVariation({
      article,
      principal,
      type: "AUTOMATIC_DEDUCTION",
      variation: -amount,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      productId: requiredText(input.productId, "productId"),
      businessReference: requiredText(input.businessReference, "businessReference"),
      origin: "SYSTEM",
    })
  }

  async recordAutomaticCompensation(
    input: AutomaticCompensationInput,
    principal: StockPrincipal
  ) {
    assertControlledStockAuthorization(principal, "automatic_compensation", input.restaurantId)
    const article = await this.requireAutomaticArticle(input.restaurantId, input.articleId)
    const amount = toBaseQuantity(
      positive(input.quantity, "quantity"),
      validateUnit(input.unit),
      article
    )
    return this.applyVariation({
      article,
      principal,
      type: "AUTOMATIC_COMPENSATION",
      variation: amount,
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      productId: requiredText(input.productId, "productId"),
      businessReference: requiredText(input.businessReference, "businessReference"),
      originalOperationId: requiredText(input.originalOperationId, "originalOperationId"),
      origin: "SYSTEM",
    })
  }

  async getCurrentQuantity(
    restaurantId: string,
    articleId: string,
    principal: StockPrincipal
  ) {
    assertControlledStockAuthorization(principal, "read", restaurantId)
    const article = await this.requireArticle(restaurantId, articleId)
    return this.getBalanceOrZero(article)
  }

  async getArticleHistory(
    query: OperationListQuery,
    principal: StockPrincipal
  ) {
    assertControlledStockAuthorization(principal, "history", query.restaurantId)
    return this.dependencies.stock.listOperations(query)
  }

  async listOperations(
    query: OperationListQuery,
    principal: StockPrincipal
  ) {
    return this.getArticleHistory(query, principal)
  }

  private async requireArticle(restaurantId: string, articleId: string) {
    const article = await this.dependencies.articles.getById(
      restaurantId,
      articleId,
      { includeCost: false }
    )
    if (!article) {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_ARTICLE_NOT_FOUND",
        "Article introuvable."
      )
    }
    if (String(article.restaurantId) !== restaurantId) {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_RESTAURANT_MISMATCH",
        "Article hors du restaurant courant."
      )
    }
    assertQuantitativeArticle(article)
    return article
  }

  private async requireAutomaticArticle(restaurantId: string, articleId: string) {
    const article = await this.requireArticle(restaurantId, articleId)
    if (article.trackingMode !== "AUTOMATIC_SIMPLE") {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_TRACKING_DISABLED",
        "Seul un article en mode automatique simple peut être déduit."
      )
    }
    return article
  }

  private async getBalanceOrZero(
    article: StockArticle
  ): Promise<ControlledStockBalance> {
    return (
      (await this.dependencies.stock.getBalance(
        String(article.restaurantId),
        String(article.id)
      )) ?? {
        restaurantId: article.restaurantId,
        articleId: article.id,
        quantity: 0,
        unit: article.baseUnit,
        version: 0,
        lastOperationAt: this.now() as IsoDateTime,
      }
    )
  }

  private async applyVariation(input: {
    article: StockArticle
    principal: StockPrincipal
    type: ControlledStockOperation["type"]
    variation: number
    forcedQuantityAfter?: number
    observedQuantity?: number
    varianceType?: ControlledStockOperation["varianceType"]
    occurredAt: string
    actorId: string
    idempotencyKey: string
    expectedVersion?: number
    note?: string
    reason?: string
    reference?: string
    packagingId?: string
    supplierId?: string
    expenseId?: string
    productId?: string
    businessReference?: string
    originalOperationId?: string
    origin?: "USER" | "SYSTEM"
    cost?: { totalCost: number; unitCost: number }
  }) {
    const idempotencyKey = requiredText(input.idempotencyKey, "idempotencyKey")
    const occurredAt = requiredText(input.occurredAt, "occurredAt") as IsoDateTime
    const actorId = requiredText(input.actorId, "actorId") as ActorId
    const current = await this.getBalanceOrZero(input.article)
    const expectedVersion = input.expectedVersion ?? current.version
    const quantityAfter =
      input.forcedQuantityAfter ?? current.quantity + input.variation
    if (quantityAfter < 0) {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_INSUFFICIENT_QUANTITY",
        "Cette opération rendrait la quantité négative."
      )
    }
    const createdAt = this.now() as IsoDateTime
    const operation: ControlledStockOperation = {
      id: this.createId(),
      restaurantId: input.article.restaurantId,
      articleId: input.article.id,
      type: input.type,
      quantityBefore: current.quantity,
      variation: input.variation,
      quantityAfter,
      unit: input.article.baseUnit,
      occurredAt,
      createdAt,
      createdBy: actorId,
      idempotencyKey,
      expectedVersion,
      ...(input.note ? { note: input.note.trim() } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.reference ? { reference: input.reference.trim() } : {}),
      ...(input.packagingId ? { packagingId: input.packagingId } : {}),
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      ...(input.expenseId ? { expenseId: input.expenseId } : {}),
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.businessReference ? { businessReference: input.businessReference } : {}),
      ...(input.originalOperationId ? { originalOperationId: input.originalOperationId } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.observedQuantity === undefined
        ? {}
        : { observedQuantity: input.observedQuantity }),
      ...(input.varianceType ? { varianceType: input.varianceType } : {}),
    }
    const balance: ControlledStockBalance = {
      ...current,
      quantity: quantityAfter,
      version: current.version + 1,
      lastOperationAt: occurredAt,
      ...(input.type === "CONTROLE_PHYSIQUE"
        ? { lastControlAt: occurredAt }
        : {}),
      ...(input.type === "APPROVISIONNEMENT"
        ? { lastSupplyAt: occurredAt }
        : {}),
    }
    const write: OperationWrite = {
      operation,
      balance,
      ...(input.cost
        ? {
            cost: {
              restaurantId: input.article.restaurantId,
              operationId: operation.id,
              totalCost: input.cost.totalCost,
              unitCost: input.cost.unitCost,
              updatedAt: createdAt,
              updatedBy: actorId,
            },
          }
        : {}),
    }
    const result = await this.dependencies.stock.applyAtomic(write)
    return canPerformControlledStockAction(
      input.principal,
      "read_cost",
      String(input.article.restaurantId)
    )
      ? result
      : { ...result, cost: undefined }
  }
}
