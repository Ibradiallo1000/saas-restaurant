export type LegacyStockSnapshot = Readonly<Record<string, number>>

export interface LegacyStockOperation {
  readonly operationId: string
  readonly restaurantId: string
  readonly itemId: string
  readonly quantity: number
}

export interface LegacyStockObservedQuantity {
  readonly restaurantId: string
  readonly itemId: string
  readonly quantity: number
}

export interface LegacyStockDifference {
  readonly key: string
  readonly restaurantId: string
  readonly itemId: string
  readonly expected: number
  readonly obtained: number
  readonly difference: number
}

export interface LegacyStockComparison {
  readonly matches: boolean
  readonly differences: readonly LegacyStockDifference[]
  readonly duplicateOperationIds: readonly string[]
  readonly unexplainedObservedKeys: readonly string[]
}

export function legacyStockKey(restaurantId: string, itemId: string) {
  return `${restaurantId}::${itemId}`
}

export function projectLegacyStock(
  initial: LegacyStockSnapshot,
  operations: readonly LegacyStockOperation[]
): LegacyStockSnapshot {
  const projected: Record<string, number> = { ...initial }

  for (const operation of operations) {
    const key = legacyStockKey(operation.restaurantId, operation.itemId)
    projected[key] = normalizeQuantity(projected[key]) + normalizeQuantity(operation.quantity)
  }

  return Object.freeze(projected)
}

export function compareLegacyStock({
  initial,
  operations,
  observed,
}: {
  readonly initial: LegacyStockSnapshot
  readonly operations: readonly LegacyStockOperation[]
  readonly observed: readonly LegacyStockObservedQuantity[]
}): LegacyStockComparison {
  const expected = projectLegacyStock(initial, operations)
  const observedByKey = new Map(
    observed.map((entry) => [
      legacyStockKey(entry.restaurantId, entry.itemId),
      normalizeQuantity(entry.quantity),
    ])
  )
  const keys = new Set([...Object.keys(expected), ...observedByKey.keys()])
  const differences: LegacyStockDifference[] = []

  for (const key of [...keys].sort()) {
    const separatorIndex = key.indexOf("::")
    const restaurantId = separatorIndex >= 0 ? key.slice(0, separatorIndex) : ""
    const itemId = separatorIndex >= 0 ? key.slice(separatorIndex + 2) : key
    const expectedQuantity = normalizeQuantity(expected[key])
    const obtainedQuantity = normalizeQuantity(observedByKey.get(key))

    if (expectedQuantity !== obtainedQuantity) {
      differences.push({
        key,
        restaurantId,
        itemId,
        expected: expectedQuantity,
        obtained: obtainedQuantity,
        difference: obtainedQuantity - expectedQuantity,
      })
    }
  }

  const duplicateOperationIds = findDuplicateOperationIds(operations)
  const initialKeys = new Set(Object.keys(initial))
  const operationKeys = new Set(
    operations.map((operation) => legacyStockKey(operation.restaurantId, operation.itemId))
  )
  const unexplainedObservedKeys = [...observedByKey.keys()]
    .filter((key) => !initialKeys.has(key) && !operationKeys.has(key))
    .sort()

  return {
    matches:
      differences.length === 0 &&
      duplicateOperationIds.length === 0 &&
      unexplainedObservedKeys.length === 0,
    differences,
    duplicateOperationIds,
    unexplainedObservedKeys,
  }
}

export function findDuplicateOperationIds(
  operations: readonly Pick<LegacyStockOperation, "operationId">[]
) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const operation of operations) {
    if (seen.has(operation.operationId)) duplicates.add(operation.operationId)
    seen.add(operation.operationId)
  }

  return [...duplicates].sort()
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value ?? 0)
  return Number.isFinite(quantity) ? quantity : 0
}
