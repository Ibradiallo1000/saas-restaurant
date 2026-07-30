export type CanonicalOrderErrorCode =
  | "INVALID_JSON"
  | "UNSUPPORTED_SCHEMA"
  | "INVALID_COMMAND"
  | "UNAUTHENTICATED"
  | "APP_CHECK_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_TABLE_CAPABILITY"
  | "RESTAURANT_NOT_FOUND"
  | "RESTAURANT_INACTIVE"
  | "PUBLIC_ORDERING_CLOSED"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_OPTION"
  | "INVALID_PREPARATION_MODE"
  | "TABLE_SESSION_INACTIVE"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_CORRUPTED"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "ORDER_CREATION_FAILED"

const HTTP_STATUS: Record<CanonicalOrderErrorCode, number> = {
  INVALID_JSON: 400,
  UNSUPPORTED_SCHEMA: 400,
  INVALID_COMMAND: 422,
  UNAUTHENTICATED: 401,
  APP_CHECK_REQUIRED: 401,
  FORBIDDEN: 403,
  INVALID_TABLE_CAPABILITY: 403,
  RESTAURANT_NOT_FOUND: 404,
  RESTAURANT_INACTIVE: 422,
  PUBLIC_ORDERING_CLOSED: 422,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 422,
  INVALID_OPTION: 422,
  INVALID_PREPARATION_MODE: 422,
  TABLE_SESSION_INACTIVE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_CORRUPTED: 500,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  ORDER_CREATION_FAILED: 500,
}

export class CanonicalOrderError extends Error {
  readonly code: CanonicalOrderErrorCode
  readonly status: number
  readonly fieldErrors: Record<string, string> | null
  readonly retryable: boolean

  constructor(
    code: CanonicalOrderErrorCode,
    message: string,
    fieldErrors: Record<string, string> | null = null,
    retryable = false
  ) {
    super(message)
    this.name = "CanonicalOrderError"
    this.code = code
    this.status = HTTP_STATUS[code]
    this.fieldErrors = fieldErrors
    this.retryable = retryable
  }
}

export function asCanonicalOrderError(error: unknown) {
  if (error instanceof CanonicalOrderError) return error
  return new CanonicalOrderError(
    "ORDER_CREATION_FAILED",
    "Impossible de créer la commande.",
    null,
    true
  )
}
