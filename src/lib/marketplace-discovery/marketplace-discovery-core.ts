import type {
  MarketplaceCategorySource,
  MarketplaceDishOfferDocument,
  MarketplaceDiscoveryCursor,
  MarketplaceProductSource,
  MarketplaceRestaurantSource,
  MarketplaceRestaurantCategoryOfferDocument,
} from "./marketplace-discovery-types"

const MARKETPLACE_DISCOVERY_SCHEMA_VERSION = 1 as const

export const MARKETPLACE_DISCOVERY_PUBLIC_FIELDS = [
  "schemaVersion", "restaurantId", "restaurantSlug", "productId", "categoryId",
  "marketplaceCategoryId", "sourceTemplateId", "name", "normalizedName", "searchTokens",
  "description", "imageUrl", "imageAlt", "currency", "displayPrice", "priceMode",
  "hasConfigurator", "restaurantName", "restaurantLogoUrl", "restaurantLocation",
  "restaurantCityName", "restaurantCommuneName", "restaurantDistrictName",
  "restaurantServices", "restaurantCuisineTypes", "restaurantOpeningHours", "restaurantTimezone",
  "restaurantActive", "productActive",
  "discoverable", "orderCount", "createdAt", "sourceUpdatedAt", "projectedAt", "quality",
] as const

export const MARKETPLACE_RESTAURANT_CATEGORY_OFFER_PUBLIC_FIELDS = [
  "schemaVersion", "restaurantId", "restaurantSlug", "restaurantName", "restaurantLogoUrl",
  "marketplaceCategoryId", "localCategoryId", "productCount", "minimumPrice",
  "representativeImageUrl", "cityName", "communeName", "districtName", "discoverable",
  "restaurantOpeningHours", "restaurantTimezone", "sourceUpdatedAt", "updatedAt",
] as const

export const MARKETPLACE_DISCOVERY_FORBIDDEN_FIELDS = [
  "costPrice", "margin", "stockQuantity", "recipe", "ingredients", "supplier", "ownerId",
  "userId", "email", "phone", "paymentConfig", "cloudinarySecret", "token", "permissions", "logs",
] as const

