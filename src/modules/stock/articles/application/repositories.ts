import type {
  ArticleListQuery,
  ArticlePage,
  StockArticle,
  StockArticleCategory,
} from "../domain/article"

export interface ArticleRepository {
  create(article: StockArticle): Promise<void>
  update(
    article: StockArticle,
    options?: {
      readonly costMode?: "preserve" | "set" | "remove"
    }
  ): Promise<void>
  getById(
    restaurantId: string,
    articleId: string,
    options?: { readonly includeCost?: boolean }
  ): Promise<StockArticle | null>
  list(query: ArticleListQuery): Promise<ArticlePage>
}

export interface ArticleCategoryRepository {
  create(category: StockArticleCategory): Promise<void>
  update(category: StockArticleCategory): Promise<void>
  getById(
    restaurantId: string,
    categoryId: string
  ): Promise<StockArticleCategory | null>
  list(restaurantId: string): Promise<readonly StockArticleCategory[]>
}
