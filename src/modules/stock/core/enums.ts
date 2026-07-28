export const STOCK_ITEM_STATUSES = ["draft", "active", "archived"] as const
export type StockItemStatus = (typeof STOCK_ITEM_STATUSES)[number]

export const PRODUCT_TRACKING_MODES = ["prepared", "direct", "untracked"] as const
export type ProductTrackingMode = (typeof PRODUCT_TRACKING_MODES)[number]

export const PRODUCT_TRACKING_STATUSES = ["unconfigured", "active", "replaced"] as const
export type ProductTrackingStatus = (typeof PRODUCT_TRACKING_STATUSES)[number]

export const RECIPE_VERSION_STATUSES = ["draft", "ready_to_publish", "published", "replaced", "abandoned"] as const
export type RecipeVersionStatus = (typeof RECIPE_VERSION_STATUSES)[number]

export const RECEPTION_STATUSES = [
  "draft",
  "under_review",
  "ready_for_validation",
  "validating",
  "validated",
  "cancelled",
  "reversed",
] as const
export type ReceptionStatus = (typeof RECEPTION_STATUSES)[number]

export const STOCK_COUNT_STATUSES = [
  "draft",
  "in_progress",
  "completed",
  "awaiting_validation",
  "recount_requested",
  "closed",
  "cancelled",
] as const
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number]

export const DECLARATION_STATUSES = ["draft", "declared", "awaiting_validation", "validated", "rejected", "compensated"] as const
export type DeclarationStatus = (typeof DECLARATION_STATUSES)[number]

export const TRANSFER_STATUSES = ["draft", "sent", "received", "cancelled", "disputed"] as const
export type TransferStatus = (typeof TRANSFER_STATUSES)[number]

export const PREPARATION_BATCH_STATUSES = ["planned", "in_production", "ready_to_close", "closed", "cancelled"] as const
export type PreparationBatchStatus = (typeof PREPARATION_BATCH_STATUSES)[number]

export const PURCHASE_NEED_STATUSES = ["suggested", "retained", "ignored", "grouped", "shared", "ordered"] as const
export type PurchaseNeedStatus = (typeof PURCHASE_NEED_STATUSES)[number]

export const SUPPLIER_ORDER_STATUSES = [
  "draft",
  "submitted",
  "confirmed",
  "partially_received",
  "received",
  "cancelled",
  "remainder_cancelled",
] as const
export type SupplierOrderStatus = (typeof SUPPLIER_ORDER_STATUSES)[number]

export const SUPPLIER_INVOICE_STATUSES = [
  "draft",
  "registered",
  "partially_paid",
  "paid",
  "disputed",
  "credited",
] as const
export type SupplierInvoiceStatus = (typeof SUPPLIER_INVOICE_STATUSES)[number]

export const SUPPLIER_RETURN_STATUSES = [
  "draft",
  "ready_to_ship",
  "shipped",
  "awaiting_credit",
  "awaiting_replacement",
  "awaiting_refund",
  "resolved",
  "cancelled",
] as const
export type SupplierReturnStatus = (typeof SUPPLIER_RETURN_STATUSES)[number]

export const ALERT_STATUSES = ["active", "acknowledged", "temporarily_ignored", "resolved", "not_applicable"] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const VALIDATION_STATUSES = [
  "not_required",
  "awaiting_validation",
  "validated",
  "rejected",
  "returned_for_correction",
] as const
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

export const LOSS_REASONS = [
  "waste",
  "breakage",
  "expired",
  "damaged",
  "preparation_error",
  "other",
] as const
export type LossReason = (typeof LOSS_REASONS)[number]

export const INTERNAL_USE_REASONS = ["staff_meal", "operational_use", "training", "other"] as const
export type InternalUseReason = (typeof INTERNAL_USE_REASONS)[number]

export const COMPLIMENTARY_REASONS = ["commercial_gesture", "customer_recovery", "promotion", "other"] as const
export type ComplimentaryReason = (typeof COMPLIMENTARY_REASONS)[number]

export const COUNT_VARIANCE_REASONS = [
  "unknown",
  "counting_error",
  "undeclared_loss",
  "reception_error",
  "recipe_error",
  "unrecorded_sale",
  "suspected_theft",
  "other",
] as const
export type CountVarianceReason = (typeof COUNT_VARIANCE_REASONS)[number]

export const STOCK_MOVEMENT_TYPES = [
  "opening",
  "reception",
  "sale_consumption",
  "preparation_consumption",
  "loss",
  "internal_use",
  "complimentary_product",
  "count_adjustment",
  "supplier_return",
  "customer_return",
  "transfer_out",
  "transfer_in",
  "exceptional_correction",
  "reversal",
] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const STOCK_MOVEMENT_DIRECTIONS = ["in", "out", "neutral"] as const
export type StockMovementDirection = (typeof STOCK_MOVEMENT_DIRECTIONS)[number]

export const DATA_QUALITY_LEVELS = ["reliable", "partial", "unreliable", "unknown"] as const
export type DataQualityLevel = (typeof DATA_QUALITY_LEVELS)[number]

export const ALERT_PRIORITIES = ["critical", "high", "medium", "information"] as const
export type AlertPriority = (typeof ALERT_PRIORITIES)[number]
