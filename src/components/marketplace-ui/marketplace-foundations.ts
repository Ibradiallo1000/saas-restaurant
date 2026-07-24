import type { ReactNode } from "react"

export type MarketplaceQualityState = "complete" | "partial" | "estimated" | "unavailable"
export type MarketplaceDensity = "comfortable" | "compact"
export type MarketplaceLayoutMode = "rail" | "grid" | "list"
export type MarketplaceFeedbackState = "loading" | "empty" | "error" | "offline" | "stale" | "unavailable"

export interface MarketplaceRestaurantPresentation {
  id: string
  name: string
  slug?: string
  href?: string
  logoUrl?: string | null
  location?: string | null
  serviceLabel?: string | null
  statusLabel?: string | null
  quality?: MarketplaceQualityState
}

export interface MarketplaceOfferPresentation {
  id: string
  productId: string
  restaurant: MarketplaceRestaurantPresentation
  name?: string
  description?: string | null
  imageUrl?: string | null
  priceLabel: string
  previousPriceLabel?: string | null
  availabilityLabel?: string | null
  badgeLabel?: string | null
  href?: string
  quality?: MarketplaceQualityState
}

export interface MarketplaceDishPresentation {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  categoryLabel?: string | null
  priceLabel?: string | null
  offerCountLabel?: string | null
  badgeLabel?: string | null
  quality?: MarketplaceQualityState
  disabled?: boolean
}

export interface MarketplaceCategoryPresentation {
  id: string
  label: string
  icon?: ReactNode
  iconKey?: string | null
  imageUrl?: string | null
  active?: boolean
  disabled?: boolean
}

export interface MarketplaceSectionPresentation {
  id: string
  title: string
  description?: string | null
  layout?: MarketplaceLayoutMode
  density?: MarketplaceDensity
  quality?: MarketplaceQualityState
}

export interface MarketplaceFilterPresentation {
  id: string
  label: string
  selected?: boolean
  disabled?: boolean
  countLabel?: string | null
}

export interface MarketplaceSearchPresentation {
  value: string
  label: string
  placeholder?: string
  resultCount?: number
  loading?: boolean
  disabled?: boolean
}

export const MARKETPLACE_QUALITY_LABELS: Record<MarketplaceQualityState, string> = {
  complete: "Données complètes",
  partial: "Données partielles",
  estimated: "Données estimées",
  unavailable: "Données indisponibles",
}

export const MARKETPLACE_LAYOUT_CLASSES: Record<MarketplaceLayoutMode, string> = {
  rail: "marketplace-rail",
  grid: "marketplace-grid",
  list: "marketplace-list",
}

export const MARKETPLACE_REQUIRED_TEST_WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024, 1440] as const

export const MARKETPLACE_FOUNDATION_CLASSES = {
  root: "marketplace-root",
  container: "marketplace-container",
  reducedMotion: "marketplace-reduced-motion",
  rail: "marketplace-rail",
  grid: "marketplace-grid",
  list: "marketplace-list",
} as const
