export const MARKETPLACE_DISCOVERY_SCHEMA_VERSION = 1 as const
export const MARKETPLACE_DISH_OFFERS_COLLECTION = "marketplaceDishOffers" as const
export const MARKETPLACE_FOOD_CATEGORIES_COLLECTION = "marketplaceFoodCategories" as const
export const MARKETPLACE_RESTAURANT_CATEGORY_OFFERS_COLLECTION = "marketplaceRestaurantCategoryOffers" as const

export type MarketplaceDiscoveryQuality = "complete" | "partial" | "stale" | "unavailable" | "unknown"
export type MarketplacePriceMode = "exact" | "from" | "unavailable"

export interface MarketplaceRestaurantSource {
  id: string
  name?: unknown
  slug?: unknown
  status?: unknown
  isActive?: unknown
  deletedAt?: unknown
  logoUrl?: unknown
  logo?: unknown
  logoImageUrl?: unknown
  address?: unknown
  city?: unknown
  cityName?: unknown
  communeName?: unknown
  districtName?: unknown
  countryCode?: unknown
  countryName?: unknown
  country?: unknown
  location?: unknown
  currency?: unknown
  services?: unknown
  cuisineTypes?: unknown
  cuisineType?: unknown
  openingHours?: unknown
  timezone?: unknown
  updatedAt?: unknown
}

export interface MarketplaceCategorySource {
  id: string
  name?: unknown
  marketplaceCategoryId?: unknown
  sourceTemplateId?: unknown
  templateId?: unknown
  isActive?: unknown
  deletedAt?: unknown
  updatedAt?: unknown
}

export interface MarketplaceProductSource {
  id: string
  name?: unknown
  description?: unknown
  imageUrl?: unknown
  imageAlt?: unknown
  categoryId?: unknown
  marketplaceCategoryId?: unknown
  sourceTemplateId?: unknown
  templateId?: unknown
  price?: unknown
  basePrice?: unknown
  unitPrice?: unknown
  sizes?: unknown
  variants?: unknown
  options?: unknown
  linkedOptionGroups?: unknown
  isActive?: unknown
  available?: unknown
  deletedAt?: unknown
  orderCount?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export interface MarketplaceDishOfferDocument {
  schemaVersion: typeof MARKETPLACE_DISCOVERY_SCHEMA_VERSION
  restaurantId: string
  restaurantSlug: string
  productId: string
  categoryId: string | null
  marketplaceCategoryId: string | null
  sourceTemplateId: string | null
  name: string
  normalizedName: string
  searchTokens: string[]
  description: string | null
  imageUrl: string | null
  imageAlt: string
  currency: string
  displayPrice: number | null
  priceMode: MarketplacePriceMode
  hasConfigurator: boolean
  restaurantName: string
  restaurantLogoUrl: string | null
  restaurantLocation: string | null
  restaurantCityName: string | null
  restaurantCommuneName: string | null
  restaurantDistrictName: string | null
  restaurantServices: string[]
  restaurantCuisineTypes: string[]
  restaurantOpeningHours: unknown
  restaurantTimezone: string | null
  restaurantActive: boolean
  productActive: boolean
  discoverable: boolean
  orderCount: number | null
  createdAt: string | null
  sourceUpdatedAt: string | null
  projectedAt: string
  quality: MarketplaceDiscoveryQuality
}

export interface MarketplaceFoodCategoryDocument {
  schemaVersion: typeof MARKETPLACE_DISCOVERY_SCHEMA_VERSION
  name: string
  slug: string
  normalizedName: string
  icon: string | null
  iconKey?: string | null
  imageUrl: string | null
  sortOrder: number
  active: boolean
  aliases: string[]
  createdAt?: string | null
  updatedAt?: string | null
}

export interface MarketplaceRestaurantCategoryOfferDocument {
  schemaVersion: typeof MARKETPLACE_DISCOVERY_SCHEMA_VERSION
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  marketplaceCategoryId: string
  localCategoryId: string | null
  productCount: number
  minimumPrice: number | null
  representativeImageUrl: string | null
  cityName: string | null
  communeName: string | null
  districtName: string | null
  restaurantOpeningHours: unknown
  restaurantTimezone: string | null
  discoverable: boolean
  sourceUpdatedAt: string | null
  updatedAt: string
}

export interface MarketplaceDiscoveryCursor {
  sortValue: string | number
  offerId: string
}

export interface MarketplaceDiscoveryPage {
  offers: Array<MarketplaceDishOfferDocument & { id: string }>
  nextCursor: string | null
}

export interface MarketplaceRestaurantCategoryOfferPage {
  offers: Array<MarketplaceRestaurantCategoryOfferDocument & { id: string }>
  nextCursor: string | null
}

export interface MarketplaceDiscoveryQuery {
  pageSize?: number
  cursor?: string | null
  categoryId?: string | null
  restaurantId?: string | null
  normalizedPrefix?: string | null
  order?: "name" | "recent" | "popular"
}

export interface MarketplaceRestaurantCategoryOfferQuery {
  pageSize?: number
  cursor?: string | null
  categoryId: string
}
