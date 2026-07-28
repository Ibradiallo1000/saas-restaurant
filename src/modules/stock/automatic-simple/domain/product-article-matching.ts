export type MatchableStockArticle = {
  readonly id: string
  readonly name: string
  readonly status?: string
  readonly trackingMode?: string
}

export function normalizeStockName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function findAutomaticArticleByName<T extends MatchableStockArticle>(
  productName: string,
  articles: readonly T[]
): T | null {
  const normalizedName = normalizeStockName(productName)
  if (!normalizedName) return null
  return (
    articles.find(
      (article) =>
        article.status !== "archived" &&
        article.trackingMode === "AUTOMATIC_SIMPLE" &&
        normalizeStockName(article.name) === normalizedName
    ) ?? null
  )
}

export function eligibleAutomaticArticles<T extends MatchableStockArticle>(
  articles: readonly T[]
) {
  return articles.filter(
    (article) =>
      article.status !== "archived" &&
      article.trackingMode === "AUTOMATIC_SIMPLE"
  )
}
