import type { FinancialSessionAggregate } from "./payment-ledger-domain"

export interface CashSessionCloseV2Input {
  openingBalance?: unknown
  countedPhysicalCash: unknown
  retainedFloat: unknown
  aggregate: FinancialSessionAggregate
}

export interface CashSessionCloseV2 {
  openingBalance: number
  netCashSales: number
  expectedPhysicalCash: number
  countedPhysicalCash: number
  cashCountDifference: number
  retainedFloat: number
  expectedHandover: number
  expectedMobileMoney: number
}

export class CashSessionCloseValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function calculateCashSessionCloseV2(
  input: CashSessionCloseV2Input
): CashSessionCloseV2 {
  const openingBalance = nonNegativeAmount(input.openingBalance ?? 0, "openingBalance")
  const countedPhysicalCash = nonNegativeAmount(
    input.countedPhysicalCash,
    "countedPhysicalCash"
  )
  const retainedFloat = nonNegativeAmount(input.retainedFloat, "retainedFloat")
  if (retainedFloat > countedPhysicalCash) {
    throw new CashSessionCloseValidationError(
      "RETAINED_FLOAT_EXCEEDS_COUNTED_CASH",
      "Le fond conservé ne peut pas dépasser les espèces comptées."
    )
  }

  const netCashSales = integerAmount(input.aggregate.totalCash)
  const expectedPhysicalCash = openingBalance + netCashSales
  return {
    openingBalance,
    netCashSales,
    expectedPhysicalCash,
    countedPhysicalCash,
    cashCountDifference: countedPhysicalCash - expectedPhysicalCash,
    retainedFloat,
    expectedHandover: countedPhysicalCash - retainedFloat,
    expectedMobileMoney: integerAmount(input.aggregate.totalMobileMoney),
  }
}

function nonNegativeAmount(value: unknown, field: string) {
  const amount = integerAmount(value)
  if (amount < 0) {
    throw new CashSessionCloseValidationError(
      "INVALID_CLOSE_AMOUNT",
      `${field} doit être positif ou nul.`
    )
  }
  return amount
}

function integerAmount(value: unknown) {
  const amount = Math.round(Number(value))
  if (!Number.isFinite(amount)) {
    throw new CashSessionCloseValidationError(
      "INVALID_CLOSE_AMOUNT",
      "Le montant de clôture est invalide."
    )
  }
  return amount
}
