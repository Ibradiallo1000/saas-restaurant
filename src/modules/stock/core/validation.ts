import type { ActorId, IsoDateTime, RestaurantId } from "./value-objects"

export const VALIDATION_SEVERITIES = ["error", "warning", "information"] as const
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number]

export interface ValidationIssue {
  readonly code: string
  readonly message: string
  readonly severity: ValidationSeverity
  readonly path?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type ValidationResult<TValue> =
  | {
      readonly valid: true
      readonly value: TValue
      readonly issues: readonly ValidationIssue[]
    }
  | {
      readonly valid: false
      readonly issues: readonly ValidationIssue[]
    }

export interface Validator<TInput, TOutput = TInput> {
  validate(input: TInput): ValidationResult<TOutput> | Promise<ValidationResult<TOutput>>
}

export interface ValidationContext {
  readonly restaurantId: RestaurantId
  readonly actorId: ActorId
  readonly requestedAt: IsoDateTime
  readonly operation: string
}

export interface ApprovalRequest {
  readonly validationId: string
  readonly restaurantId: RestaurantId
  readonly requestedBy: ActorId
  readonly requestedAt: IsoDateTime
  readonly operation: string
  readonly resourceId: string
  readonly reason?: string
}

export type ApprovalDecision =
  | {
      readonly approved: true
      readonly decidedBy: ActorId
      readonly decidedAt: IsoDateTime
      readonly comment?: string
    }
  | {
      readonly approved: false
      readonly decidedBy: ActorId
      readonly decidedAt: IsoDateTime
      readonly reason: string
      readonly returnForCorrection: boolean
    }

export interface ValidationPolicy<TInput> {
  evaluate(input: TInput, context: ValidationContext): ValidationRequirement | Promise<ValidationRequirement>
}

export type ValidationRequirement =
  | { readonly required: false }
  | {
      readonly required: true
      readonly reason: string
      readonly requiredCapability: "stock.validations.approve"
    }
