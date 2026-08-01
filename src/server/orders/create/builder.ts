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
import {
  productUnavailableMessage,
  resolveProductPreparationMode as resolveSharedPreparationMode,
} from "../../../lib/product-availability.ts"
import { isProductAllowedAtPosStation } from "../../../lib/pos-stations.ts"
import { resolvePreparationStation } from "../../../lib/preparation-stations.ts"

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
  assertPosSession(input)
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
    if (input.request.channel === "pos" && !isProductAllowedAtPosStation(input.authorities.posSession?.catalogScope, product)) {
      throw new CanonicalOrderError("PRODUCT_NOT_ALLOWED_AT_STATION", `${product.name} n’est pas vendu par cette caisse.`)
    }
    const operationalAvailabilityState = product.operationalAvailabilityState ?? "AVAILABLE"
    if (operationalAvailabilityState !== "AVAILABLE") {
      throw new CanonicalOrderError(
        "PRODUCT_UNAVAILABLE",
        productUnavailableMessage(product.name, operationalAvailabilityState)
      )
    }
    if (product.categoryId) {
      const category = input.authorities.categories.get(product.categoryId)
      if (!category || !category.active) {
        throw new CanonicalOrderError("PRODUCT_UNAVAILABLE", `${product.name} n'est plus disponible.`)
      }
    }

    const preparationMode = resolvePreparationMode(product, input.authorities)
    const category = product.categoryId ? input.authorities.categories.get(product.categoryId) : null
    const preparationStation = resolvePreparationStation({
      preparationMode,
      productStationId: product.preparationStationId,
      categoryStationId: category?.preparationStationId,
      stations: input.authorities.preparationStations,
    })
    const explicitStationId = product.preparationStationId || category?.preparationStationId
    if (preparationMode !== "direct" && (!preparationStation || !preparationStation.isActive || !preparationStation.acceptsOrders)) {
      throw new CanonicalOrderError("PREPARATION_STATION_UNAVAILABLE", explicitStationId ? "Le poste de préparation configuré est indisponible." : `${product.name} n’a aucune destination de préparation disponible.`)
    }
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
      preparationStationId: preparationStation?.id ?? null,
      preparationStationName: preparationStation?.name ?? null,
      preparationStationCode: preparationStation?.code ?? null,
      status,
      reviewsEnabled: product.reviewsEnabled,
      portionReserved: product.portionControl?.enabled === true,
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
      table: tableSession?.tableName ?? null,
      zoneId: tableSession?.zoneId ?? null,
      sessionId: input.request.tableContext?.tableSessionId ?? null,
      tableSessionId: input.request.tableContext?.tableSessionId ?? null,
      cashSessionId: input.request.cashSessionId,
      ...(input.request.channel === "pos" ? {
        originPosStationId: input.authorities.posSession?.stationId ?? null,
        originPosStationName: input.authorities.posSession?.stationName ?? null,
        originPosStationCode: input.authorities.posSession?.stationCode ?? null,
        cashierId: input.principal.uid,
      } : {}),
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

function assertPosSession(input: Parameters<typeof buildCanonicalOrder>[0]) {
  if (input.request.channel !== "pos") return
  const session = input.authorities.posSession
  if (!session || !session.active || session.id !== input.request.cashSessionId) {
    throw new CanonicalOrderError("CASH_SESSION_NOT_OPEN", "La session de caisse n’est pas ouverte.")
  }
  if (session.cashierId !== input.principal.uid) {
    throw new CanonicalOrderError("CASH_SESSION_FORBIDDEN", "Cette session appartient à un autre caissier.")
  }
  if (!session.stationActive) {
    throw new CanonicalOrderError("POS_STATION_INACTIVE", "Le poste de caisse n’est plus actif.")
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
  const category = product.categoryId ? authorities.categories.get(product.categoryId) : null
  if (!product.preparationMode && !category) {
    throw new CanonicalOrderError(
      "INVALID_PREPARATION_MODE",
      `Le mode de préparation de ${product.name} est invalide.`
    )
  }
  return resolveSharedPreparationMode(
    product,
    category
      ? { preparationMode: category.preparationMode, categoryName: category.name }
      : null
  )
}
