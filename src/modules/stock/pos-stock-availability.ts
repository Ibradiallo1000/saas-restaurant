import { stockUnitLabel } from "./shared/inventory-referential.ts"

export type PosStockAvailability = {
  productId: string
  articleId: string
  quantity: number
  unit: string
  threshold: number
  trackingMode: string
}

type ProductLike = {
  id: string
  stockArticleId?: string | null
}

type AssociationLike = {
  productId?: string | null
  articleId?: string | null
  status?: string | null
}

type ArticleLike = {
  id: string
  baseUnit?: string | null
  lowStockThreshold?: number | null
  trackingMode?: string | null
  status?: string | null
}

type BalanceLike = {
  id: string
  articleId?: string | null
  quantity?: number | null
  unit?: string | null
}

export function buildPosStockAvailabilityMap(input: {
  products: readonly ProductLike[]
  associations: readonly AssociationLike[]
  articles: readonly ArticleLike[]
  balances: readonly BalanceLike[]
}) {
  const associationByProduct = new Map(
    input.associations
      .filter(
        (association) =>
          association.status !== "inactive" &&
          Boolean(association.productId) &&
          Boolean(association.articleId)
      )
      .map((association) => [String(association.productId), String(association.articleId)])
  )
  const articleById = new Map(
    input.articles
      .filter((article) => article.status !== "archived")
      .map((article) => [article.id, article])
  )
  const balanceByArticle = new Map(
    input.balances.map((balance) => [String(balance.articleId || balance.id), balance])
  )
  const availabilityByProduct = new Map<string, PosStockAvailability>()

  input.products.forEach((product) => {
    const articleId = String(product.stockArticleId || associationByProduct.get(product.id) || "")
    if (!articleId) return

    const article = articleById.get(articleId)
    const balance = balanceByArticle.get(articleId)
    if (!article || !balance) return

    const quantity = Number(balance.quantity)
    if (!Number.isFinite(quantity)) return

    availabilityByProduct.set(product.id, {
      productId: product.id,
      articleId,
      quantity,
      unit: String(article.baseUnit || balance.unit || ""),
      threshold: finiteNonNegative(article.lowStockThreshold),
      trackingMode: String(article.trackingMode || ""),
    })
  })

  return availabilityByProduct
}

export function getPosStockPresentation(stock: PosStockAvailability | undefined) {
  if (!stock) {
    return {
      availability: "unknown" as const,
      label: "Stock non suivi",
      disabled: false,
    }
  }

  if (stock.quantity <= 0) {
    return {
      availability: "unavailable" as const,
      label: "Rupture de stock",
      disabled: true,
    }
  }

  const formattedQuantity = formatStockQuantity(stock.quantity)
  const unit = stockUnitLabel(stock.unit, stock.quantity)
  if (stock.quantity <= stock.threshold) {
    return {
      availability: "limited" as const,
      label: `Stock faible : ${formattedQuantity} ${unit}`,
      disabled: false,
    }
  }

  return {
    availability: "available" as const,
    label: `${formattedQuantity} ${unit} disponibles`,
    disabled: false,
  }
}

function finiteNonNegative(value: number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function formatStockQuantity(quantity: number) {
  return quantity.toLocaleString("fr-FR", {
    maximumFractionDigits: 3,
  })
}
