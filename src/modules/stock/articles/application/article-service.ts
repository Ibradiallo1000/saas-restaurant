import type { StockPrincipal } from "../../core/permissions"
import type {
  ActorId,
  IsoDateTime,
  RestaurantId,
  StockCategoryId,
  StockItemId,
} from "../../core/value-objects"
import type {
  ArticleListQuery,
  CreateArticleInput,
  CreateArticleResult,
  CreateCategoryInput,
  StockArticle,
  StockArticleCategory,
  UpdateArticleInput,
  UpdateCategoryInput,
} from "../domain/article"
import { ArticleDomainError } from "../domain/errors.ts"
import {
  nonNegative,
  optionalText,
  requiredText,
  validateCreateArticle,
  validateCreateCategory,
  validatePackagings,
} from "../domain/validation.ts"
import {
  assertArticleAuthorization,
  canPerformArticleAction,
} from "./authorization.ts"
import type {
  ArticleCategoryRepository,
  ArticleRepository,
} from "./repositories"

export interface ArticleServiceDependencies {
  readonly articles: ArticleRepository
  readonly categories: ArticleCategoryRepository
  readonly now?: () => string
  readonly createId?: () => string
}

export class ArticleService {
  private readonly dependencies: ArticleServiceDependencies
  private readonly now: () => string
  private readonly createId: () => string

