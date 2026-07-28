export type ControlledStockErrorCode =
  | "CONTROLLED_STOCK_INVALID_INPUT"
  | "CONTROLLED_STOCK_FORBIDDEN"
  | "CONTROLLED_STOCK_RESTAURANT_MISMATCH"
  | "CONTROLLED_STOCK_ARTICLE_NOT_FOUND"
  | "CONTROLLED_STOCK_ARTICLE_ARCHIVED"
  | "CONTROLLED_STOCK_TRACKING_DISABLED"
  | "CONTROLLED_STOCK_INCOMPATIBLE_UNIT"
  | "CONTROLLED_STOCK_INSUFFICIENT_QUANTITY"
  | "CONTROLLED_STOCK_CONFLICT"
  | "CONTROLLED_STOCK_IDEMPOTENCY_REUSED"

export class ControlledStockError extends Error {
  readonly name = "ControlledStockError"
  readonly code: ControlledStockErrorCode
  readonly path?: string

  constructor(
    code: ControlledStockErrorCode,
    message: string,
    path?: string
  ) {
    super(message)
    this.code = code
    this.path = path
  }
}
