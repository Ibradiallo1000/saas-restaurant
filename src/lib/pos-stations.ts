export const DEFAULT_POS_STATION_ID = "DEFAULT" as const

export type PosCatalogMode = "ALL" | "RESTRICTED"

export type PosStationLike = {
  id?: string
  name?: unknown
  code?: unknown
  isActive?: unknown
  catalogMode?: unknown
  allowedCategoryIds?: unknown
  allowedProductIds?: unknown
  excludedProductIds?: unknown
  activeSessionId?: unknown
}

export type ResolvedPosStation = {
  id: string
  name: string
  code: string
  isActive: boolean
  catalogMode: PosCatalogMode
  allowedCategoryIds: string[]
  allowedProductIds: string[]
  excludedProductIds: string[]
  activeSessionId: string | null
  virtual: boolean
}

export type PosCatalogScope = Pick<ResolvedPosStation, "catalogMode" | "allowedCategoryIds" | "allowedProductIds" | "excludedProductIds">

export const DEFAULT_POS_STATION: ResolvedPosStation = Object.freeze({
  id: DEFAULT_POS_STATION_ID,
  name: "Caisse principale",
  code: DEFAULT_POS_STATION_ID,
  isActive: true,
  catalogMode: "ALL",
  allowedCategoryIds: [],
  allowedProductIds: [],
  excludedProductIds: [],
  activeSessionId: null,
  virtual: true,
})

export function resolvePosStation(station: PosStationLike | null | undefined): ResolvedPosStation {
  if (!station || station.id === DEFAULT_POS_STATION_ID) return { ...DEFAULT_POS_STATION }
  return {
    id: String(station.id),
    name: cleanString(station.name) || String(station.id),
    code: cleanString(station.code) || String(station.id),
    isActive: station.isActive !== false,
    catalogMode: station.catalogMode === "RESTRICTED" ? "RESTRICTED" : "ALL",
    allowedCategoryIds: stringArray(station.allowedCategoryIds),
    allowedProductIds: stringArray(station.allowedProductIds),
    excludedProductIds: stringArray(station.excludedProductIds),
    activeSessionId: cleanString(station.activeSessionId) || null,
    virtual: false,
  }
}

export function resolveStaffPosStationIds(staff: Record<string, unknown> | null | undefined) {
  const explicit = stringArray(staff?.allowedPosStationIds)
  return explicit.length ? explicit : [DEFAULT_POS_STATION_ID]
}

export function resolveStaffDefaultPosStationId(staff: Record<string, unknown> | null | undefined) {
  const allowed = resolveStaffPosStationIds(staff)
  const requested = cleanString(staff?.defaultPosStationId)
  return requested && allowed.includes(requested) ? requested : allowed[0]
}

export function resolveSessionPosStationId(session: Record<string, unknown> | null | undefined) {
  return cleanString(session?.posStationId) || DEFAULT_POS_STATION_ID
}

export function resolvePosCatalogScope(value: Record<string, unknown> | null | undefined): PosCatalogScope {
  const source = value?.posCatalogScopeSnapshot && typeof value.posCatalogScopeSnapshot === "object"
    ? value.posCatalogScopeSnapshot as Record<string, unknown>
    : value ?? {}
  return {
    catalogMode: source.mode === "RESTRICTED" || source.catalogMode === "RESTRICTED" ? "RESTRICTED" : "ALL",
    allowedCategoryIds: stringArray(source.allowedCategoryIds),
    allowedProductIds: stringArray(source.allowedProductIds),
    excludedProductIds: stringArray(source.excludedProductIds),
  }
}

export function isProductAllowedAtPosStation(
  scopeValue: Record<string, unknown> | null | undefined,
  product: { id?: unknown; categoryId?: unknown }
) {
  const productId = cleanString(product.id)
  if (!productId) return false
  const scope = resolvePosCatalogScope(scopeValue)
  if (scope.excludedProductIds.includes(productId)) return false
  if (scope.catalogMode === "ALL") return true
  const categoryId = cleanString(product.categoryId)
  return scope.allowedProductIds.includes(productId)
    || (Boolean(categoryId) && scope.allowedCategoryIds.includes(categoryId))
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(cleanString).filter((entry): entry is string => Boolean(entry)))]
    : []
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}
