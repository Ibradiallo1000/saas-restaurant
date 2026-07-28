import type { StockBusinessError } from "../errors"
import type { IsoDateTime } from "../value-objects"
import type { StockEvent } from "./events"

export type StockResult<TValue, TError extends StockBusinessError = StockBusinessError> =
  | {
      readonly ok: true
      readonly value: TValue
      readonly events: readonly StockEvent[]
      readonly completedAt: IsoDateTime
      readonly replayed: boolean
    }
  | {
      readonly ok: false
      readonly error: TError
      readonly events: readonly []
      readonly completedAt: IsoDateTime
      readonly replayed: boolean
    }

export interface AcceptedResult {
  readonly accepted: true
  readonly operationId: string
}

export interface PendingValidationResult {
  readonly accepted: false
  readonly validationRequired: true
  readonly validationId: string
}

export interface NoEffectResult {
  readonly noEffect: true
  readonly reason: "untracked_product" | "duplicate_command" | "cancelled_before_commitment"
}
