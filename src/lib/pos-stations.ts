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
  cashFloat?: unknown
  paymentBalances?: unknown
}

export const POS_STATION_PAYMENT_BALANCE_KEYS = [
  "orange_money",
  "wave",
  "moov_money",
  "card",
  "bank_transfer",
] as const

export type PosStationPaymentBalanceKey = (typeof POS_STATION_PAYMENT_BALANCE_KEYS)[number]

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
  cashFloat: {
    amount: number
    updatedAt?: unknown
    updatedBy?: string | null
  }
  paymentBalances: Record<PosStationPaymentBalanceKey, number>
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
  cashFloat: { amount: 0, updatedAt: null, updatedBy: null },
  paymentBalances: emptyPaymentBalances(),
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
    cashFloat: resolveCashFloat(station.cashFloat),
    paymentBalances: resolvePaymentBalances(station.paymentBalances),
    virtual: false,
  }
}

export function emptyPaymentBalances() {
  return POS_STATION_PAYMENT_BALANCE_KEYS.reduce((balances, key) => {
    balances[key] = 0
    return balances
  }, {} as Record<PosStationPaymentBalanceKey, number>)
}

export function resolvePaymentBalances(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const balances = emptyPaymentBalances()
  for (const key of POS_STATION_PAYMENT_BALANCE_KEYS) {
    const amount = Math.round(Number(source[key] || 0))
    balances[key] = Number.isFinite(amount) && amount >= 0 ? amount : 0
  }
  return balances
}

export function normalizePaymentProviderToBalanceKey(provider: unknown): PosStationPaymentBalanceKey | null {
  const value = cleanString(provider).toLowerCase().replace(/[^a-z0-9]+/g, "_")
  if (["orange", "orange_money", "om"].includes(value)) return "orange_money"
  if (["wave", "wave_money"].includes(value)) return "wave"
  if (["moov", "moov_money"].includes(value)) return "moov_money"
  if (["card", "bank_card", "carte", "carte_bancaire"].includes(value)) return "card"
  if (["bank", "bank_transfer", "virement", "virement_bancaire"].includes(value)) return "bank_transfer"
  return null
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

function resolveCashFloat(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const amount = Math.round(Number(source.amount || 0))
  return {
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    updatedAt: source.updatedAt ?? null,
    updatedBy: cleanString(source.updatedBy) || null,
  }
}
