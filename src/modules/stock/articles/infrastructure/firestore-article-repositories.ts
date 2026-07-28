"use client"

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  writeBatch,
} from "firebase/firestore"

import type {
  ArticleCategoryRepository,
  ArticleRepository,
} from "../application/repositories"
import type {
  ArticleListQuery,
  ArticlePage,
  StockArticle,
  StockArticleCategory,
} from "../domain/article"
import { STOCK_V2_COLLECTIONS } from "../../shared/inventory-referential"

const ARTICLE_COLLECTION = STOCK_V2_COLLECTIONS.articles
const CATEGORY_COLLECTION = "stockItemCategoriesV2"
const COST_COLLECTION = STOCK_V2_COLLECTIONS.costs
const BALANCE_COLLECTION = STOCK_V2_COLLECTIONS.balances

export class FirestoreArticleRepository implements ArticleRepository {
  constructor(private readonly db: Firestore) {}

  async create(article: StockArticle) {
    const articleRef = this.articleRef(
      String(article.restaurantId),
      String(article.id)
    )
    const balanceRef = this.balanceRef(
      String(article.restaurantId),
      String(article.id)
    )
    const costRef = this.costRef(
      String(article.restaurantId),
      String(article.id)
    )
    await runTransaction(this.db, async (transaction) => {
      const existingArticle = await transaction.get(articleRef)
      const existingBalance = await transaction.get(balanceRef)
      const existingCost = await transaction.get(costRef)
      if (
        existingArticle.exists() ||
        existingBalance.exists() ||
        existingCost.exists()
      ) {
        throw new Error(
          "Création impossible : un article, une balance ou un coût utilise déjà cet identifiant."
        )
      }
      transaction.set(articleRef, serializeArticle(article))
      transaction.set(balanceRef, {
        restaurantId: String(article.restaurantId),
        articleId: String(article.id),
        quantity: 0,
        unit: article.baseUnit,
        version: 1,
        lastOperationAt: null,
        lastSupplyAt: null,
      })
      if (article.referenceCost !== undefined) {
        transaction.set(costRef, serializeCost(article))
      }
    })
  }

  async update(
    article: StockArticle,
    options: { readonly costMode?: "preserve" | "set" | "remove" } = {}
  ) {
    const batch = writeBatch(this.db)
    batch.set(
      this.articleRef(String(article.restaurantId), String(article.id)),
      serializeArticle(article),
      { merge: false }
    )
    const costRef = this.costRef(
      String(article.restaurantId),
      String(article.id)
    )
    if (options.costMode === "remove") {
      batch.delete(costRef)
    } else if (options.costMode === "set") {
      batch.set(costRef, serializeCost(article), { merge: false })
    }
    await batch.commit()
  }

  async getById(
    restaurantId: string,
    articleId: string,
    options: { readonly includeCost?: boolean } = {}
  ) {
    const articleSnap = await getDoc(this.articleRef(restaurantId, articleId))
    if (!articleSnap.exists()) return null
    const article = deserializeArticle(
      articleSnap.id,
      articleSnap.data()
    )
    if (!options.includeCost) return article
    const costSnap = await getDoc(this.costRef(restaurantId, articleId))
    return costSnap.exists()
      ? { ...article, referenceCost: Number(costSnap.data().referenceCost) }
      : article
  }

  async list(query: ArticleListQuery): Promise<ArticlePage> {
    const snapshot = await getDocs(
      collection(
        this.db,
        "restaurants",
        query.restaurantId,
        ARTICLE_COLLECTION
      )
    )
    let items = snapshot.docs.map((entry) =>
      deserializeArticle(entry.id, entry.data())
    )
    const normalizedSearch = normalizeSearch(query.search)
    if (normalizedSearch) {
      items = items.filter((item) =>
        normalizeSearch(
          `${item.name} ${item.description ?? ""}`
        ).includes(normalizedSearch)
      )
    }
    if (query.categoryId) {
      items = items.filter(
        (item) => String(item.categoryId) === query.categoryId
      )
    }
    if (query.status && query.status !== "all") {
      items = items.filter((item) => item.status === query.status)
    }

    const sortBy = query.sortBy ?? "name"
    const direction = query.sortDirection === "desc" ? -1 : 1
    items.sort((left, right) =>
      String(left[sortBy]).localeCompare(String(right[sortBy]), "fr", {
        sensitivity: "base",
      }) * direction
    )
    const total = items.length
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25))
    const cursorIndex = query.cursor
      ? items.findIndex((item) => String(item.id) === query.cursor)
      : -1
    const start = cursorIndex >= 0 ? cursorIndex + 1 : 0
    let pageItems = items.slice(start, start + pageSize)

    if (query.includeCost && pageItems.length > 0) {
      const costs = await Promise.all(
        pageItems.map(async (item) => {
          const costSnap = await getDoc(
            this.costRef(query.restaurantId, String(item.id))
          )
          return costSnap.exists()
            ? Number(costSnap.data().referenceCost)
            : undefined
        })
      )
      pageItems = pageItems.map((item, index) =>
        costs[index] === undefined
          ? item
          : { ...item, referenceCost: costs[index] }
      )
    }

    return {
      items: pageItems,
      total,
      nextCursor:
        start + pageSize < total && pageItems.length > 0
          ? String(pageItems[pageItems.length - 1].id)
          : null,
    }
  }

  private articleRef(restaurantId: string, articleId: string) {
    return doc(
      this.db,
      "restaurants",
      restaurantId,
      ARTICLE_COLLECTION,
      articleId
    )
  }

  private costRef(restaurantId: string, articleId: string) {
    return doc(
      this.db,
      "restaurants",
      restaurantId,
      COST_COLLECTION,
      articleId
    )
  }

  private balanceRef(restaurantId: string, articleId: string) {
    return doc(
      this.db,
      "restaurants",
      restaurantId,
      BALANCE_COLLECTION,
      articleId
    )
  }
}

