import type {
  LegacyQuantityObservation,
  StockAuthorityComparisonRow,
  StockV2Observation,
} from "../domain/models"

export function compareStockAuthorities(
  restaurantId: string,
  legacy: readonly LegacyQuantityObservation[],
  v2: readonly StockV2Observation[],
  comparedAt: string
): readonly StockAuthorityComparisonRow[] {
  const safeLegacy = legacy.filter((item) => item.restaurantId === restaurantId)
  const safeV2 = v2.filter((item) => item.restaurantId === restaurantId)
  const v2ByArticle = new Map(safeV2.map((item) => [item.articleId, item]))
  const counts = new Map<string, number>()
  for (const item of safeLegacy) {
    if (item.articleId) counts.set(item.articleId, (counts.get(item.articleId) ?? 0) + 1)
  }
  return safeLegacy.map((item) => {
    const current = item.articleId ? v2ByArticle.get(item.articleId) : undefined
    const duplicate = item.articleId && (counts.get(item.articleId) ?? 0) > 1
    const difference = current ? current.quantity - item.quantity : undefined
    return {
      restaurantId,
      articleId: item.articleId,
      articleName: current?.articleName ?? item.legacyName,
      source: item.source,
      legacyQuantity: item.quantity,
      v2Quantity: current?.quantity,
      difference,
      status: duplicate
        ? "DUPLICATE"
        : !current
          ? "UNASSOCIATED"
          : difference === 0
            ? "MATCH"
            : "DIVERGENT",
      comparedAt,
    }
  })
}
