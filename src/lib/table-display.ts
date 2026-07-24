export type TableDisplaySource = {
  id?: unknown
  name?: unknown
  label?: unknown
  number?: unknown
  code?: unknown
  sortOrder?: unknown
}

const DEFAULT_TABLE_PREFIX = "Table"

export function getRestaurantTableDisplayPrefix(restaurant: unknown): string {
  if (!restaurant || typeof restaurant !== "object") return DEFAULT_TABLE_PREFIX
  const source = restaurant as { tableLabel?: unknown; settings?: { tableLabel?: unknown } }
  return cleanPrefix(source.settings?.tableLabel) || cleanPrefix(source.tableLabel) || DEFAULT_TABLE_PREFIX
}

export function formatTableDisplayName(table: TableDisplaySource | string | number | null | undefined, _prefix = DEFAULT_TABLE_PREFIX): string {
  const value = typeof table === "object" && table !== null
    ? firstDisplayValue(table)
    : table
  return normalizeText(value)
}

export function sortTablesForDisplay<T extends TableDisplaySource>(tables: readonly T[], prefix = DEFAULT_TABLE_PREFIX): T[] {
  const copy = [...tables]
  if (copy.some((table) => table.sortOrder !== null && table.sortOrder !== undefined && table.sortOrder !== "" && Number.isFinite(Number(table.sortOrder)))) return copy

  return copy
    .map((table, index) => ({ table, index, number: getNumericTableNumber(formatTableDisplayName(table, prefix)) }))
    .sort((left, right) => {
      if (left.number !== null && right.number !== null) return left.number - right.number || left.index - right.index
      if (left.number !== null) return -1
      if (right.number !== null) return 1
      return left.index - right.index
    })
    .map(({ table }) => table)
}

function firstDisplayValue(table: TableDisplaySource): unknown {
  return [table.name, table.label, table.number, table.code, table.id].find((value) => normalizeText(value))
}

function getNumericTableNumber(value: string): number | null {
  const match = value.match(/(\d+)$/)
  return match ? Number(match[1]) : null
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return ""
  return String(value).trim().replace(/\s+/g, " ")
}

function cleanPrefix(value: unknown): string {
  return normalizeText(value)
}
