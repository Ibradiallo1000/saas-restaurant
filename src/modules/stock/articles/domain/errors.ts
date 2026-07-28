export const ARTICLE_ERROR_CODES = [
  "ARTICLE_INVALID_INPUT",
  "ARTICLE_NOT_FOUND",
  "ARTICLE_ARCHIVED",
  "ARTICLE_FORBIDDEN",
  "ARTICLE_RESTAURANT_MISMATCH",
  "ARTICLE_INCOMPATIBLE_UNIT",
  "ARTICLE_CATEGORY_NOT_FOUND",
  "ARTICLE_CATEGORY_ARCHIVED",
  "ARTICLE_CONFLICT",
] as const

export type ArticleErrorCode = (typeof ARTICLE_ERROR_CODES)[number]

export class ArticleDomainError extends Error {
  readonly code: ArticleErrorCode
  readonly path?: string

  constructor(
    code: ArticleErrorCode,
    message: string,
    path?: string
  ) {
    super(message)
    this.name = "ArticleDomainError"
    this.code = code
    this.path = path
  }
}
