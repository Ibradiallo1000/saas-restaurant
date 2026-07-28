import type {
  ActorId,
  IsoDateTime,
  RestaurantId,
  StockCategoryId,
  StockItemId,
  StockUnit,
} from "../../core/value-objects"

export const ARTICLE_STATUSES = ["active", "archived"] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const ARTICLE_TRACKING_MODES = [
  "CONTROLLED",
  "AUTOMATIC_SIMPLE",
  "NONE",
] as const
export type ArticleTrackingMode = (typeof ARTICLE_TRACKING_MODES)[number]

export const ARTICLE_PACKAGING_KINDS = [
  "box",
  "pack",
  "bag",
  "canister",
  "other",
] as const
export type ArticlePackagingKind = (typeof ARTICLE_PACKAGING_KINDS)[number]

export interface ArticlePackaging {
  readonly id: string
  readonly kind: ArticlePackagingKind
  readonly name: string
  readonly quantity: number
  readonly targetUnit: StockUnit
  readonly active: boolean
}

export interface ArticleMigrationMetadata {
  readonly source: "inventoryItems" | "inventory"
  readonly sourceId: string
  readonly migratedAt?: IsoDateTime
  readonly ambiguity?: string
}

export interface StockArticle {
  readonly id: StockItemId
  readonly restaurantId: RestaurantId
  readonly name: string
  readonly description?: string
  readonly categoryId?: StockCategoryId
  readonly baseUnit: StockUnit
  readonly packagings: readonly ArticlePackaging[]
  readonly lowStockThreshold: number
  readonly outOfStockThreshold: number
  readonly trackingMode: ArticleTrackingMode
  readonly referenceCost?: number
  readonly status: ArticleStatus
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
  readonly createdBy: ActorId
  readonly updatedBy: ActorId
  readonly migration?: ArticleMigrationMetadata
}

export interface StockArticleCategory {
  readonly id: StockCategoryId
  readonly restaurantId: RestaurantId
  readonly name: string
  readonly description?: string
  readonly sortOrder: number
  readonly status: ArticleStatus
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
  readonly createdBy: ActorId
  readonly updatedBy: ActorId
}

export interface CreateArticleInput {
  readonly restaurantId: string
  readonly name: string
  readonly description?: string
  readonly categoryId?: string
  readonly baseUnit: StockUnit | string
  readonly packagings?: readonly ArticlePackagingInput[]
  readonly lowStockThreshold?: number
  readonly outOfStockThreshold?: number
  readonly trackingMode?: ArticleTrackingMode | string
  readonly referenceCost?: number
  readonly actorId: string
  readonly migration?: ArticleMigrationMetadata
}

export interface UpdateArticleInput {
  readonly name?: string
  readonly description?: string
  readonly categoryId?: string
  readonly baseUnit?: StockUnit | string
  readonly packagings?: readonly ArticlePackagingInput[]
  readonly lowStockThreshold?: number
  readonly outOfStockThreshold?: number
  readonly trackingMode?: ArticleTrackingMode | string
  readonly referenceCost?: number
  readonly removeReferenceCost?: boolean
  readonly actorId: string
}

export interface ArticlePackagingInput {
  readonly id?: string
  readonly kind: ArticlePackagingKind | string
  readonly name: string
  readonly quantity: number
  readonly targetUnit: StockUnit | string
  readonly active?: boolean
}

export interface CreateCategoryInput {
  readonly restaurantId: string
  readonly name: string
  readonly description?: string
  readonly sortOrder?: number
  readonly actorId: string
}

export interface UpdateCategoryInput {
  readonly name?: string
  readonly description?: string
  readonly sortOrder?: number
  readonly actorId: string
}

export interface ArticleListQuery {
  readonly restaurantId: string
  readonly search?: string
  readonly categoryId?: string
  readonly status?: ArticleStatus | "all"
  readonly sortBy?: "name" | "createdAt" | "updatedAt"
  readonly sortDirection?: "asc" | "desc"
  readonly pageSize?: number
  readonly cursor?: string
  readonly includeCost?: boolean
}

export interface ArticlePage {
  readonly items: readonly StockArticle[]
  readonly nextCursor: string | null
  readonly total: number
}

export interface CreateArticleResult {
  readonly article: StockArticle
}
