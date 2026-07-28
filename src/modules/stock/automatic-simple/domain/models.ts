export interface AutomaticAssociation {
  readonly id: string
  readonly restaurantId: string
  readonly productId: string
  readonly productName?: string
  readonly articleId: string
  readonly articleName?: string
  readonly quantity: number
  readonly unit: string
  readonly status: "active" | "inactive"
  readonly createdAt: string
  readonly createdBy: string
  readonly updatedAt: string
  readonly updatedBy: string
}

export interface AutomaticAssociationInput {
  readonly restaurantId: string
  readonly productId: string
  readonly articleId: string
  readonly quantity: number
  readonly unit: string
  readonly actorId: string
}

export interface ConfirmedSaleEvent {
  readonly restaurantId: string
  readonly reference: string
  readonly status: "PAYMENT_CONFIRMED" | "DRAFT" | "PAYMENT_FAILED" | "CANCELLED"
  readonly lines: readonly { readonly productId: string; readonly quantity: number }[]
  readonly occurredAt: string
  readonly actorId: string
}

export interface AutomaticAnomaly {
  readonly type: "INSUFFICIENT_STOCK" | "INVALID_ASSOCIATION" | "ACTIVATION_BLOCKED"
  readonly articleId: string
  readonly productId?: string
  readonly reference?: string
  readonly message: string
}

export interface AutomaticEventResult {
  readonly saleAllowed: true
  readonly ignored: boolean
  readonly operations: readonly string[]
  readonly anomalies: readonly AutomaticAnomaly[]
}

export interface AutomaticActivationConfiguration {
  readonly enabled: boolean
  readonly restaurantAllowlist: readonly string[]
  readonly articleAllowlist: readonly string[]
}

export interface LegacyQuantityObservation {
  readonly restaurantId: string
  readonly articleId?: string
  readonly legacyId: string
  readonly legacyName: string
  readonly quantity: number
  readonly source: "inventory.quantity" | "inventoryItems.stockEstimated"
}

export interface StockV2Observation {
  readonly restaurantId: string
  readonly articleId: string
  readonly articleName: string
  readonly quantity: number
}

export interface StockAuthorityComparisonRow {
  readonly restaurantId: string
  readonly articleId?: string
  readonly articleName: string
  readonly source: LegacyQuantityObservation["source"]
  readonly legacyQuantity?: number
  readonly v2Quantity?: number
  readonly difference?: number
  readonly status: "MATCH" | "DIVERGENT" | "UNASSOCIATED" | "DUPLICATE"
  readonly comparedAt: string
}
