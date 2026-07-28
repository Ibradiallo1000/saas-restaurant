export const LEGACY_STOCK_OBSERVABILITY_ENABLED = false

export const LEGACY_STOCK_OBSERVATION_OUTCOMES = [
  "observed",
  "ignored",
  "failed",
] as const

export type LegacyStockObservationOutcome =
  (typeof LEGACY_STOCK_OBSERVATION_OUTCOMES)[number]

export interface LegacyStockObservationInput {
  readonly source: string
  readonly restaurantId: string
  readonly itemId: string
  readonly operationId?: string | null
  readonly businessId?: string | null
  readonly quantityBefore?: number | null
  readonly quantityAfter?: number | null
  readonly outcome: LegacyStockObservationOutcome
  readonly errorCode?: string | null
}

export interface LegacyStockObservation {
  readonly source: string
  readonly restaurantId: string
  readonly itemId: string
  readonly operationId: string | null
  readonly businessId: string | null
  readonly quantityBefore: number | null
  readonly quantityAfter: number | null
  readonly difference: number | null
  readonly outcome: LegacyStockObservationOutcome
  readonly errorCode: string | null
}

export interface LegacyStockObservationSink {
  record(observation: LegacyStockObservation): void | Promise<void>
}

export function buildLegacyStockObservation(
  input: LegacyStockObservationInput
): LegacyStockObservation {
  const quantityBefore = normalizeOptionalNumber(input.quantityBefore)
  const quantityAfter = normalizeOptionalNumber(input.quantityAfter)

  return Object.freeze({
    source: normalizeIdentifier(input.source),
    restaurantId: normalizeIdentifier(input.restaurantId),
    itemId: normalizeIdentifier(input.itemId),
    operationId: normalizeOptionalIdentifier(input.operationId),
    businessId: normalizeOptionalIdentifier(input.businessId),
    quantityBefore,
    quantityAfter,
    difference:
      quantityBefore === null || quantityAfter === null
        ? null
        : quantityAfter - quantityBefore,
    outcome: input.outcome,
    errorCode: normalizeOptionalIdentifier(input.errorCode),
  })
}

function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeOptionalIdentifier(value: unknown) {
  const normalized = normalizeIdentifier(value)
  return normalized || null
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null || value === undefined) return null
  const quantity = Number(value)
  return Number.isFinite(quantity) ? quantity : null
}
