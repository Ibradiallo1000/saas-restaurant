/**
 * @fileOverview Validateurs purs pour les catégories globales marketplace (marketplaceFoodCategories).
 * Aucune dépendance Firestore, aucun accès réseau. Tous les validateurs sont des fonctions pures.
 */

import { normalizeMarketplaceSearch } from "./marketplace-discovery-core"
import { isMarketplaceCategoryIconKey } from "@/lib/marketplace-category-icons"

export interface MarketplaceFoodCategoryInput {
  name: string
  slug: string
  iconKey?: string | null
  imageUrl?: string | null
  sortOrder: number
  active: boolean
}

export interface MarketplaceFoodCategoryValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  slug?: string
  normalizedName?: string
  sortOrder?: number
}

const SLUG_MAX_LENGTH = 80
const NAME_MAX_LENGTH = 120
const SORT_ORDER_MIN = 0
const SORT_ORDER_MAX = 9999

/**
 * Valide et normalise un slug. Retourne le slug normalisé ou null.
 */
export function normalizeSlug(value: unknown): string | null {
  const raw = normalizeMarketplaceSearch(value)
  if (!raw) return null
  const slug = raw.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, SLUG_MAX_LENGTH)
  return slug || null
}

/**
 * Valide un nom de catégorie. Retourne le nom normalisé ou null.
 */
export function normalizeCategoryName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, NAME_MAX_LENGTH)
  return trimmed || null
}

/**
 * Valide et normalise une valeur sortOrder.
 */
export function normalizeSortOrder(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (!Number.isInteger(parsed)) return null
  if (parsed < SORT_ORDER_MIN || parsed > SORT_ORDER_MAX) return null
  return parsed
}

/**
 * Valide une clé d'icône marketplace. Accepte null/undefined comme absence d'icône.
 */
export function isValidIconKey(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true
  return isMarketplaceCategoryIconKey(value)
}

/**
 * Valide un statut actif.
 */
export function isValidActiveStatus(value: unknown): boolean {
  return typeof value === "boolean"
}

/**
 * Validation complète d'une catégorie marketplace avant création ou mise à jour.
 * Retourne un objet avec les erreurs, avertissements et valeurs normalisées.
 */
export function validateMarketplaceFoodCategory(input: MarketplaceFoodCategoryInput): MarketplaceFoodCategoryValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Nom obligatoire
  const name = normalizeCategoryName(input.name)
  if (!name) {
    errors.push("Le nom de la catégorie est obligatoire.")
  }

  // Slug normalisé
  let slug: string | null = null
  if (input.slug) {
    slug = normalizeSlug(input.slug)
    if (!slug) {
      errors.push("Le slug est invalide après normalisation.")
    }
  } else if (name) {
    slug = normalizeSlug(name)
    if (slug) {
      warnings.push("Slug généré automatiquement à partir du nom.")
    } else {
      errors.push("Impossible de générer un slug à partir du nom.")
    }
  }

  // Vérification longueur slug
  if (slug && slug.length < 2) {
    errors.push("Le slug doit contenir au moins 2 caractères.")
  }

  // Icône
  if (!isValidIconKey(input.iconKey)) {
    errors.push(`La clé d'icône "${input.iconKey}" n'est pas valide.`)
  }

  // Ordre
  const sortOrder = normalizeSortOrder(input.sortOrder)
  if (sortOrder === null) {
    errors.push(`L'ordre d'affichage doit être un entier entre ${SORT_ORDER_MIN} et ${SORT_ORDER_MAX}.`)
  }

  // Statut actif
  if (!isValidActiveStatus(input.active)) {
    errors.push("Le statut actif doit être un booléen.")
  }

  // Avertissement si slug et nom diffèrent
  if (name && slug && normalizeSlug(name) !== slug) {
    warnings.push("Le slug diffère du slug généré automatiquement à partir du nom.")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    slug: slug || undefined,
    normalizedName: name ? normalizeMarketplaceSearch(name) : undefined,
    sortOrder: sortOrder ?? undefined,
  }
}
