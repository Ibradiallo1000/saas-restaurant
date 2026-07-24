import type { PlatformDataQuality } from "@/components/platform-ui"

export interface PlatformContactRequestSource {
  id: string
  restaurantName?: string
  establishmentType?: string
  managerName?: string
  city?: string
  phone?: string
  email?: string
  status?: string
}

export interface PlatformContactRequestPresentation {
  id: string
  restaurantName: string
  establishmentType?: string
  managerName: string
  city?: string
  phone?: string
  email?: string
  isNew: boolean
}

export interface PlatformDashboardViewModel {
  requests: PlatformContactRequestPresentation[]
  requestCount: number
  newRequestCount: number
  requestQuality: PlatformDataQuality
}

export function buildPlatformDashboardViewModel(requests: PlatformContactRequestSource[] | null | undefined): PlatformDashboardViewModel {
  const normalized = (requests ?? []).map((request) => ({
    id: request.id,
    restaurantName: request.restaurantName?.trim() || "Établissement non renseigné",
    establishmentType: request.establishmentType?.trim() || undefined,
    managerName: request.managerName?.trim() || "Responsable non renseigné",
    city: request.city?.trim() || undefined,
    phone: request.phone?.trim() || undefined,
    email: request.email?.trim() || undefined,
    isNew: request.status === "new",
  }))

  return {
    requests: normalized,
    requestCount: normalized.length,
    newRequestCount: normalized.filter((request) => request.isNew).length,
    requestQuality: "partial",
  }
}

