import type { StockUnit } from "../../core/value-objects"
import type {
  ArticlePackaging,
  ArticlePackagingInput,
  ArticleTrackingMode,
  CreateArticleInput,
  CreateCategoryInput,
} from "./article"
import {
  ARTICLE_PACKAGING_KINDS,
  ARTICLE_TRACKING_MODES,
} from "./article.ts"
import { ArticleDomainError } from "./errors.ts"
import { assertCompatibleUnits, isStockUnit } from "./units.ts"

export function validateCreateArticle(input: CreateArticleInput) {
  const restaurantId = requiredText(input.restaurantId, "restaurantId")
  const actorId = requiredText(input.actorId, "actorId")
  const name = requiredText(input.name, "name")
  const categoryId = optionalText(input.categoryId)
  const baseUnit = validateUnit(input.baseUnit, "baseUnit")
  const lowStockThreshold = nonNegative(input.lowStockThreshold ?? 0, "lowStockThreshold")
  const outOfStockThreshold = nonNegative(input.outOfStockThreshold ?? 0, "outOfStockThreshold")

  if (outOfStockThreshold > lowStockThreshold) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "Le seuil de rupture ne peut pas dépasser le seuil de stock faible.",
      "outOfStockThreshold"
    )
  }

  const referenceCost =
    input.referenceCost === undefined
      ? undefined
      : nonNegative(input.referenceCost, "referenceCost")
  const packagings = validatePackagings(input.packagings ?? [], baseUnit)

  return {
    restaurantId,
    actorId,
    name,
    description: optionalText(input.description),
    categoryId,
    baseUnit,
    packagings,
    lowStockThreshold,
    outOfStockThreshold,
    trackingMode: validateTrackingMode(input.trackingMode),
    referenceCost,
    migration: input.migration,
  }
}

export function validateTrackingMode(
  value: unknown
): ArticleTrackingMode {
  const normalized = value ?? "CONTROLLED"
  if (
    !ARTICLE_TRACKING_MODES.includes(
      normalized as ArticleTrackingMode
    )
  ) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "Mode de suivi invalide.",
      "trackingMode"
    )
  }
  return normalized as ArticleTrackingMode
}

export function validatePackaging(
  input: ArticlePackagingInput,
  baseUnit: StockUnit,
  index = 0
): ArticlePackaging {
  const path = `packagings.${index}`
  if (!ARTICLE_PACKAGING_KINDS.includes(input.kind as ArticlePackaging["kind"])) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "Type de conditionnement invalide.",
      `${path}.kind`
    )
  }
  const targetUnit = validateUnit(input.targetUnit, `${path}.targetUnit`)
  assertCompatibleUnits(targetUnit, baseUnit)

  return {
    id: optionalText(input.id) || `packaging-${index + 1}`,
    kind: input.kind as ArticlePackaging["kind"],
    name: requiredText(input.name, `${path}.name`),
    quantity: positive(input.quantity, `${path}.quantity`),
    targetUnit,
    active: input.active !== false,
  }
}

export function validatePackagings(
  inputs: readonly ArticlePackagingInput[],
  baseUnit: StockUnit
) {
  const packagings = inputs.map((packaging, index) =>
    validatePackaging(packaging, baseUnit, index)
  )
  const names = new Set<string>()
  for (const [index, packaging] of packagings.entries()) {
    const normalizedName = packaging.name
      .toLocaleLowerCase("fr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
    if (names.has(normalizedName)) {
      throw new ArticleDomainError(
        "ARTICLE_INVALID_INPUT",
        "Deux formats d’achat ne peuvent pas porter le même nom.",
        `packagings.${index}.name`
      )
    }
    names.add(normalizedName)
  }
  return packagings
}

export function validateCreateCategory(input: CreateCategoryInput) {
  return {
    restaurantId: requiredText(input.restaurantId, "restaurantId"),
    actorId: requiredText(input.actorId, "actorId"),
    name: requiredText(input.name, "name"),
    description: optionalText(input.description),
    sortOrder: nonNegativeInteger(input.sortOrder ?? 0, "sortOrder"),
  }
}

export function requiredText(value: unknown, path: string) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "Ce champ est obligatoire.",
      path
    )
  }
  return normalized
}

export function optionalText(value: unknown) {
  const normalized = String(value ?? "").trim()
  return normalized || undefined
}

export function nonNegative(value: unknown, path: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "La valeur ne peut pas être négative.",
      path
    )
  }
  return number
}

function positive(value: unknown, path: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "La valeur doit être strictement positive.",
      path
    )
  }
  return number
}

function nonNegativeInteger(value: unknown, path: string) {
  const number = nonNegative(value, path)
  if (!Number.isInteger(number)) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "La valeur doit être un entier.",
      path
    )
  }
  return number
}

function validateUnit(value: unknown, path: string): StockUnit {
  if (!isStockUnit(value)) {
    throw new ArticleDomainError(
      "ARTICLE_INVALID_INPUT",
      "Unité officielle invalide.",
      path
    )
  }
  return value
}
