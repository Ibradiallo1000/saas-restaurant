export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand
}

export type RestaurantId = Brand<string, "RestaurantId">
export type ActorId = Brand<string, "ActorId">
export type StockItemId = Brand<string, "StockItemId">
export type StockCategoryId = Brand<string, "StockCategoryId">
export type StockZoneId = Brand<string, "StockZoneId">
export type ProductId = Brand<string, "ProductId">
export type RecipeId = Brand<string, "RecipeId">
export type RecipeVersionId = Brand<string, "RecipeVersionId">
export type SupplierId = Brand<string, "SupplierId">
export type ReceptionId = Brand<string, "ReceptionId">
export type SupplierOrderId = Brand<string, "SupplierOrderId">
export type SupplierReturnId = Brand<string, "SupplierReturnId">
export type SupplierInvoiceId = Brand<string, "SupplierInvoiceId">
export type SupplierPaymentId = Brand<string, "SupplierPaymentId">
export type StockCountId = Brand<string, "StockCountId">
export type LossDeclarationId = Brand<string, "LossDeclarationId">
export type InternalUseId = Brand<string, "InternalUseId">
export type StockTransferId = Brand<string, "StockTransferId">
export type PreparationBatchId = Brand<string, "PreparationBatchId">
export type StockMovementId = Brand<string, "StockMovementId">
export type ConsumptionCommitmentId = Brand<string, "ConsumptionCommitmentId">
export type CommandId = Brand<string, "CommandId">
export type EventId = Brand<string, "EventId">
export type CorrelationId = Brand<string, "CorrelationId">
export type CausationId = Brand<string, "CausationId">
export type IdempotencyKey = Brand<string, "IdempotencyKey">
export type IsoDateTime = Brand<string, "IsoDateTime">
export type BusinessDate = Brand<string, "BusinessDate">
export type CurrencyCode = Brand<string, "CurrencyCode">

export interface Quantity {
  readonly amount: number
  readonly unit: StockUnit
}

export interface Money {
  readonly amountMinor: number
  readonly currency: CurrencyCode
}

export interface PackagingConversion {
  readonly packaging: PackagingUnit
  readonly packagingQuantity: number
  readonly stockQuantity: Quantity
}

export interface BusinessPeriod {
  readonly startsAt: IsoDateTime
  readonly endsAt: IsoDateTime
  readonly timeZone: string
}

export interface ActorReference {
  readonly actorId: ActorId
  readonly role: StockRole
}

export interface SourceReference {
  readonly sourceType: StockSourceType
  readonly sourceId: string
}

export interface ValidationReference {
  readonly validationId: string
  readonly validatedBy: ActorId
  readonly validatedAt: IsoDateTime
}

export type StockUnit = (typeof STOCK_UNITS)[number]
export type PackagingUnit = (typeof PACKAGING_UNITS)[number]
export type StockRole = (typeof STOCK_ROLES)[number]
export type StockSourceType = (typeof STOCK_SOURCE_TYPES)[number]

export const STOCK_UNITS = ["unit", "kg", "g", "l", "ml"] as const

export const PACKAGING_UNITS = [
  "box",
  "pack",
  "crate",
  "bag",
  "bottle",
  "canister",
  "can",
  "packet",
  "tray",
  "keg",
] as const

export const STOCK_ROLES = [
  "owner",
  "manager",
  "kitchen_chef",
  "bar_manager",
  "storekeeper",
  "purchasing_manager",
  "employee",
] as const

export const STOCK_SOURCE_TYPES = [
  "initial_stock",
  "reception",
  "sale_consumption",
  "preparation_batch",
  "loss",
  "internal_use",
  "complimentary_product",
  "count_adjustment",
  "supplier_return",
  "customer_return",
  "transfer",
  "exceptional_correction",
  "reversal",
] as const
