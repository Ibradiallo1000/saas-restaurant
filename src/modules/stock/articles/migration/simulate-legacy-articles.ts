import type { StockUnit } from "../../core/value-objects"

export interface LegacyArticleRecord {
  readonly id: string
  readonly source: "inventoryItems" | "inventory"
  readonly name?: unknown
  readonly unit?: unknown
  readonly stockEstimated?: unknown
  readonly quantity?: unknown
  readonly costPerUnit?: unknown
}

export interface ArticleMigrationCandidate {
  readonly legacyId: string
  readonly source: LegacyArticleRecord["source"]
  readonly name: string
  readonly baseUnit: StockUnit | null
  readonly referenceCost?: number
  readonly observedLegacyStock?: {
    readonly quantity: number
    readonly unit: StockUnit
  }
  readonly issues: readonly string[]
  readonly duplicateGroup: string | null
}

export interface ArticleMigrationSimulation {
  readonly mode: "simulation"
  readonly writesPerformed: 0
  readonly candidates: readonly ArticleMigrationCandidate[]
  readonly duplicateGroups: Readonly<
    Record<string, readonly { source: string; legacyId: string }[]>
  >
  readonly ambiguousCount: number
}

export function simulateLegacyArticleMigration(
  records: readonly LegacyArticleRecord[]
): ArticleMigrationSimulation {
  const preliminary = records.map(toCandidate)
  const groups = new Map<string, ArticleMigrationCandidate[]>()

  for (const candidate of preliminary) {
    if (!candidate.name || !candidate.baseUnit) continue
    const key = duplicateKey(candidate.name, candidate.baseUnit)
    groups.set(key, [...(groups.get(key) ?? []), candidate])
  }

  const duplicateGroups: Record<
    string,
    readonly { source: string; legacyId: string }[]
  > = {}
  for (const [key, candidates] of groups) {
    if (candidates.length < 2) continue
    duplicateGroups[key] = candidates.map((candidate) => ({
      source: candidate.source,
      legacyId: candidate.legacyId,
    }))
  }

  const candidates = preliminary.map((candidate) => {
    const key =
      candidate.name && candidate.baseUnit
        ? duplicateKey(candidate.name, candidate.baseUnit)
        : null
    return {
      ...candidate,
      duplicateGroup: key && duplicateGroups[key] ? key : null,
      issues:
        key && duplicateGroups[key]
          ? [...candidate.issues, "duplicate_candidate"]
          : candidate.issues,
    }
  })

  return {
    mode: "simulation",
    writesPerformed: 0,
    candidates,
    duplicateGroups,
    ambiguousCount: candidates.filter(
      (candidate) =>
        candidate.issues.length > 0 || candidate.duplicateGroup !== null
    ).length,
  }
}

function toCandidate(record: LegacyArticleRecord): ArticleMigrationCandidate {
  const name = String(record.name ?? "").trim()
  const baseUnit = mapLegacyUnit(record.unit)
  const issues: string[] = []
  if (!name) issues.push("missing_name")
  if (!baseUnit) issues.push("unsupported_unit")

  const rawCost = record.costPerUnit
  const parsedCost =
    rawCost === null || rawCost === undefined ? undefined : Number(rawCost)
  const referenceCost =
    parsedCost !== undefined &&
    Number.isFinite(parsedCost) &&
    parsedCost >= 0
      ? parsedCost
      : undefined
  if (
    rawCost !== null &&
    rawCost !== undefined &&
    referenceCost === undefined
  ) {
    issues.push("invalid_cost")
  }

  const rawStock =
    record.source === "inventoryItems"
      ? record.stockEstimated
      : record.quantity
  const stock = Number(rawStock)
  const observedLegacyStock =
    baseUnit && Number.isFinite(stock) && stock >= 0
      ? { quantity: stock, unit: baseUnit }
      : undefined
  if (
    rawStock !== null &&
    rawStock !== undefined &&
    observedLegacyStock === undefined
  ) {
    issues.push("invalid_first_stock")
  }

  return {
    legacyId: record.id,
    source: record.source,
    name,
    baseUnit,
    ...(referenceCost === undefined ? {} : { referenceCost }),
    ...(observedLegacyStock ? { observedLegacyStock } : {}),
    issues,
    duplicateGroup: null,
  }
}

function mapLegacyUnit(value: unknown): StockUnit | null {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr")
  if (["unit", "unité", "unite", "pièce", "piece"].includes(normalized)) {
    return "unit"
  }
  if (["kg", "kilogramme"].includes(normalized)) return "kg"
  if (["g", "gramme"].includes(normalized)) return "g"
  if (["l", "litre"].includes(normalized)) return "l"
  if (["ml", "millilitre"].includes(normalized)) return "ml"
  return null
}

function duplicateKey(name: string, unit: StockUnit) {
  return `${name
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()}::${unit}`
}