export function normalizeMarketplaceSearch(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLocaleLowerCase("fr")
    .replace(/['-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildMarketplaceSearchTokens(value: unknown, maximum = 12): string[] {
  const normalized = normalizeMarketplaceSearch(value)
  if (!normalized) return []
  return Array.from(new Set([normalized, ...normalized.split(" ")])).filter(Boolean).slice(0, Math.max(1, Math.min(maximum, 20)))
}

export function buildMarketplaceOfferId(restaurantId: string, productId: string): string {
  const restaurant = sanitizeIdentifierPart(restaurantId)
  const product = sanitizeIdentifierPart(productId)
  if (!restaurant || !product) throw new Error("restaurantId and productId are required")
  return `${restaurant}__${product}`
}

export function buildMarketplaceRestaurantCategoryOfferId(restaurantId: string, marketplaceCategoryId: string): string {
  const restaurant = sanitizeIdentifierPart(restaurantId)
  const category = sanitizeIdentifierPart(marketplaceCategoryId)
  if (!restaurant || !category) throw new Error("restaurantId and marketplaceCategoryId are required")
  return `${restaurant}__${category}`
}

export function resolveMarketplacePrice(product: MarketplaceProductSource): {
  displayPrice: number | null
  priceMode: "exact" | "from" | "unavailable"
  hasConfigurator: boolean
} {
  const configurable = [product.options, product.linkedOptionGroups, product.sizes, product.variants]
    .some((value) => Array.isArray(value) && value.length > 0)
  const direct = firstPositiveNumber(product.basePrice, product.price, product.unitPrice)
  const variantPrices = [...extractPrices(product.sizes), ...extractPrices(product.variants)]
  const candidates = [direct, ...variantPrices].filter((value): value is number => value !== null)
  const displayPrice = candidates.length ? Math.min(...candidates) : null
  return {
    displayPrice,
    priceMode: displayPrice === null ? "unavailable" : configurable || variantPrices.length > 0 ? "from" : "exact",
    hasConfigurator: configurable,
  }
}

export interface MarketplacePublishability {
  restaurantPublishable: boolean
  categoryPublishable: boolean
  marketplaceCategoryMapped: boolean
  productPublishable: boolean
  hasMinimumPublicData: boolean
  discoverable: boolean
  reasons: string[]
}

export function evaluateMarketplaceDishPublishability(input: {
  restaurant: MarketplaceRestaurantSource
  product: MarketplaceProductSource
  category?: MarketplaceCategorySource | null
}): MarketplacePublishability {
  const { category = null, product, restaurant } = input
  const restaurantName = stringValue(restaurant.name)
  const restaurantSlug = stringValue(restaurant.slug)
  const productName = stringValue(product.name)
  const restaurantPublishable = restaurant.status === "active" && restaurant.isActive !== false && !restaurant.deletedAt && Boolean(restaurantName && restaurantSlug)
  const categoryId = stringValue(product.categoryId)
  const marketplaceCategoryId = nullableString(product.marketplaceCategoryId || category?.marketplaceCategoryId)
  const categoryPublishable = category ? category.isActive !== false && !category.deletedAt : !categoryId
  const marketplaceCategoryMapped = Boolean(marketplaceCategoryId)
  const productPublishable = product.isActive === true && product.available !== false && !product.deletedAt
  const hasMinimumPublicData = Boolean(product.id && productName && restaurant.id && restaurantName && restaurantSlug)
  const reasons: string[] = []

  if (!restaurantPublishable) reasons.push("restaurant-not-publishable")
  if (!categoryPublishable) reasons.push("category-not-publishable")
  if (!marketplaceCategoryMapped) reasons.push("missing-marketplace-category")
  if (!productPublishable) reasons.push("product-not-publishable")
  if (!hasMinimumPublicData) reasons.push("missing-public-data")

  return {
    restaurantPublishable,
    categoryPublishable,
    marketplaceCategoryMapped,
    productPublishable,
    hasMinimumPublicData,
    discoverable: restaurantPublishable && categoryPublishable && marketplaceCategoryMapped && productPublishable && hasMinimumPublicData,
    reasons,
  }
}

export function projectMarketplaceDishOffer(input: {
  restaurant: MarketplaceRestaurantSource
  product: MarketplaceProductSource
  category?: MarketplaceCategorySource | null
  projectedAt: string
}): MarketplaceDishOfferDocument {
  const { category = null, product, projectedAt, restaurant } = input
  const name = stringValue(product.name)
  const restaurantName = stringValue(restaurant.name)
  const restaurantSlug = stringValue(restaurant.slug)
  const publishability = evaluateMarketplaceDishPublishability(input)
  const price = resolveMarketplacePrice(product)
  const categoryId = nullableString(product.categoryId || category?.id)
  const marketplaceCategoryId = nullableString(product.marketplaceCategoryId || category?.marketplaceCategoryId)
  const sourceUpdatedAt = latestTimestamp(product.updatedAt, category?.updatedAt, restaurant.updatedAt)
  const quality = !publishability.discoverable ? "unavailable" : price.displayPrice === null || !stringValue(product.imageUrl) ? "partial" : "complete"

  return assertMarketplaceProjectionFields({
    schemaVersion: MARKETPLACE_DISCOVERY_SCHEMA_VERSION,
    restaurantId: restaurant.id,
    restaurantSlug,
    productId: product.id,
    categoryId,
    marketplaceCategoryId,
    sourceTemplateId: nullableString(product.sourceTemplateId || product.templateId || category?.sourceTemplateId || category?.templateId),
    name,
    normalizedName: normalizeMarketplaceSearch(name),
    searchTokens: buildMarketplaceSearchTokens(`${name} ${stringValue(product.description)} ${stringValue(category?.name)}`),
    description: nullableString(product.description),
    imageUrl: nullableString(product.imageUrl),
    imageAlt: nullableString(product.imageAlt) || name,
    currency: stringValue(restaurant.currency) || "XOF",
    ...price,
    restaurantName,
    restaurantLogoUrl: restaurantLogoUrl(restaurant),
    restaurantLocation: nullableString([restaurantAddress(restaurant), stringValue(restaurant.cityName || restaurant.city), stringValue(restaurant.countryName || restaurant.countryCode || restaurant.country)].filter(Boolean).join(", ")),
    restaurantCityName: nullableString(restaurant.cityName || restaurant.city),
    restaurantCommuneName: nullableString(restaurant.communeName),
    restaurantDistrictName: nullableString(restaurant.districtName),
    restaurantServices: stringArray(restaurant.services),
    restaurantCuisineTypes: stringArray(restaurant.cuisineTypes || restaurant.cuisineType),
    restaurantOpeningHours: projectOpeningHours(restaurant.openingHours),
    restaurantTimezone: projectTimezone(restaurant.timezone),
    restaurantActive: publishability.restaurantPublishable,
    productActive: publishability.productPublishable,
    discoverable: publishability.discoverable,
    orderCount: nonNegativeNumber(product.orderCount),
    createdAt: timestampString(product.createdAt),
    sourceUpdatedAt,
    projectedAt,
    quality,
  })
}

export function projectMarketplaceRestaurantCategoryOffer(input: {
  restaurantId: string
  marketplaceCategoryId: string
  offers: Array<MarketplaceDishOfferDocument & { id?: string }>
  updatedAt: string
}): MarketplaceRestaurantCategoryOfferDocument {
  const visibleOffers = input.offers.filter((offer) => offer.discoverable && offer.marketplaceCategoryId === input.marketplaceCategoryId)
  const first = visibleOffers[0]
  const productIds = new Set(visibleOffers.map((offer) => offer.productId).filter(Boolean))
  const minimumPrice = visibleOffers
    .map((offer) => offer.displayPrice)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price >= 0)
    .sort((a, b) => a - b)[0] ?? null
  const representative = [...visibleOffers]
    .filter((offer) => Boolean(offer.imageUrl))
    .sort((a, b) => {
      const priceA = typeof a.displayPrice === "number" ? a.displayPrice : Number.POSITIVE_INFINITY
      const priceB = typeof b.displayPrice === "number" ? b.displayPrice : Number.POSITIVE_INFINITY
      if (priceA !== priceB) return priceA - priceB
      return a.productId.localeCompare(b.productId)
    })[0]

  return assertMarketplaceRestaurantCategoryOfferFields({
    schemaVersion: MARKETPLACE_DISCOVERY_SCHEMA_VERSION,
    restaurantId: input.restaurantId,
    restaurantSlug: first?.restaurantSlug || "",
    restaurantName: first?.restaurantName || "",
    restaurantLogoUrl: first?.restaurantLogoUrl || null,
    marketplaceCategoryId: input.marketplaceCategoryId,
    localCategoryId: choosePrimaryLocalCategoryId(visibleOffers),
    productCount: productIds.size,
    minimumPrice,
    representativeImageUrl: representative?.imageUrl || first?.imageUrl || null,
    cityName: first?.restaurantCityName || null,
    communeName: first?.restaurantCommuneName || null,
    districtName: first?.restaurantDistrictName || null,
    restaurantOpeningHours: first?.restaurantOpeningHours ? projectOpeningHours(first.restaurantOpeningHours) : null,
    restaurantTimezone: first?.restaurantTimezone ? projectTimezone(first.restaurantTimezone) : null,
    discoverable: visibleOffers.length > 0,
    sourceUpdatedAt: latestTimestamp(...visibleOffers.map((offer) => offer.sourceUpdatedAt)),
    updatedAt: input.updatedAt,
  })
}

export function assertMarketplaceProjectionFields<T extends Record<string, unknown>>(document: T): T & MarketplaceDishOfferDocument {
  const allowed = new Set<string>(MARKETPLACE_DISCOVERY_PUBLIC_FIELDS)
  const unexpected = Object.keys(document).filter((key) => !allowed.has(key))
  if (unexpected.length) throw new Error(`Unexpected marketplace projection fields: ${unexpected.join(", ")}`)
  for (const field of MARKETPLACE_DISCOVERY_FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(document, field)) throw new Error(`Forbidden marketplace projection field: ${field}`)
  }
  return document as T & MarketplaceDishOfferDocument
}

