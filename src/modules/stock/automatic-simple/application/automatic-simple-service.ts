import type { StockPrincipal } from "../../core/permissions"
import { ControlledStockService } from "../../controlled-stock/application/controlled-stock-service.ts"
import { ControlledStockError } from "../../controlled-stock/domain/errors.ts"
import type {
  AutomaticActivationConfiguration,
  AutomaticAssociation,
  AutomaticAssociationInput,
  AutomaticEventResult,
  ConfirmedSaleEvent,
} from "../domain/models"
import type { AutomaticSimpleDependencies } from "./repositories"
import { assertAutomaticAction } from "./authorization.ts"

export class AutomaticSimpleService {
  private readonly dependencies: AutomaticSimpleDependencies
  private readonly stockService: ControlledStockService
  private readonly now: () => string

  constructor(
    dependencies: AutomaticSimpleDependencies,
    options: { now?: () => string; createId?: () => string } = {}
  ) {
    this.dependencies = dependencies
    this.now = options.now ?? (() => new Date().toISOString())
    this.stockService = new ControlledStockService({
      articles: dependencies.articles,
      stock: dependencies.stock,
      now: options.now,
      createId: options.createId,
    })
  }

  async createAssociation(input: AutomaticAssociationInput, principal: StockPrincipal) {
    assertAutomaticAction(principal, "create_association", input.restaurantId)
    await this.assertCompatible(input)
    const timestamp = this.now()
    const association: AutomaticAssociation = {
      id: associationId(input.productId, input.articleId),
      restaurantId: input.restaurantId,
      productId: input.productId.trim(),
      articleId: input.articleId.trim(),
      quantity: positive(input.quantity),
      unit: input.unit,
      status: "active",
      createdAt: timestamp,
      createdBy: input.actorId,
      updatedAt: timestamp,
      updatedBy: input.actorId,
    }
    await this.dependencies.associations.save(association)
    return association
  }

  async updateAssociation(
    restaurantId: string,
    associationIdValue: string,
    values: Pick<AutomaticAssociationInput, "quantity" | "unit" | "actorId">,
    principal: StockPrincipal
  ) {
    assertAutomaticAction(principal, "update_association", restaurantId)
    const current = await this.requireAssociation(restaurantId, associationIdValue)
    await this.assertCompatible({ ...current, ...values })
    const updated = {
      ...current,
      quantity: positive(values.quantity),
      unit: values.unit,
      updatedAt: this.now(),
      updatedBy: values.actorId,
    }
    await this.dependencies.associations.save(updated)
    return updated
  }

  async disableAssociation(
    restaurantId: string,
    associationIdValue: string,
    actorId: string,
    principal: StockPrincipal
  ) {
    assertAutomaticAction(principal, "disable_association", restaurantId)
    const current = await this.requireAssociation(restaurantId, associationIdValue)
    const updated: AutomaticAssociation = {
      ...current,
      status: "inactive",
      updatedAt: this.now(),
      updatedBy: actorId,
    }
    await this.dependencies.associations.save(updated)
    return updated
  }

  async listAssociations(restaurantId: string, principal: StockPrincipal) {
    assertAutomaticAction(principal, "read_associations", restaurantId)
    return this.dependencies.associations.list(restaurantId)
  }

  async processConfirmedSale(
    event: ConfirmedSaleEvent,
    principal: StockPrincipal,
    activation: AutomaticActivationConfiguration
  ): Promise<AutomaticEventResult> {
    if (event.status !== "PAYMENT_CONFIRMED") {
      return { saleAllowed: true, ignored: true, operations: [], anomalies: [] }
    }
    if (!isAutomaticSimpleEnabled(event.restaurantId, activation)) {
      return { saleAllowed: true, ignored: true, operations: [], anomalies: [] }
    }
    assertAutomaticAction(principal, "create_association", event.restaurantId)
    const operations: string[] = []
    const anomalies: AutomaticEventResult["anomalies"][number][] = []
    for (const line of event.lines) {
      if (!line.productId || line.quantity <= 0) continue
      const associations = await this.dependencies.associations.listActiveByProduct(
        event.restaurantId,
        line.productId
      )
      for (const association of associations) {
        if (!isAutomaticArticleEnabled(association.articleId, activation.articleAllowlist)) continue
        const article = await this.dependencies.articles.getById(
          event.restaurantId,
          association.articleId,
          { includeCost: false }
        )
        if (!article || article.status !== "active" || article.trackingMode !== "AUTOMATIC_SIMPLE") {
          anomalies.push({
            type: "INVALID_ASSOCIATION",
            articleId: association.articleId,
            productId: line.productId,
            reference: event.reference,
            message: "Association devenue incompatible.",
          })
          continue
        }
        const requested = association.quantity * line.quantity
        const balance = await this.dependencies.stock.getBalance(event.restaurantId, association.articleId)
        if (!balance || balance.quantity < requested) {
          anomalies.push({
            type: "INSUFFICIENT_STOCK",
            articleId: association.articleId,
            productId: line.productId,
            reference: event.reference,
            message: "Stock insuffisant : vente conservée, déduction non appliquée.",
          })
          continue
        }
        const result = await this.stockService.recordAutomaticDeduction({
          restaurantId: event.restaurantId,
          articleId: association.articleId,
          productId: line.productId,
          quantity: requested,
          unit: association.unit,
          businessReference: event.reference,
          occurredAt: event.occurredAt,
          actorId: event.actorId,
          idempotencyKey: `automatic-deduction:${event.reference}:${association.id}`,
          expectedVersion: balance.version,
        }, principal)
        operations.push(result.operation.id)
      }
    }
    return { saleAllowed: true, ignored: false, operations, anomalies }
  }

