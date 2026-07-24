export const MARKETPLACE_NAVIGATION_SOURCE = "marketplace" as const

export interface MarketplaceProductIntent {
  productId: string
  source: typeof MARKETPLACE_NAVIGATION_SOURCE
}

export interface MarketplaceCategoryIntent {
  categoryId: string
  source: typeof MARKETPLACE_NAVIGATION_SOURCE
}

export type MarketplaceProductResolution<T> =
  | { status: "found"; source: "menu" | "targeted"; product: T }
  | { status: "missing" | "inactive"; source: null; product: null }

export function buildMarketplaceOfferHref(input: {
  restaurantSlug: string
  productId?: string | null
  categoryId?: string | null
  preserve?: URLSearchParams | Record<string, string | null | undefined>
}): string {
  const slug = sanitizeMarketplaceSlug(input.restaurantSlug)
  if (!slug) return "/"
  const params = toSearchParams(input.preserve)
  const productId = sanitizeMarketplaceProductId(input.productId)
  const categoryId = sanitizeMarketplaceCategoryId(input.categoryId)
  if (productId) {
    params.set("product", productId)
    params.set("source", MARKETPLACE_NAVIGATION_SOURCE)
  } else if (categoryId) {
    params.set("category", categoryId)
    params.set("source", MARKETPLACE_NAVIGATION_SOURCE)
  }
  const query = params.toString()
  return `/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`
}

export function parseMarketplaceProductIntent(input: URLSearchParams | Record<string, string | string[] | null | undefined>): MarketplaceProductIntent | null {
  const params = input instanceof URLSearchParams ? input : recordToSearchParams(input)
  if (params.get("source") !== MARKETPLACE_NAVIGATION_SOURCE) return null
  const productId = sanitizeMarketplaceProductId(params.get("product"))
  return productId ? { productId, source: MARKETPLACE_NAVIGATION_SOURCE } : null
}

export function parseMarketplaceCategoryIntent(input: URLSearchParams | Record<string, string | string[] | null | undefined>): MarketplaceCategoryIntent | null {
  const params = input instanceof URLSearchParams ? input : recordToSearchParams(input)
  if (params.get("source") !== MARKETPLACE_NAVIGATION_SOURCE) return null
  const categoryId = sanitizeMarketplaceCategoryId(params.get("category"))
  return categoryId ? { categoryId, source: MARKETPLACE_NAVIGATION_SOURCE } : null
}

export function buildMarketplaceIntentKey(slug: string, productId: string): string {
  return `${sanitizeMarketplaceSlug(slug)}::${sanitizeMarketplaceProductId(productId)}`
}

export function claimMarketplaceIntent(handled: Set<string>, key: string): boolean {
  if (!key || handled.has(key)) return false
  handled.add(key)
  return true
}

export function resolveMarketplaceProduct<T extends { id?: unknown; isActive?: unknown; available?: unknown }>(input: {
  productId: string
  loadedProducts: T[]
  targetedProduct?: T | null
}): MarketplaceProductResolution<T> {
  const listed = input.loadedProducts.find((product) => product.id === input.productId)
  const product = listed ?? (input.targetedProduct?.id === input.productId ? input.targetedProduct : null)
  if (!product) return { status: "missing", source: null, product: null }
  if (product.isActive === false || product.available === false) return { status: "inactive", source: null, product: null }
  return { status: "found", source: listed ? "menu" : "targeted", product }
}

export function sanitizeMarketplaceProductId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value.trim()) ? value.trim() : ""
}

export function sanitizeMarketplaceCategoryId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value.trim()) ? value.trim() : ""
}

export function sanitizeMarketplaceSlug(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value.trim()) ? value.trim() : ""
}

function toSearchParams(value?: URLSearchParams | Record<string, string | null | undefined>) {
  if (value instanceof URLSearchParams) return new URLSearchParams(value)
  const params = new URLSearchParams()
  if (value) Object.entries(value).forEach(([key, entry]) => { if (entry) params.set(key, entry) })
  return params
}

function recordToSearchParams(value: Record<string, string | string[] | null | undefined>) {
  const params = new URLSearchParams()
  Object.entries(value).forEach(([key, entry]) => {
    const first = Array.isArray(entry) ? entry[0] : entry
    if (first) params.set(key, first)
  })
  return params
}
