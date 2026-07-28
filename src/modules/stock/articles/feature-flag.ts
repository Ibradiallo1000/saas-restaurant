export interface ArticleFeatureFlagConfiguration {
  readonly enabled: boolean
  readonly restaurantAllowlist?: readonly string[]
}

export function isArticleReferentialEnabled(
  restaurantId: string,
  configuration: ArticleFeatureFlagConfiguration
) {
  if (!configuration.enabled || !restaurantId) return false
  const allowlist = (configuration.restaurantAllowlist ?? []).filter(Boolean)
  return allowlist.length === 0 || allowlist.includes(restaurantId)
}

export function getArticleFeatureFlagConfiguration():
  ArticleFeatureFlagConfiguration {
  return {
    enabled:
      process.env.NEXT_PUBLIC_STOCK_ARTICLES_V2_ENABLED === "true",
    restaurantAllowlist: String(
      process.env.NEXT_PUBLIC_STOCK_ARTICLES_V2_RESTAURANTS ?? ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  }
}
