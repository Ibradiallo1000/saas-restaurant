import { CanonicalOrderError } from "./errors.ts"
import { calculateOrderTotals, resolveCanonicalLinePrice } from "./pricing.ts"
import type {
  CanonicalOrderItem,
  CanonicalOrderPlan,
  CreateOrderRequest,
  OrderCreationAuthorities,
  OrderPrincipal,
  PreparationMode,
} from "./types.ts"

export function buildCanonicalOrder(input: {
  restaurantId: string
  request: CreateOrderRequest
  principal: OrderPrincipal
  authorities: OrderCreationAuthorities
  orderId: string
  orderItemIds: string[]
  now: Date
}): CanonicalOrderPlan {
  const { restaurant } = input.authorities
  if (restaurant.id !== input.restaurantId) {
    throw new CanonicalOrderError("RESTAURANT_NOT_FOUND", "Restaurant introuvable.")
  }
  if (!restaurant.active) {
    throw new CanonicalOrderError("RESTAURANT_INACTIVE", "Le restaurant n'est pas actif.")
  }
  if (input.principal.kind === "public" && !restaurant.publicOrderingOpen) {
    throw new CanonicalOrderError("PUBLIC_ORDERING_CLOSED", "Les commandes publiques sont fermées.")
  }
  assertTableSession(input.request, input.authorities)
  if (input.orderItemIds.length !== input.request.items.length) {
    throw new CanonicalOrderError("ORDER_CREATION_FAILED", "Impossible de préparer les lignes.")
  }

  const items = input.request.items.map((line, index) => {
    const product = input.authorities.products.get(line.productId)
    if (!product) {
      throw new CanonicalOrderError("PRODUCT_NOT_FOUND", `Produit introuvable : ${line.productId}.`)
    }
    if (!product.active) {
      throw new CanonicalOrderError("PRODUCT_UNAVAILABLE", `${product.name} n'est plus disponible.`)
    }
    if (product.categoryId) {
      const category = input.authorities.categories.get(product.categoryId)
      if (!category || !category.active) {
        throw new CanonicalOrderError("PRODUCT_UNAVAILABLE", `${product.name} n'est plus disponible.`)
      }
    }

    const preparationMode = resolvePreparationMode(product, input.authorities)
    const pricing = resolveCanonicalLinePrice(product, line)
    const orderItemId = input.orderItemIds[index]
    const status = preparationMode === "kitchen" ? "pending" : "ready"

    const item: CanonicalOrderItem = {
      id: orderItemId,
      orderItemId,
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      productId: product.id,
      clientLineId: line.clientLineId,
      name: product.name,
      nameSnapshot: product.name,
      unitPrice: pricing.unitPrice,
      priceSnapshot: pricing.unitPrice,
      quantity: line.quantity,
      cancelledQuantity: 0,
      servedQuantity: 0,
      subtotal: pricing.subtotal,
      total: pricing.subtotal,
      selectedOptions: pricing.selectedOptions,
      instructions: line.instructions,
      preparationMode,
      status,
      reviewsEnabled: product.reviewsEnabled,
      schemaVersion: 1,
      createdAt: input.now,
      updatedAt: input.now,
    }
    return item
  })

  const lineSubtotal = items.reduce((total, item) => total + item.subtotal, 0)
  const totals = calculateOrderTotals({
    lineSubtotal,
    taxRate: restaurant.taxRate,
    pricesIncludeTax: restaurant.pricesIncludeTax,
    deliveryFee: input.request.serviceMode === "delivery" ? restaurant.deliveryFee : 0,
  })
  const orderStatus = items.some((item) => item.status === "pending") ? "pending" : "ready"
  const displayId = `CMD-${input.orderId.slice(0, 8).toUpperCase()}`
  const tableSession = input.authorities.tableSession

  return {
    orderId: input.orderId,
    displayId,
    items,
    parent: {
      restaurantId: input.restaurantId,
      source: input.request.channel,
      channel: input.request.channel,
      type: input.request.serviceMode === "dine_in" ? "table" : input.request.serviceMode,
      orderType: input.request.serviceMode,
      serviceMode: input.request.serviceMode,
      tableId: input.request.tableContext?.tableId ?? null,
      table: input.request.tableContext?.tableId ?? null,
      zoneId: tableSession?.zoneId ?? null,
      sessionId: input.request.tableContext?.tableSessionId ?? null,
      tableSessionId: input.request.tableContext?.tableSessionId ?? null,
      cashSessionId: input.request.cashSessionId,
      customerName: input.request.customer?.name || "Client Anonyme",
      customerPhone: input.request.customer?.phone ?? null,
      customer: {
        name: input.request.customer?.name ?? null,
        phone: input.request.customer?.phone ?? null,
      },
      deliveryAddress: input.request.delivery?.address ?? null,
      deliveryZoneId: input.request.delivery?.zoneId ?? null,
      deliveryNote: input.request.delivery?.instructions ?? null,
      notes: input.request.notes,
      kitchenStatus: orderStatus,
      orderStatus,
      statusHistory: [{ status: orderStatus, at: input.now, source: "order" }],
      sessionActive: input.request.serviceMode === "dine_in",
      paymentMethod: null,
      paymentType: null,
      paymentIntentStatus: "none",
      paymentStatus: "unpaid",
      paymentCode: null,
      paidAt: null,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: 0,
      deliveryFee: totals.deliveryFee,
      tipAmount: 0,
      totalAmount: totals.total,
      total: totals.total,
      items,
      canonicalItemCount: items.length,
      aggregateVersion: 1,
      createdBy: input.principal.uid,
      schemaVersion: 1,
      displayId,
      createdAt: input.now,
      updatedAt: input.now,
    },
  }
}

function assertTableSession(
  request: CreateOrderRequest,
  authorities: OrderCreationAuthorities
) {
  if (request.serviceMode !== "dine_in") return
  const session = authorities.tableSession
  if (
    !session ||
    !session.active ||
    session.id !== request.tableContext?.tableSessionId ||
    session.tableId !== request.tableContext.tableId
  ) {
    throw new CanonicalOrderError("TABLE_SESSION_INACTIVE", "La session de table n'est plus active.")
  }
}

function resolvePreparationMode(
  product: OrderCreationAuthorities["products"] extends Map<string, infer P> ? P : never,
  authorities: OrderCreationAuthorities
): PreparationMode {
  if (product.preparationMode) return product.preparationMode
  const category = product.categoryId ? authorities.categories.get(product.categoryId) : null
  if (category?.preparationMode) return category.preparationMode
  if (!category) {
    throw new CanonicalOrderError(
      "INVALID_PREPARATION_MODE",
      `Le mode de préparation de ${product.name} est invalide.`
    )
  }
  const name = category.name.toLocaleLowerCase("fr")
  if (/(boisson|eau|soda)/.test(name)) return "direct"
  if (/(jus|cocktail|café|cafe|thé|the|bar)/.test(name)) return "bar"
  return "kitchen"
}