  constructor(dependencies: ArticleServiceDependencies) {
    this.dependencies = dependencies
    this.now = dependencies.now ?? (() => new Date().toISOString())
    this.createId =
      dependencies.createId ??
      (() => `article-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  }

  async createArticle(
    input: CreateArticleInput,
    principal: StockPrincipal
  ): Promise<CreateArticleResult> {
    const value = validateCreateArticle(input)
    assertArticleAuthorization(principal, "create", value.restaurantId)
    if (value.referenceCost !== undefined) {
      assertArticleAuthorization(principal, "update_cost", value.restaurantId)
    }
    if (value.packagings.length > 0) {
      assertArticleAuthorization(
        principal,
        "manage_packagings",
        value.restaurantId
      )
    }
    if (value.categoryId) {
      await this.assertActiveCategory(value.restaurantId, value.categoryId)
    }

    const now = this.now() as IsoDateTime
    const article: StockArticle = {
      id: this.createId() as StockItemId,
      restaurantId: value.restaurantId as RestaurantId,
      name: value.name,
      description: value.description,
      ...(value.categoryId
        ? { categoryId: value.categoryId as StockCategoryId }
        : {}),
      baseUnit: value.baseUnit,
      packagings: value.packagings,
      lowStockThreshold: value.lowStockThreshold,
      outOfStockThreshold: value.outOfStockThreshold,
      trackingMode: value.trackingMode,
      ...(value.referenceCost === undefined
        ? {}
        : { referenceCost: value.referenceCost }),
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: value.actorId as ActorId,
      updatedBy: value.actorId as ActorId,
      migration: value.migration,
    }

    await this.dependencies.articles.create(article)

    return { article }
  }

  async updateArticle(
    restaurantId: string,
    articleId: string,
    input: UpdateArticleInput,
    principal: StockPrincipal
  ) {
    assertArticleAuthorization(principal, "update", restaurantId)
    const costTouched =
      input.referenceCost !== undefined || input.removeReferenceCost === true
    const canReadCost = canPerformArticleAction(
      principal,
      "read_cost",
      restaurantId
    )
    const current = await this.requireArticle(
      restaurantId,
      articleId,
      principal,
      canReadCost
    )
    this.assertActive(current)

    if (
      costTouched
    ) {
      assertArticleAuthorization(principal, "update_cost", restaurantId)
    }
    if (input.packagings !== undefined) {
      assertArticleAuthorization(principal, "manage_packagings", restaurantId)
    }

    const baseUnit = input.baseUnit
      ? validateCreateArticle({
          restaurantId,
          actorId: input.actorId,
          name: input.name ?? current.name,
          categoryId: input.categoryId ?? String(current.categoryId ?? ""),
          baseUnit: input.baseUnit,
          lowStockThreshold:
            input.lowStockThreshold ?? current.lowStockThreshold,
          outOfStockThreshold:
            input.outOfStockThreshold ?? current.outOfStockThreshold,
        }).baseUnit
      : current.baseUnit
    const categoryId =
      input.categoryId === undefined
        ? current.categoryId
          ? String(current.categoryId)
          : undefined
        : optionalText(input.categoryId)
    if (categoryId) {
      await this.assertActiveCategory(restaurantId, categoryId)
    }

    const lowStockThreshold = nonNegative(
      input.lowStockThreshold ?? current.lowStockThreshold,
      "lowStockThreshold"
    )
    const outOfStockThreshold = nonNegative(
      input.outOfStockThreshold ?? current.outOfStockThreshold,
      "outOfStockThreshold"
    )
    if (outOfStockThreshold > lowStockThreshold) {
      throw new ArticleDomainError(
        "ARTICLE_INVALID_INPUT",
        "Le seuil de rupture ne peut pas dépasser le seuil de stock faible.",
        "outOfStockThreshold"
      )
    }

    const packagings = input.packagings
      ? validatePackagings(input.packagings, baseUnit)
      : current.packagings
    const nextCost = input.removeReferenceCost
      ? undefined
      : input.referenceCost === undefined
        ? current.referenceCost
        : nonNegative(input.referenceCost, "referenceCost")

    const updated: StockArticle = {
      ...current,
      name:
        input.name === undefined
          ? current.name
          : requiredText(input.name, "name"),
      description:
        input.description === undefined
          ? current.description
          : optionalText(input.description),
      categoryId: categoryId as StockCategoryId | undefined,
      baseUnit,
      packagings,
      lowStockThreshold,
      outOfStockThreshold,
      trackingMode:
        input.trackingMode === undefined
          ? current.trackingMode
          : validateCreateArticle({
              restaurantId,
              actorId: input.actorId,
              name: input.name ?? current.name,
              categoryId,
              baseUnit,
              trackingMode: input.trackingMode,
              lowStockThreshold,
              outOfStockThreshold,
            }).trackingMode,
      ...(nextCost === undefined
        ? { referenceCost: undefined }
        : { referenceCost: nextCost }),
      updatedAt: this.now() as IsoDateTime,
      updatedBy: requiredText(input.actorId, "actorId") as ActorId,
    }
    await this.dependencies.articles.update(updated, {
      costMode: input.removeReferenceCost
        ? "remove"
        : input.referenceCost !== undefined
          ? "set"
          : "preserve",
    })
    return updated
  }

  async archiveArticle(
    restaurantId: string,
    articleId: string,
    actorId: string,
    principal: StockPrincipal
  ) {
    assertArticleAuthorization(principal, "archive", restaurantId)
    const article = await this.requireArticle(
      restaurantId,
      articleId,
      principal,
      canPerformArticleAction(principal, "read_cost", restaurantId)
    )
    if (article.status === "archived") return article
    const updated = this.withStatus(article, "archived", actorId)
    await this.dependencies.articles.update(updated)
    return updated
  }

  async restoreArticle(
    restaurantId: string,
    articleId: string,
    actorId: string,
    principal: StockPrincipal
  ) {
    assertArticleAuthorization(principal, "archive", restaurantId)
    const article = await this.requireArticle(
      restaurantId,
      articleId,
      principal,
      canPerformArticleAction(principal, "read_cost", restaurantId)
    )
    if (article.categoryId) {
      await this.assertActiveCategory(
        restaurantId,
        String(article.categoryId)
      )
    }
    const updated = this.withStatus(article, "active", actorId)
    await this.dependencies.articles.update(updated)
    return updated
  }

  async getArticle(
    restaurantId: string,
    articleId: string,
    principal: StockPrincipal
  ) {
    return this.requireArticle(
      restaurantId,
      articleId,
      principal,
      canPerformArticleAction(principal, "read_cost", restaurantId)
    )
  }

  async listArticles(query: ArticleListQuery, principal: StockPrincipal) {
    assertArticleAuthorization(principal, "read", query.restaurantId)
    return this.dependencies.articles.list({
      ...query,
      includeCost: canPerformArticleAction(
        principal,
        "read_cost",
        query.restaurantId
      ),
    })
  }

  assertUsableForNewOperation(article: StockArticle) {
    this.assertActive(article)
  }

  async createCategory(
    input: CreateCategoryInput,
    principal: StockPrincipal
  ) {
    const value = validateCreateCategory(input)
    assertArticleAuthorization(
      principal,
      "manage_categories",
      value.restaurantId
    )
    const now = this.now() as IsoDateTime
    const category: StockArticleCategory = {
      id: this.createId().replace(/^article-/, "category-") as StockCategoryId,
      restaurantId: value.restaurantId as RestaurantId,
      name: value.name,
      description: value.description,
      sortOrder: value.sortOrder,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: value.actorId as ActorId,
      updatedBy: value.actorId as ActorId,
    }
    await this.dependencies.categories.create(category)
    return category
  }

  async updateCategory(
    restaurantId: string,
    categoryId: string,
    input: UpdateCategoryInput,
    principal: StockPrincipal
  ) {
    assertArticleAuthorization(principal, "manage_categories", restaurantId)
    const current = await this.requireCategory(restaurantId, categoryId)
    const updated: StockArticleCategory = {
      ...current,
      name:
        input.name === undefined
          ? current.name
          : requiredText(input.name, "name"),
      description:
        input.description === undefined
          ? current.description
          : optionalText(input.description),
      sortOrder:
        input.sortOrder === undefined
          ? current.sortOrder
          : Math.floor(nonNegative(input.sortOrder, "sortOrder")),
      updatedAt: this.now() as IsoDateTime,
      updatedBy: requiredText(input.actorId, "actorId") as ActorId,
    }
    await this.dependencies.categories.update(updated)
    return updated
  }

  async archiveCategory(
    restaurantId: string,
    categoryId: string,
    actorId: string,
    principal: StockPrincipal
  ) {
    assertArticleAuthorization(principal, "manage_categories", restaurantId)
    const current = await this.requireCategory(restaurantId, categoryId)
    const updated: StockArticleCategory = {
      ...current,
      status: "archived",
      updatedAt: this.now() as IsoDateTime,
      updatedBy: requiredText(actorId, "actorId") as ActorId,
    }
    await this.dependencies.categories.update(updated)
    return updated
  }

  async listCategories(restaurantId: string, principal: StockPrincipal) {
    assertArticleAuthorization(principal, "read", restaurantId)
    return this.dependencies.categories.list(restaurantId)
  }

  private async requireArticle(
    restaurantId: string,
    articleId: string,
    principal: StockPrincipal,
    includeCost: boolean
  ) {
    assertArticleAuthorization(principal, "read", restaurantId)
    const article = await this.dependencies.articles.getById(
      restaurantId,
      articleId,
      { includeCost }
    )
    if (!article) {
      throw new ArticleDomainError(
        "ARTICLE_NOT_FOUND",
        "Article introuvable."
      )
    }
    if (String(article.restaurantId) !== restaurantId) {
      throw new ArticleDomainError(
        "ARTICLE_RESTAURANT_MISMATCH",
        "Article hors du restaurant courant."
      )
    }
    return article
  }

  private async requireCategory(restaurantId: string, categoryId: string) {
    const category = await this.dependencies.categories.getById(
      restaurantId,
      categoryId
    )
    if (!category) {
      throw new ArticleDomainError(
        "ARTICLE_CATEGORY_NOT_FOUND",
        "Catégorie introuvable."
      )
    }
    return category
  }

  private async assertActiveCategory(
    restaurantId: string,
    categoryId: string
  ) {
    const category = await this.requireCategory(restaurantId, categoryId)
    if (category.status !== "active") {
      throw new ArticleDomainError(
        "ARTICLE_CATEGORY_ARCHIVED",
        "Une catégorie archivée ne peut pas être utilisée."
      )
    }
  }

  private assertActive(article: StockArticle) {
    if (article.status !== "active") {
      throw new ArticleDomainError(
        "ARTICLE_ARCHIVED",
        "Un article archivé ne peut pas être utilisé dans une nouvelle opération."
      )
    }
  }

  private withStatus(
    article: StockArticle,
    status: StockArticle["status"],
    actorId: string
  ): StockArticle {
    return {
      ...article,
      status,
      updatedAt: this.now() as IsoDateTime,
      updatedBy: requiredText(actorId, "actorId") as ActorId,
    }
  }
}