export class FirestoreArticleCategoryRepository
  implements ArticleCategoryRepository
{
  constructor(private readonly db: Firestore) {}

  async create(category: StockArticleCategory) {
    const categoryRef = this.categoryRef(
      String(category.restaurantId),
      String(category.id)
    )
    await runTransaction(this.db, async (transaction) => {
      const existing = await transaction.get(categoryRef)
      if (existing.exists()) throw new Error("Catégorie déjà existante.")
      transaction.set(categoryRef, serializeCategory(category))
    })
  }

  async update(category: StockArticleCategory) {
    const batch = writeBatch(this.db)
    batch.set(
      this.categoryRef(
        String(category.restaurantId),
        String(category.id)
      ),
      serializeCategory(category),
      { merge: false }
    )
    await batch.commit()
  }

  async getById(restaurantId: string, categoryId: string) {
    const snapshot = await getDoc(
      this.categoryRef(restaurantId, categoryId)
    )
    return snapshot.exists()
      ? deserializeCategory(snapshot.id, snapshot.data())
      : null
  }

  async list(restaurantId: string) {
    const snapshot = await getDocs(
      collection(
        this.db,
        "restaurants",
        restaurantId,
        CATEGORY_COLLECTION
      )
    )
    return snapshot.docs
      .map((entry) => deserializeCategory(entry.id, entry.data()))
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "fr", {
            sensitivity: "base",
          })
      )
  }

  private categoryRef(restaurantId: string, categoryId: string) {
    return doc(
      this.db,
      "restaurants",
      restaurantId,
      CATEGORY_COLLECTION,
      categoryId
    )
  }
}

function serializeArticle(article: StockArticle) {
  return {
    restaurantId: String(article.restaurantId),
    name: article.name,
    description: article.description ?? null,
    categoryId: article.categoryId ? String(article.categoryId) : null,
    baseUnit: article.baseUnit,
    packagings: article.packagings,
    lowStockThreshold: article.lowStockThreshold,
    outOfStockThreshold: article.outOfStockThreshold,
    trackingMode: article.trackingMode,
    status: article.status,
    createdAt: String(article.createdAt),
    updatedAt: String(article.updatedAt),
    createdBy: String(article.createdBy),
    updatedBy: String(article.updatedBy),
    migration: article.migration ?? null,
  }
}

function serializeCost(article: StockArticle) {
  return {
    restaurantId: String(article.restaurantId),
    articleId: String(article.id),
    referenceCost: article.referenceCost,
    updatedAt: String(article.updatedAt),
    updatedBy: String(article.updatedBy),
  }
}

function serializeCategory(category: StockArticleCategory) {
  return {
    restaurantId: String(category.restaurantId),
    name: category.name,
    description: category.description ?? null,
    sortOrder: category.sortOrder,
    status: category.status,
    createdAt: String(category.createdAt),
    updatedAt: String(category.updatedAt),
    createdBy: String(category.createdBy),
    updatedBy: String(category.updatedBy),
  }
}

function deserializeArticle(id: string, data: any): StockArticle {
  return {
    id: id as StockArticle["id"],
    restaurantId: String(data.restaurantId) as StockArticle["restaurantId"],
    name: String(data.name ?? ""),
    ...(data.description ? { description: String(data.description) } : {}),
    ...(data.categoryId
      ? {
          categoryId: String(
            data.categoryId
          ) as NonNullable<StockArticle["categoryId"]>,
        }
      : {}),
    baseUnit: data.baseUnit,
    packagings: Array.isArray(data.packagings) ? data.packagings : [],
    lowStockThreshold: Number(data.lowStockThreshold ?? 0),
    outOfStockThreshold: Number(data.outOfStockThreshold ?? 0),
    trackingMode:
      data.trackingMode === "AUTOMATIC_SIMPLE" ||
      data.trackingMode === "NONE"
        ? data.trackingMode
        : "CONTROLLED",
    status: data.status === "archived" ? "archived" : "active",
    createdAt: String(data.createdAt) as StockArticle["createdAt"],
    updatedAt: String(data.updatedAt) as StockArticle["updatedAt"],
    createdBy: String(data.createdBy) as StockArticle["createdBy"],
    updatedBy: String(data.updatedBy) as StockArticle["updatedBy"],
    ...(data.migration ? { migration: data.migration } : {}),
  }
}

function deserializeCategory(
  id: string,
  data: any
): StockArticleCategory {
  return {
    id: id as StockArticleCategory["id"],
    restaurantId: String(
      data.restaurantId
    ) as StockArticleCategory["restaurantId"],
    name: String(data.name ?? ""),
    ...(data.description ? { description: String(data.description) } : {}),
    sortOrder: Number(data.sortOrder ?? 0),
    status: data.status === "archived" ? "archived" : "active",
    createdAt: String(data.createdAt) as StockArticleCategory["createdAt"],
    updatedAt: String(data.updatedAt) as StockArticleCategory["updatedAt"],
    createdBy: String(data.createdBy) as StockArticleCategory["createdBy"],
    updatedBy: String(data.updatedBy) as StockArticleCategory["updatedBy"],
  }
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}
