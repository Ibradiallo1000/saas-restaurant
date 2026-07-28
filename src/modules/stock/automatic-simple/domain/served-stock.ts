export function calculateServedDelta(input: {
  orderedQuantity: number
  requestedServedQuantity: number
  processedServedQuantity: number
  quantityPerSale: number
}) {
  const orderedQuantity = finiteNonNegative(input.orderedQuantity)
  const requestedServedQuantity = finiteNonNegative(input.requestedServedQuantity)
  const processedServedQuantity = finiteNonNegative(input.processedServedQuantity)
  const quantityPerSale = finitePositive(input.quantityPerSale)

  if (requestedServedQuantity > orderedQuantity) {
    throw new Error("La quantité servie ne peut pas dépasser la quantité commandée.")
  }
  if (requestedServedQuantity < processedServedQuantity) {
    throw new Error("La quantité servie ne peut pas diminuer.")
  }

  const servedDelta = requestedServedQuantity - processedServedQuantity
  return {
    servedDelta,
    quantityToDeduct: calculateAutomaticDeduction(servedDelta, quantityPerSale),
  }
}

export function calculateAutomaticDeduction(
  servedDelta: number,
  quantityPerSale: number
) {
  return finiteNonNegative(servedDelta) * finitePositive(quantityPerSale)
}

export function automaticAssociationId(productId: string, articleId: string) {
  return `${encodeURIComponent(productId)}--${encodeURIComponent(articleId)}`
}

export function servingProgressId(
  orderId: string,
  orderItemId: string,
  articleId: string
) {
  return [orderId, orderItemId, articleId].join("--")
}

export function servingEventId(
  orderId: string,
  orderItemId: string,
  articleId: string,
  servedQuantity: number
) {
  return ["served", orderId, orderItemId, articleId, servedQuantity].join("--")
}

function finiteNonNegative(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Quantité de service invalide.")
  }
  return value
}

function finitePositive(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Quantité par vente invalide.")
  }
  return value
}
