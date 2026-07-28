import type {
  ControlledStockBalance,
  ControlledStockOperation,
} from "../domain/models"

export interface ManualControlProjection {
  readonly lastControl: ControlledStockOperation | null
  readonly stockAtLastControl: number
  readonly suppliesSinceLastControl: number
  readonly otherMovementsSinceLastControl: readonly ControlledStockOperation[]
  readonly otherMovementsVariation: number
  readonly theoreticalQuantity: number
  readonly controlledToday: boolean
}

export function buildManualControlProjection(input: {
  balance: ControlledStockBalance
  operations: readonly ControlledStockOperation[]
  now: string
}): ManualControlProjection {
  const operations = input.operations
    .filter((operation) => String(operation.articleId) === String(input.balance.articleId))
    .sort((left, right) =>
      String(left.occurredAt).localeCompare(String(right.occurredAt))
    )
  const controls = operations.filter(
    (operation) => operation.type === "CONTROLE_PHYSIQUE"
  )
  const lastControl = controls.at(-1) ?? null
  const since = lastControl
    ? operations.filter(
        (operation) =>
          operation.id !== lastControl.id
          && String(operation.occurredAt) >= String(lastControl.occurredAt)
      )
    : operations
  const supplies = since.filter(
    (operation) => operation.type === "APPROVISIONNEMENT"
  )
  const otherMovements = since.filter(
    (operation) =>
      operation.type !== "APPROVISIONNEMENT"
      && operation.type !== "CONTROLE_PHYSIQUE"
  )
  const suppliesVariation = sum(supplies.map((operation) => operation.variation))
  const otherVariation = sum(
    otherMovements.map((operation) => operation.variation)
  )
  const stockAtLastControl = lastControl
    ? lastControl.quantityAfter
    : input.balance.quantity - suppliesVariation - otherVariation

  return {
    lastControl,
    stockAtLastControl,
    suppliesSinceLastControl: suppliesVariation,
    otherMovementsSinceLastControl: otherMovements,
    otherMovementsVariation: otherVariation,
    theoreticalQuantity: input.balance.quantity,
    controlledToday:
      Boolean(lastControl)
      && localDay(String(lastControl?.occurredAt)) === localDay(input.now),
  }
}

export function calculateObservedStockGap(
  theoreticalQuantity: number,
  observedQuantity: number
) {
  return theoreticalQuantity - observedQuantity
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0)
}

function localDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
