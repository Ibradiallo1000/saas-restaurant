import type { IdempotencyKey, IsoDateTime, RestaurantId } from "./value-objects"

export const IDEMPOTENCY_SCOPES = [
  "consumption_commitment",
  "reception_validation",
  "count_closure",
  "loss_validation",
  "internal_use_validation",
  "complimentary_validation",
  "transfer_step",
  "supplier_return_shipment",
  "supplier_payment_validation",
  "operation_reversal",
] as const

export type IdempotencyScope = (typeof IDEMPOTENCY_SCOPES)[number]

export const IDEMPOTENCY_KEY_SEPARATOR = ":"
export const IDEMPOTENCY_CONTRACT_VERSION = 1 as const

export interface IdempotencyDescriptor {
  readonly version: typeof IDEMPOTENCY_CONTRACT_VERSION
  readonly restaurantId: RestaurantId
  readonly scope: IdempotencyScope
  readonly operationId: string
  readonly step?: string
  readonly revision?: string
}

export interface IdempotencyRecord<TResult = unknown> {
  readonly key: IdempotencyKey
  readonly descriptor: IdempotencyDescriptor
  readonly status: IdempotencyStatus
  readonly createdAt: IsoDateTime
  readonly completedAt?: IsoDateTime
  readonly result?: TResult
}

export const IDEMPOTENCY_STATUSES = ["processing", "completed", "failed_retryable", "failed_final"] as const
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number]

export interface IdempotencyRegistry {
  find<TResult>(key: IdempotencyKey): Promise<IdempotencyRecord<TResult> | null>
}

export const IDEMPOTENCY_KEY_FORMAT = "v{version}:{restaurantId}:{scope}:{operationId}[:{step}][:{revision}]" as const
