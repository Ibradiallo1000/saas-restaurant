import type { PreparationMode } from "@/utils/preparation-logic"
import type { SelectedCartOption } from "@/modules/restaurant/types"
import { getProductBasePrice } from "@/lib/order-pricing"

export type LinkedOptionGroupSourceType = "category" | "products"
export type LinkedOptionPricingMode = "normal" | "included"

export type LinkedOptionGroup = {
  id: string
  title: string
  required: boolean
  minSelect: number
  maxSelect: number
  sourceType: LinkedOptionGroupSourceType
  categoryIds?: string[]
  productIds?: string[]
  pricingMode: LinkedOptionPricingMode
  active: boolean
}

export type LinkedOptionSelection = {
  groupId: string
  groupTitle: string
  productId: string
}

export type ResolvedLinkedProduct = {
  id: string
  name: string
  basePrice: number
  imageUrl?: string
  categoryId?: string
  preparationMode?: PreparationMode
  isActive?: boolean
}

export type BundleCartLine = {
  id: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  imageUrl?: string
  selectedOptions?: SelectedCartOption[]
  bundleId: string
  isBundleMain: boolean
  linkedGroupTitle?: string
  pricingMode?: LinkedOptionPricingMode
}

export function createLinkedOptionGroup(
  partial: Partial<LinkedOptionGroup> = {}
): LinkedOptionGroup {
  return {
    id: partial.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: partial.title || "",
    required: partial.required === true,
    minSelect: Math.max(0, Number(partial.minSelect ?? 0)),
    maxSelect: Math.max(1, Number(partial.maxSelect ?? 1)),
    sourceType: partial.sourceType === "products" ? "products" : "category",
    categoryIds: Array.isArray(partial.categoryIds) ? partial.categoryIds.filter(Boolean) : [],
    productIds: Array.isArray(partial.productIds) ? partial.productIds.filter(Boolean) : [],
    pricingMode: partial.pricingMode === "included" ? "included" : "normal",
    active: partial.active !== false,
  }
}

export function sanitizeLinkedOptionGroups(raw: unknown): LinkedOptionGroup[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((group) => {
      if (!group || typeof group !== "object") return null

      const title = String((group as LinkedOptionGroup).title || "").trim()
      if (!title) return null

      const sourceType =
        (group as LinkedOptionGroup).sourceType === "products" ? "products" : "category"
      const categoryIds = Array.isArray((group as LinkedOptionGroup).categoryIds)
        ? (group as LinkedOptionGroup).categoryIds!.filter(Boolean)
        : []
      const productIds = Array.isArray((group as LinkedOptionGroup).productIds)
        ? (group as LinkedOptionGroup).productIds!.filter(Boolean)
        : []

      if (sourceType === "category" && categoryIds.length === 0) return null
      if (sourceType === "products" && productIds.length === 0) return null

      const required = (group as LinkedOptionGroup).required === true
      let minSelect = Math.max(0, Number((group as LinkedOptionGroup).minSelect ?? 0))
      const maxSelect = Math.max(1, Number((group as LinkedOptionGroup).maxSelect ?? 1))

      if (required && minSelect < 1) minSelect = 1
      if (minSelect > maxSelect) minSelect = maxSelect

      return createLinkedOptionGroup({
        id: String((group as LinkedOptionGroup).id || ""),
        title,
        required,
        minSelect,
        maxSelect,
        sourceType,
        categoryIds,
        productIds,
        pricingMode: (group as LinkedOptionGroup).pricingMode === "included" ? "included" : "normal",
        active: (group as LinkedOptionGroup).active !== false,
      })
    })
    .filter((group): group is LinkedOptionGroup => group !== null)
}

export function getActiveLinkedOptionGroups(product: {
  linkedOptionGroups?: LinkedOptionGroup[]
}): LinkedOptionGroup[] {
  return sanitizeLinkedOptionGroups(product?.linkedOptionGroups).filter((group) => group.active)
}

export function hasEmbeddedProductOptions(product: any): boolean {
  return (
    (Array.isArray(product?.options) && product.options.length > 0) ||
    (Array.isArray(product?.sizes) && product.sizes.length > 0) ||
    (Array.isArray(product?.variants) && product.variants.length > 0)
  )
}

export function productNeedsConfigurator(product: any): boolean {
  return hasEmbeddedProductOptions(product) || getActiveLinkedOptionGroups(product).length > 0
}

