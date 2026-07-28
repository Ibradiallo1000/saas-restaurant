import type { StockUnit } from "../../core/value-objects"
import type { ArticlePackaging, StockArticle } from "../../articles/domain/article"
import { officialUnitFactor, isStockUnit } from "../../articles/domain/units.ts"
import { ControlledStockError } from "./errors.ts"
import {
  STOCK_LOSS_REASONS,
  type StockLossReason,
} from "./models.ts"

export function requiredText(value: unknown, path: string) {
  const result = String(value ?? "").trim()
  if (!result) {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_INVALID_INPUT",
      "Ce champ est obligatoire.",
      path
    )
  }
  return result
}

export function positive(value: unknown, path: string) {
  const result = Number(value)
  if (!Number.isFinite(result) || result <= 0) {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_INVALID_INPUT",
      "La quantité doit être strictement positive.",
      path
    )
  }
  return result
}

export function nonNegative(value: unknown, path: string) {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_INVALID_INPUT",
      "La quantité ne peut pas être négative.",
      path
    )
  }
  return result
}

export function optionalNonNegative(value: unknown, path: string) {
  if (value === undefined || value === null || value === "") return undefined
  return nonNegative(value, path)
}

export function validateUnit(value: unknown): StockUnit {
  if (!isStockUnit(value)) {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_INCOMPATIBLE_UNIT",
      "Unité invalide.",
      "unit"
    )
  }
  return value
}

export function assertQuantitativeArticle(article: StockArticle) {
  if (article.status !== "active") {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_ARTICLE_ARCHIVED",
      "Un Article archivé ne peut recevoir aucune opération."
    )
  }
  if (article.trackingMode === "NONE") {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_TRACKING_DISABLED",
      "Cet Article ne possède aucun suivi quantitatif."
    )
  }
}

export function toBaseQuantity(
  quantity: number,
  unit: StockUnit,
  article: StockArticle,
  packagingId?: string
) {
  if (packagingId) {
    const packaging = article.packagings.find(
      (item) => item.id === packagingId && item.active
    )
    if (!packaging) {
      throw new ControlledStockError(
        "CONTROLLED_STOCK_INVALID_INPUT",
        "Conditionnement introuvable.",
        "packagingId"
      )
    }
    return quantity * packaging.quantity * factor(packaging.targetUnit, article.baseUnit)
  }
  return quantity * factor(unit, article.baseUnit)
}

function factor(from: StockUnit, to: StockUnit) {
  try {
    return officialUnitFactor(from, to)
  } catch {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_INCOMPATIBLE_UNIT",
      `Conversion incompatible de ${from} vers ${to}.`,
      "unit"
    )
  }
}

export function validateLossReason(value: unknown): StockLossReason {
  if (!STOCK_LOSS_REASONS.includes(value as StockLossReason)) {
    throw new ControlledStockError(
      "CONTROLLED_STOCK_INVALID_INPUT",
      "Motif de perte obligatoire.",
      "reason"
    )
  }
  return value as StockLossReason
}

export function varianceType(variation: number) {
  if (variation === 0) return "AUCUN_ECART" as const
  return variation < 0 ? ("MANQUE" as const) : ("SURPLUS" as const)
}

export function packagingById(
  article: StockArticle,
  packagingId: string
): ArticlePackaging | undefined {
  return article.packagings.find((item) => item.id === packagingId)
}
