export type AggregateErrorCode =
  | "NO_CANONICAL_ORDER_ITEMS"
  | "INCONSISTENT_QUANTITIES"
  | "INVALID_ITEM_STATE"
  | "AGGREGATE_CONFLICT"
  | "LEGACY_ORDER_READ_ONLY"
  | "PAYMENT_STATE_INCONSISTENT"

export class OrderAggregateError extends Error {
  readonly code: AggregateErrorCode
  constructor(code: AggregateErrorCode, message: string) {
    super(message)
    this.name = "OrderAggregateError"
    this.code = code
  }
}
