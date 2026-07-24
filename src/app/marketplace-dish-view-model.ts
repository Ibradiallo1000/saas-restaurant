import type { MarketplaceCategoryPresentation, MarketplaceQualityState } from "@/components/marketplace-ui"
import type { MarketplaceDishOfferDocument, MarketplaceFoodCategoryDocument, MarketplaceRestaurantCategoryOfferDocument } from "@/lib/marketplace-discovery"
import { buildMarketplaceOfferHref } from "@/lib/marketplace-offer-navigation"
import { getRestaurantOpenStatus } from "@/lib/restaurant-hours"

export interface MarketplaceRestaurantCardPresentation {
  id: string
  restaurantId: string
  categoryId: string | null
  marketplaceCategoryId: string
  name: string
  slug: string
  href: string
  logoUrl: string | null
  imageUrl: string | null
  locationLabel: string | null
  productCountLabel: string
  minimumPriceLabel: string
  isOpenNow: boolean
  statusLabel: string
  statusDetail: string
}

export interface MarketplaceSearchDishPresentation {
  id: string
  name: string
  restaurantId: string
  marketplaceCategoryId: string | null
  localCategoryId: string | null
  categoryLabel: string | null
}

export interface MarketplaceDishHomeViewModel {
  restaurants: MarketplaceRestaurantCardPresentation[]
  restaurantsByCategory: Record<string, MarketplaceRestaurantCardPresentation[]>
  nextCursorByCategory: Record<string, string | null>
  searchableDishes: MarketplaceSearchDishPresentation[]
  categories: MarketplaceCategoryPresentation[]
  selectedCategoryId: string | null
  selectedCategoryLabel: string | null
  nextCursor: string | null
  resultCountLabel: string
  quality: MarketplaceQualityState
}

export function buildMarketplaceDishHomeViewModel(input: {
  restaurantCategoryOffers?: Array<MarketplaceRestaurantCategoryOfferDocument & { id: string }>
  restaurantCategoryOffersByCategory?: Record<string, Array<MarketplaceRestaurantCategoryOfferDocument & { id: string }>>
  dishOffers?: Array<MarketplaceDishOfferDocument & { id: string }>
  categories: Array<MarketplaceFoodCategoryDocument & { id: string }>
  selectedCategoryId?: string | null
  nextCursor?: string | null
  nextCursorByCategory?: Record<string, string | null>
}): MarketplaceDishHomeViewModel {
  const selectedCategoryId = input.selectedCategoryId ?? input.categories[0]?.id ?? null
  const selectedCategory = input.categories.find((category) => category.id === selectedCategoryId) ?? null
  const offersByCategory = input.restaurantCategoryOffersByCategory ?? (selectedCategoryId ? { [selectedCategoryId]: input.restaurantCategoryOffers ?? [] } : {})
  const restaurantsByCategory = Object.fromEntries(
    Object.entries(offersByCategory).map(([categoryId, offers]) => [categoryId, sortRestaurantsForMarketplace(offers.map(toRestaurantPresentation))])
  )
  const restaurants = selectedCategoryId ? restaurantsByCategory[selectedCategoryId] ?? [] : []
  const allRestaurants = Object.values(restaurantsByCategory).flat()
  const categoryLabels = new Map(input.categories.map((category) => [category.id, category.name]))
  const hasPartial = allRestaurants.some((restaurant) => !restaurant.logoUrl || !restaurant.locationLabel)

  return {
    restaurants,
    restaurantsByCategory,
    nextCursorByCategory: input.nextCursorByCategory ?? (selectedCategoryId ? { [selectedCategoryId]: input.nextCursor ?? null } : {}),
    searchableDishes: (input.dishOffers ?? []).map((offer) => ({
      id: offer.id,
      name: offer.name,
      restaurantId: offer.restaurantId,
      marketplaceCategoryId: offer.marketplaceCategoryId,
      localCategoryId: offer.categoryId,
      categoryLabel: offer.marketplaceCategoryId ? categoryLabels.get(offer.marketplaceCategoryId) ?? null : null,
    })),
    categories: input.categories.map((category) => ({
      id: category.id,
      label: category.name,
      imageUrl: category.imageUrl,
      active: category.id === selectedCategoryId,
    })),
    selectedCategoryId,
    selectedCategoryLabel: selectedCategory?.name ?? null,
    nextCursor: input.nextCursor ?? null,
    resultCountLabel: `${restaurants.length} restaurant${restaurants.length > 1 ? "s" : ""} sur cette page`,
    quality: hasPartial ? "partial" : "complete",
  }
}

function toRestaurantPresentation(offer: MarketplaceRestaurantCategoryOfferDocument & { id: string }): MarketplaceRestaurantCardPresentation {
  return {
    id: offer.id,
    restaurantId: offer.restaurantId,
    categoryId: offer.localCategoryId,
    marketplaceCategoryId: offer.marketplaceCategoryId,
    name: offer.restaurantName,
    slug: offer.restaurantSlug,
    href: buildMarketplaceOfferHref({ restaurantSlug: offer.restaurantSlug, categoryId: offer.localCategoryId }),
    logoUrl: offer.restaurantLogoUrl,
    imageUrl: offer.representativeImageUrl,
    locationLabel: [offer.cityName, offer.districtName].filter(Boolean).join(" · ") || offer.cityName || offer.districtName || null,
    productCountLabel: `${offer.productCount} produit${offer.productCount > 1 ? "s" : ""}`,
    minimumPriceLabel: formatMinimumPrice(offer.minimumPrice),
    ...toOpenStatusPresentation(offer),
  }
}

function formatMinimumPrice(value: number | null) {
  if (value === null) return "Prix à consulter"
  return `Dès ${value.toLocaleString("fr-FR")} FCFA`
}

function toOpenStatusPresentation(offer: MarketplaceRestaurantCategoryOfferDocument) {
  const status = getRestaurantOpenStatus({
    openingHours: offer.restaurantOpeningHours,
    timezone: offer.restaurantTimezone,
  })
  return {
    isOpenNow: status.isOpenNow,
    statusLabel: status.label,
    statusDetail: status.detail,
  }
}

function sortRestaurantsForMarketplace(restaurants: MarketplaceRestaurantCardPresentation[]) {
  return [...restaurants].sort((a, b) => Number(b.isOpenNow) - Number(a.isOpenNow) || a.name.localeCompare(b.name, "fr"))
}
