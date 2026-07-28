export const STOCK_FEATURE_FLAGS = [
  "stock.core.enabled",
  "stock.itemsV2.enabled",
  "stock.readModel.enabled",
  "stock.receptionsV2.enabled",
  "stock.countsV2.enabled",
  "stock.lossesV2.enabled",
  "stock.productTrackingV2.enabled",
  "stock.consumptionV2.enabled",
  "stock.dashboardV2.enabled",
  "stock.suppliersV2.enabled",
  "stock.reportingV2.enabled",
  "stock.zones.enabled",
  "stock.structuredPurchases.enabled",
  "stock.supplierFinance.enabled",
  "stock.batchProduction.enabled",
  "stock.migration.shadowRead.enabled",
  "stock.migration.newWrites.enabled",
] as const

export type StockFeatureFlag = (typeof STOCK_FEATURE_FLAGS)[number]
export type StockFeatureFlagState = Readonly<Record<StockFeatureFlag, boolean>>

export const DEFAULT_STOCK_FEATURE_FLAGS: StockFeatureFlagState = {
  "stock.core.enabled": false,
  "stock.itemsV2.enabled": false,
  "stock.readModel.enabled": false,
  "stock.receptionsV2.enabled": false,
  "stock.countsV2.enabled": false,
  "stock.lossesV2.enabled": false,
  "stock.productTrackingV2.enabled": false,
  "stock.consumptionV2.enabled": false,
  "stock.dashboardV2.enabled": false,
  "stock.suppliersV2.enabled": false,
  "stock.reportingV2.enabled": false,
  "stock.zones.enabled": false,
  "stock.structuredPurchases.enabled": false,
  "stock.supplierFinance.enabled": false,
  "stock.batchProduction.enabled": false,
  "stock.migration.shadowRead.enabled": false,
  "stock.migration.newWrites.enabled": false,
}

export interface StockFeatureFlagReader {
  isEnabled(flag: StockFeatureFlag, context: StockFeatureFlagContext): boolean | Promise<boolean>
}

export interface StockFeatureFlagContext {
  readonly restaurantId: string
  readonly actorId?: string
}
