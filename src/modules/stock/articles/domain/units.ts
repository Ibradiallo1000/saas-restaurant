import { STOCK_UNITS, type StockUnit } from "../../core/value-objects.ts"
import { ArticleDomainError } from "./errors.ts"

export const ARTICLE_UNIT_DIMENSIONS = {
  unit: "count",
  kg: "mass",
  g: "mass",
  l: "volume",
  ml: "volume",
} as const satisfies Record<StockUnit, "count" | "mass" | "volume">

export function isStockUnit(value: unknown): value is StockUnit {
  return STOCK_UNITS.includes(value as StockUnit)
}

export function assertCompatibleUnits(from: StockUnit, to: StockUnit) {
  if (ARTICLE_UNIT_DIMENSIONS[from] !== ARTICLE_UNIT_DIMENSIONS[to]) {
    throw new ArticleDomainError(
      "ARTICLE_INCOMPATIBLE_UNIT",
      `Conversion incompatible de ${from} vers ${to}.`,
      "unit"
    )
  }
}

export function convertArticleQuantity(
  quantity: number,
  from: StockUnit,
  to: StockUnit,
  explicitFactor: number
) {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "La quantité ne peut pas être négative.",
      "quantity"
    )
  }
  if (!Number.isFinite(explicitFactor) || explicitFactor <= 0) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "Un facteur de conversion explicite et positif est obligatoire.",
      "conversionFactor"
    )
  }
  assertCompatibleUnits(from, to)
  return quantity * explicitFactor
}

export function officialUnitFactor(from: StockUnit, to: StockUnit) {
  assertCompatibleUnits(from, to)
  if (from === to) return 1
  if (from === "kg" && to === "g") return 1000
  if (from === "g" && to === "kg") return 0.001
  if (from === "l" && to === "ml") return 1000
  if (from === "ml" && to === "l") return 0.001
  throw new ArticleDomainError(
    "ARTICLE_INCOMPATIBLE_UNIT",
    `Aucun facteur officiel disponible de ${from} vers ${to}.`,
    "unit"
  )
}
