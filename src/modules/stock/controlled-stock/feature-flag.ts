export interface ControlledStockFeatureConfiguration {
  readonly enabled: boolean
  readonly restaurantAllowlist?: readonly string[]
}

export function isControlledStockEnabled(
  restaurantId: string,
  configuration: ControlledStockFeatureConfiguration
) {
  if (!configuration.enabled || !restaurantId) return false
  const allowlist = (configuration.restaurantAllowlist ?? []).filter(Boolean)
  return allowlist.length === 0 || allowlist.includes(restaurantId)
}

export function getControlledStockFeatureConfiguration():
  ControlledStockFeatureConfiguration {
  return {
    enabled:
      process.env.NEXT_PUBLIC_STOCK_CONTROLLED_V2_ENABLED === "true",
    restaurantAllowlist: String(
      process.env.NEXT_PUBLIC_STOCK_CONTROLLED_V2_RESTAURANTS ?? ""
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  }
}