export function assertMarketplaceRestaurantCategoryOfferFields<T extends Record<string, unknown>>(document: T): T & MarketplaceRestaurantCategoryOfferDocument {
  const allowed = new Set<string>(MARKETPLACE_RESTAURANT_CATEGORY_OFFER_PUBLIC_FIELDS)
  const unexpected = Object.keys(document).filter((key) => !allowed.has(key))
  if (unexpected.length) throw new Error(`Unexpected marketplace restaurant category fields: ${unexpected.join(", ")}`)
  for (const field of MARKETPLACE_DISCOVERY_FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(document, field)) throw new Error(`Forbidden marketplace restaurant category field: ${field}`)
  }
  return document as T & MarketplaceRestaurantCategoryOfferDocument
}

export function encodeMarketplaceCursor(cursor: MarketplaceDiscoveryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeMarketplaceCursor(value: string): MarketplaceDiscoveryCursor {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MarketplaceDiscoveryCursor>
  if ((typeof parsed.sortValue !== "string" && typeof parsed.sortValue !== "number") || typeof parsed.offerId !== "string" || !parsed.offerId) {
    throw new Error("Invalid marketplace cursor")
  }
  return { sortValue: parsed.sortValue, offerId: parsed.offerId }
}

function sanitizeIdentifierPart(value: string) { return typeof value === "string" ? value.trim().replace(/\//g, "_") : "" }
function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : "" }
function nullableString(value: unknown) { const result = stringValue(value); return result || null }
function stringArray(value: unknown) { return (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).map(stringValue).filter(Boolean).slice(0, 20) }
function nonNegativeNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : null }
function firstPositiveNumber(...values: unknown[]) { for (const value of values) { const number = Number(value); if (Number.isFinite(number) && number > 0) return number } return null }
function extractPrices(value: unknown): number[] { return Array.isArray(value) ? value.map((entry) => firstPositiveNumber((entry as { price?: unknown })?.price)).filter((price): price is number => price !== null) : [] }
function timestampString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") return timestampString((value as { toDate: () => Date }).toDate())
  return null
}
function latestTimestamp(...values: unknown[]) { return values.map(timestampString).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null }
function restaurantAddress(restaurant: MarketplaceRestaurantSource) {
  const location = restaurant.location && typeof restaurant.location === "object" ? restaurant.location as { address?: unknown } : null
  return stringValue(location?.address) || stringValue(restaurant.address)
}
function restaurantLogoUrl(restaurant: MarketplaceRestaurantSource) {
  const logo = restaurant.logo && typeof restaurant.logo === "object" ? restaurant.logo as { url?: unknown } : null
  return nullableString(restaurant.logoUrl || restaurant.logoImageUrl || logo?.url || restaurant.logo)
}
function choosePrimaryLocalCategoryId(offers: Array<MarketplaceDishOfferDocument & { id?: string }>) {
  const counts = new Map<string, { count: number; minimumPrice: number }>()
  for (const offer of offers) {
    if (!offer.categoryId) continue
    const current = counts.get(offer.categoryId) ?? { count: 0, minimumPrice: Number.POSITIVE_INFINITY }
    current.count += 1
    if (typeof offer.displayPrice === "number" && offer.displayPrice < current.minimumPrice) current.minimumPrice = offer.displayPrice
    counts.set(offer.categoryId, current)
  }
  return [...counts.entries()]
    .sort(([idA, a], [idB, b]) => b.count - a.count || a.minimumPrice - b.minimumPrice || idA.localeCompare(idB))[0]?.[0] ?? null
}

function projectTimezone(value: unknown) {
  return stringValue(value) || "Africa/Bamako"
}

function projectOpeningHours(value: unknown) {
  return value && typeof value === "object" ? value : null
}