  async compensate(
    event: ConfirmedSaleEvent,
    originalReference: string,
    principal: StockPrincipal,
    activation: AutomaticActivationConfiguration
  ): Promise<AutomaticEventResult> {
    assertAutomaticAction(principal, "compensate", event.restaurantId)
    if (!isAutomaticSimpleEnabled(event.restaurantId, activation)) {
      return { saleAllowed: true, ignored: true, operations: [], anomalies: [] }
    }
    const history = await this.dependencies.stock.listOperations({
      restaurantId: event.restaurantId,
      pageSize: 100,
    })
    const originals = history.items.filter(
      (item) => item.type === "AUTOMATIC_DEDUCTION"
        && item.businessReference === originalReference
    )
    const operations: string[] = []
    for (const original of originals) {
      const balance = await this.dependencies.stock.getBalance(
        event.restaurantId,
        String(original.articleId)
      )
      const result = await this.stockService.recordAutomaticCompensation({
        restaurantId: event.restaurantId,
        articleId: String(original.articleId),
        productId: String(original.productId),
        quantity: Math.abs(original.variation),
        unit: original.unit,
        businessReference: event.reference,
        originalOperationId: original.id,
        occurredAt: event.occurredAt,
        actorId: event.actorId,
        idempotencyKey: `automatic-compensation:${original.id}`,
        expectedVersion: balance?.version ?? 0,
      }, principal)
      operations.push(result.operation.id)
    }
    return { saleAllowed: true, ignored: originals.length === 0, operations, anomalies: [] }
  }

  private async assertCompatible(input: AutomaticAssociationInput) {
    const quantity = positive(input.quantity)
    if (!input.productId.trim() || !input.articleId.trim() || !input.unit.trim() || !quantity) {
      throw new ControlledStockError("CONTROLLED_STOCK_INVALID_INPUT", "Association invalide.")
    }
    const [article, productExists] = await Promise.all([
      this.dependencies.articles.getById(input.restaurantId, input.articleId, { includeCost: false }),
      this.dependencies.products.exists(input.restaurantId, input.productId),
    ])
    if (!productExists) throw new ControlledStockError("CONTROLLED_STOCK_INVALID_INPUT", "Produit introuvable.")
    if (!article) throw new ControlledStockError("CONTROLLED_STOCK_ARTICLE_NOT_FOUND", "Article introuvable.")
    if (String(article.restaurantId) !== input.restaurantId) {
      throw new ControlledStockError("CONTROLLED_STOCK_RESTAURANT_MISMATCH", "Article hors restaurant.")
    }
    if (article.status !== "active") throw new ControlledStockError("CONTROLLED_STOCK_ARTICLE_ARCHIVED", "Article archivé.")
    if (article.trackingMode !== "AUTOMATIC_SIMPLE") {
      throw new ControlledStockError("CONTROLLED_STOCK_TRACKING_DISABLED", "Article incompatible.")
    }
    if (article.baseUnit !== input.unit) {
      throw new ControlledStockError("CONTROLLED_STOCK_INCOMPATIBLE_UNIT", "Unité incompatible.")
    }
  }

  private async requireAssociation(restaurantId: string, id: string) {
    const association = await this.dependencies.associations.getById(restaurantId, id)
    if (!association) throw new ControlledStockError("CONTROLLED_STOCK_INVALID_INPUT", "Association introuvable.")
    return association
  }
}

export function isAutomaticSimpleEnabled(
  restaurantId: string,
  configuration: AutomaticActivationConfiguration
) {
  return configuration.enabled && configuration.restaurantAllowlist.includes(restaurantId)
}

export function associationId(productId: string, articleId: string) {
  return `${encodeURIComponent(productId)}--${encodeURIComponent(articleId)}`
}

export function validateAutomaticActivation(input: {
  restaurantId: string
  articleId: string
  trackingMode: string
  status: string
  hasValidBalance: boolean
  associations: readonly AutomaticAssociation[]
  configuration: AutomaticActivationConfiguration
}) {
  if (!isAutomaticSimpleEnabled(input.restaurantId, input.configuration)) {
    return { allowed: false as const, reason: "Restaurant hors pilote." }
  }
  if (!isAutomaticArticleEnabled(input.articleId, input.configuration.articleAllowlist)) {
    return { allowed: false as const, reason: "Article hors périmètre pilote." }
  }
  if (input.trackingMode !== "AUTOMATIC_SIMPLE" || input.status !== "active") {
    return { allowed: false as const, reason: "Article incompatible." }
  }
  if (!input.hasValidBalance) {
    return { allowed: false as const, reason: "Quantité V2 absente." }
  }
  const active = input.associations.filter(
    (item) => item.status === "active" && item.articleId === input.articleId
  )
  if (active.length === 0) {
    return { allowed: false as const, reason: "Association absente." }
  }
  if (new Set(active.map((item) => item.productId)).size !== active.length) {
    return { allowed: false as const, reason: "Associations ambiguës." }
  }
  return { allowed: true as const }
}

function isAutomaticArticleEnabled(articleId: string, allowlist: readonly string[]) {
  return allowlist.length === 0 || allowlist.includes(articleId)
}

function positive(value: unknown) {
  const result = Number(value)
  if (!Number.isFinite(result) || result <= 0) {
    throw new ControlledStockError("CONTROLLED_STOCK_INVALID_INPUT", "La quantité doit être positive.")
  }
  return result
}