export function resolveLinkedGroupProducts(
  group: LinkedOptionGroup,
  catalogProducts: any[]
): ResolvedLinkedProduct[] {
  const activeProducts = (catalogProducts || []).filter(
    (product) => product?.id && product.isActive !== false
  )

  let candidates: any[] = []

  if (group.sourceType === "products") {
    const allowed = new Set(group.productIds || [])
    candidates = activeProducts.filter((product) => allowed.has(product.id))
  } else {
    const allowedCategories = new Set(group.categoryIds || [])
    candidates = activeProducts.filter((product) => allowedCategories.has(product.categoryId))

    if (group.productIds && group.productIds.length > 0) {
      const allowedProducts = new Set(group.productIds)
      candidates = candidates.filter((product) => allowedProducts.has(product.id))
    }
  }

  return candidates
    .map((product) => ({
      id: product.id,
      name: product.name,
      basePrice: getProductBasePrice(product),
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      preparationMode: product.preparationMode,
      isActive: product.isActive !== false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

export function validateLinkedOptionSelections(
  groups: LinkedOptionGroup[],
  selections: LinkedOptionSelection[]
): string | null {
  for (const group of groups) {
    const groupSelections = selections.filter((selection) => selection.groupId === group.id)
    const count = groupSelections.length

    if (count < group.minSelect) {
      if (group.required || group.minSelect > 0) {
        return `Choisissez au moins ${group.minSelect} option(s) pour « ${group.title} »`
      }
    }

    if (count > group.maxSelect) {
      return `Maximum ${group.maxSelect} choix pour « ${group.title} »`
    }

    if (group.required && count === 0) {
      return `« ${group.title} » est obligatoire`
    }
  }

  return null
}

export function getLinkedSelectionUnitPrice(
  product: ResolvedLinkedProduct,
  pricingMode: LinkedOptionPricingMode
): number {
  if (pricingMode === "included") return 0
  return Math.round(product.basePrice)
}

export function createBundleId(): string {
  return `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildBundleCartLines({
  mainProduct,
  selectedOptions = [],
  linkedSelections = [],
  linkedGroups = [],
  catalogProducts = [],
  mainUnitPrice,
}: {
  mainProduct: any
  selectedOptions?: SelectedCartOption[]
  linkedSelections?: LinkedOptionSelection[]
  linkedGroups?: LinkedOptionGroup[]
  catalogProducts?: any[]
  mainUnitPrice: number
}): BundleCartLine[] {
  const bundleId = createBundleId()
  const lines: BundleCartLine[] = [
    {
      id: `${mainProduct.id}_${bundleId}_main`,
      productId: mainProduct.id,
      name: mainProduct.name,
      unitPrice: Math.round(mainUnitPrice),
      quantity: 1,
      imageUrl: mainProduct.imageUrl,
      selectedOptions,
      bundleId,
      isBundleMain: true,
    },
  ]

  linkedSelections.forEach((selection) => {
    const group = linkedGroups.find((item) => item.id === selection.groupId)
    if (!group) return

    const linkedProduct =
      catalogProducts.find((product) => product?.id === selection.productId) ||
      resolveLinkedGroupProducts(group, catalogProducts).find(
        (product) => product.id === selection.productId
      )

    if (!linkedProduct) return

    const resolvedProduct: ResolvedLinkedProduct = {
      id: linkedProduct.id,
      name: linkedProduct.name,
      basePrice: getProductBasePrice(linkedProduct),
      imageUrl: linkedProduct.imageUrl,
      categoryId: linkedProduct.categoryId,
      preparationMode: linkedProduct.preparationMode,
    }

    lines.push({
      id: `${selection.productId}_${bundleId}_${selection.groupId}`,
      productId: selection.productId,
      name: resolvedProduct.name,
      unitPrice: getLinkedSelectionUnitPrice(resolvedProduct, group.pricingMode),
      quantity: 1,
      imageUrl: resolvedProduct.imageUrl,
      bundleId,
      isBundleMain: false,
      linkedGroupTitle: selection.groupTitle,
      pricingMode: group.pricingMode,
    })
  })

  return lines
}

export function groupCartLinesByBundle(cart: any[]): Array<{ bundleId?: string; lines: any[] }> {
  const bundles = new Map<string, any[]>()
  const standalone: any[] = []

  cart.forEach((line) => {
    if (line?.bundleId) {
      const current = bundles.get(line.bundleId) || []
      current.push(line)
      bundles.set(line.bundleId, current)
      return
    }
    standalone.push(line)
  })

  const grouped = Array.from(bundles.values()).map((lines) => ({
    bundleId: lines[0]?.bundleId as string,
    lines: lines.sort((a, b) => Number(b.isBundleMain) - Number(a.isBundleMain)),
  }))

  return [
    ...grouped,
    ...standalone.map((line) => ({ bundleId: undefined, lines: [line] })),
  ]
}

export function getCartLinesForBundleRemoval(cart: any[], lineId: string): string[] {
  const target = cart.find((line) => line.id === lineId)
  if (!target?.bundleId) return [lineId]
  return cart.filter((line) => line.bundleId === target.bundleId).map((line) => line.id)
}
