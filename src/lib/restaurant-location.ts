export type RestaurantLocationInput = {
  address?: unknown
  googleMapsUrl?: unknown
  lat?: unknown
  lng?: unknown
}

export type NormalizedRestaurantLocation = {
  address: string
  googleMapsUrl: string
  lat: number | null
  lng: number | null
}

export type RestaurantLocationModelInput = {
  phone?: unknown
  countryCode?: unknown
  countryName?: unknown
  cityId?: unknown
  cityName?: unknown
  city?: unknown
  communeId?: unknown
  communeName?: unknown
  districtName?: unknown
  address?: unknown
  location?: RestaurantLocationInput | null
}

export function normalizeText(value: unknown, maximum = 160): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : ""
}

export function normalizeCountryCode(value: unknown): string {
  return normalizeText(value, 2).toUpperCase()
}

export function normalizeGeoCoordinate(value: unknown, minimum: number, maximum: number): number | null {
  if (value === "" || value === null || value === undefined) return null
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number) || number < minimum || number > maximum) return null
  return Number(number.toFixed(6))
}

export function isValidLatitude(value: unknown): boolean {
  return normalizeGeoCoordinate(value, -90, 90) !== null
}

export function isValidLongitude(value: unknown): boolean {
  return normalizeGeoCoordinate(value, -180, 180) !== null
}

export function normalizeSlugSegment(value: unknown, maximum = 80): string {
  return normalizeText(value, maximum)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeRestaurantLocation(value?: RestaurantLocationInput | null): NormalizedRestaurantLocation {
  return {
    address: normalizeText(value?.address, 220),
    googleMapsUrl: normalizeText(value?.googleMapsUrl, 500),
    lat: normalizeGeoCoordinate(value?.lat, -90, 90),
    lng: normalizeGeoCoordinate(value?.lng, -180, 180),
  }
}

export function buildRestaurantLocationPayload(input: RestaurantLocationModelInput) {
  const location = normalizeRestaurantLocation(input.location || {
    address: input.address,
  })
  const countryCode = normalizeCountryCode(input.countryCode)
  const countryName = normalizeText(input.countryName, 100)
  const cityId = normalizeText(input.cityId, 100)
  const cityName = normalizeText(input.cityName || input.city, 120)
  const communeId = normalizeText(input.communeId, 100)
  const communeName = normalizeText(input.communeName, 120)
  const districtName = normalizeText(input.districtName, 120)

  return {
    phone: normalizeText(input.phone, 40),
    countryCode,
    countryName,
    country: countryName || countryCode,
    cityId,
    cityName,
    city: cityName,
    communeId,
    communeName,
    districtName,
    address: location.address,
    location,
  }
}

