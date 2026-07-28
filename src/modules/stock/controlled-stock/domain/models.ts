import type {
  ActorId,
  IsoDateTime,
  RestaurantId,
  StockItemId,
  StockUnit,
} from "../../core/value-objects"

export const STOCK_OPERATION_TYPES = [
  "APPROVISIONNEMENT",
  "CONTROLE_PHYSIQUE",
  "PERTE",
  "CORRECTION_POSITIVE",
  "CORRECTION_NEGATIVE",
  "AUTOMATIC_DEDUCTION",
  "AUTOMATIC_COMPENSATION",
] as const
export type StockOperationType = (typeof STOCK_OPERATION_TYPES)[number]

export const STOCK_LOSS_REASONS = [
  "CASSE",
  "DETERIORATION",
  "EXPIRATION",
  "ERREUR",
  "AUTRE",
] as const
export type StockLossReason = (typeof STOCK_LOSS_REASONS)[number]

export type StockVarianceType = "AUCUN_ECART" | "MANQUE" | "SURPLUS"

export interface ControlledStockBalance {
  readonly restaurantId: RestaurantId
  readonly articleId: StockItemId
  readonly quantity: number
  readonly unit: StockUnit
  readonly version: number
  readonly lastOperationAt: IsoDateTime
  readonly lastControlAt?: IsoDateTime
  readonly lastSupplyAt?: IsoDateTime
}

export interface ControlledStockOperation {
  readonly id: string
  readonly restaurantId: RestaurantId
  readonly articleId: StockItemId
  readonly type: StockOperationType
  readonly quantityBefore: number
  readonly variation: number
  readonly quantityAfter: number
  readonly unit: StockUnit
  readonly occurredAt: IsoDateTime
  readonly createdAt: IsoDateTime
  readonly createdBy: ActorId
  readonly reason?: string
  readonly reference?: string
  readonly note?: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
  readonly observedQuantity?: number
  readonly varianceType?: StockVarianceType
  readonly supplierId?: string
  readonly expenseId?: string
  readonly packagingId?: string
  readonly productId?: string
  readonly businessReference?: string
  readonly originalOperationId?: string
  readonly origin?: "USER" | "SYSTEM"
  readonly metadata?: Readonly<Record<string, string | number | boolean>>
}

export interface ControlledStockOperationCost {
  readonly restaurantId: RestaurantId
  readonly operationId: string
  readonly totalCost: number
  readonly unitCost: number
  readonly updatedAt: IsoDateTime
  readonly updatedBy: ActorId
}

export interface OperationWrite {
  readonly operation: ControlledStockOperation
  readonly balance: ControlledStockBalance
  readonly cost?: ControlledStockOperationCost
}

export interface StockOperationPage {
  readonly items: readonly ControlledStockOperation[]
  readonly nextCursor: string | null
  readonly total: number
}

export interface OperationListQuery {
  readonly restaurantId: string
  readonly articleId?: string
  readonly type?: StockOperationType | "ALL"
  readonly from?: string
  readonly to?: string
  readonly pageSize?: number
  readonly cursor?: string
}

export interface SupplyInput {
  readonly restaurantId: string
  readonly articleId: string
  readonly quantity: number
  readonly unit: string
  readonly packagingId?: string
  readonly totalCost?: number
  readonly supplierId?: string
  readonly reference?: string
  readonly occurredAt: string
  readonly actorId: string
  readonly note?: string
  readonly expenseId?: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
}

export interface PhysicalControlInput {
  readonly restaurantId: string
  readonly articleId: string
  readonly observedQuantity: number
  readonly unit: string
  readonly occurredAt: string
  readonly actorId: string
  readonly note?: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
}

export interface LossInput {
  readonly restaurantId: string
  readonly articleId: string
  readonly quantity: number
  readonly unit: string
  readonly reason: string
  readonly occurredAt: string
  readonly actorId: string
  readonly note?: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
}

export interface CorrectionInput {
  readonly restaurantId: string
  readonly articleId: string
  readonly direction: "POSITIVE" | "NEGATIVE"
  readonly quantity: number
  readonly unit: string
  readonly justification: string
  readonly occurredAt: string
  readonly actorId: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
}

export interface AutomaticDeductionInput {
  readonly restaurantId: string
  readonly articleId: string
  readonly productId: string
  readonly quantity: number
  readonly unit: string
  readonly businessReference: string
  readonly occurredAt: string
  readonly actorId: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
}

export interface AutomaticCompensationInput {
  readonly restaurantId: string
  readonly articleId: string
  readonly productId: string
  readonly quantity: number
  readonly unit: string
  readonly businessReference: string
  readonly originalOperationId: string
  readonly occurredAt: string
  readonly actorId: string
  readonly idempotencyKey: string
  readonly expectedVersion?: number
}

export interface OperationResult {
  readonly operation: ControlledStockOperation
  readonly balance: ControlledStockBalance
  readonly replayed: boolean
  readonly cost?: ControlledStockOperationCost
}
