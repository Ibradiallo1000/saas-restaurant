export const STOCK_ERROR_CODES = [
  "STOCK_INVALID_INPUT",
  "STOCK_UNAUTHORIZED",
  "STOCK_FORBIDDEN_SCOPE",
  "STOCK_NOT_FOUND",
  "STOCK_CONFLICT",
  "STOCK_DUPLICATE_COMMAND",
  "STOCK_IDEMPOTENCY_KEY_REUSED",
  "STOCK_INVALID_STATE_TRANSITION",
  "STOCK_INCOMPATIBLE_UNIT",
  "STOCK_INVALID_QUANTITY",
  "STOCK_INVALID_MONEY",
  "STOCK_MISSING_COST",
  "STOCK_MISSING_RECIPE",
  "STOCK_UNCONFIGURED_PRODUCT",
  "STOCK_ITEM_ARCHIVED",
  "STOCK_VALIDATION_REQUIRED",
  "STOCK_VALIDATION_REJECTED",
  "STOCK_CONCURRENT_MODIFICATION",
  "STOCK_INVARIANT_VIOLATION",
  "STOCK_OPERATION_ALREADY_FINALIZED",
  "STOCK_REVERSAL_NOT_ALLOWED",
  "STOCK_PROJECTION_UNAVAILABLE",
  "STOCK_EXTERNAL_DEPENDENCY_UNAVAILABLE",
  "STOCK_MIGRATION_INCONSISTENCY",
] as const

export type StockErrorCode = (typeof STOCK_ERROR_CODES)[number]

export interface StockBusinessError {
  readonly name: "StockBusinessError"
  readonly code: StockErrorCode
  readonly message: string
  readonly details?: Readonly<Record<string, unknown>>
  readonly retryable: boolean
}

export interface StockValidationError extends StockBusinessError {
  readonly code: "STOCK_INVALID_INPUT" | "STOCK_INCOMPATIBLE_UNIT" | "STOCK_INVALID_QUANTITY" | "STOCK_INVALID_MONEY"
  readonly field?: string
}

export interface StockAuthorizationError extends StockBusinessError {
  readonly code: "STOCK_UNAUTHORIZED" | "STOCK_FORBIDDEN_SCOPE"
}

export interface StockConflictError extends StockBusinessError {
  readonly code:
    | "STOCK_CONFLICT"
    | "STOCK_DUPLICATE_COMMAND"
    | "STOCK_IDEMPOTENCY_KEY_REUSED"
    | "STOCK_CONCURRENT_MODIFICATION"
    | "STOCK_OPERATION_ALREADY_FINALIZED"
}
