import type { PlatformRestaurantState } from "@/components/platform-ui"

export interface PlatformRestaurantSource {
  id: string
  name?: string
  ownerEmail?: string
  logoUrl?: string
  logo?: string
  coverImage?: string
  coverImageUrl?: string
  phone?: string
  status?: string
  subscriptionStatus?: string
  active?: boolean
  isActive?: boolean
  city?: string
  cityName?: string
  country?: string
  districtName?: string
  neighborhoodName?: string
  communeName?: string
  address?: string
  location?: {
    address?: unknown
    lat?: unknown
    lng?: unknown
  }
  slug?: string
  subscriptionEndDate?: unknown
}

export interface PlatformRestaurantPresentation {
  id: string
  name: string
  ownerEmail?: string
  imageUrl?: string
  phone?: string
  state: PlatformRestaurantState
  stateLabel: string
  isActive: boolean
  city?: string
  neighborhood?: string
  location?: string
  address?: string
  hasConfiguredLocation: boolean
  slug?: string
  subscriptionEndDate: string
}

export function buildPlatformRestaurantsViewModel(restaurants: PlatformRestaurantSource[]): PlatformRestaurantPresentation[] {
  return restaurants.map((restaurant) => {
    const rawState = restaurant.subscriptionStatus || restaurant.status
    const city = text(restaurant.cityName) || text(restaurant.city)
    const neighborhood = text(restaurant.neighborhoodName) || text(restaurant.districtName) || text(restaurant.communeName)
    const address = text(restaurant.location?.address) || text(restaurant.address)
    const location = [city, neighborhood].filter(Boolean).join(" · ")
    const lat = Number(restaurant.location?.lat)
    const lng = Number(restaurant.location?.lng)
    const isActive = normalizeRestaurantState(restaurant.status, restaurant.active ?? restaurant.isActive) === "active"
    return {
      id: restaurant.id,
      name: text(restaurant.name) || "Restaurant sans nom",
      ownerEmail: text(restaurant.ownerEmail) || undefined,
      imageUrl: text(restaurant.logoUrl) || text(restaurant.logo) || text(restaurant.coverImage) || text(restaurant.coverImageUrl) || undefined,
      phone: text(restaurant.phone) || undefined,
      state: normalizeRestaurantState(restaurant.status, restaurant.active ?? restaurant.isActive),
      stateLabel: rawState?.trim() || "Inconnu",
      isActive,
      city: city || undefined,
      neighborhood: neighborhood || undefined,
      location: location || text(restaurant.country) || undefined,
      address: address || undefined,
      hasConfiguredLocation: Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180,
      slug: text(restaurant.slug) || undefined,
      subscriptionEndDate: formatRestaurantDate(restaurant.subscriptionEndDate),
    }
  })
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeRestaurantState(status?: string, active?: boolean): PlatformRestaurantState {
  if (status === "active" || active === true) return "active"
  if (status === "inactive" || active === false) return "inactive"
  if (status === "suspended") return "suspended"
  if (status === "provisioning" || status === "pending") return "provisioning"
  if (status === "error" || status === "failed") return "error"
  return "unknown"
}

function formatRestaurantDate(value: unknown) {
  if (!value) return "Non définie"
  const date = typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function" ? (value as { toDate: () => Date }).toDate() : new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? "Non définie" : date.toLocaleDateString()
}
