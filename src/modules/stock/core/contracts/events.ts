import type { BusinessEvent } from "./base"

export const STOCK_EVENT_NAMES = [
  "StockItemCreated",
  "StockItemActivated",
  "StockItemUpdated",
  "StockItemArchived",
  "StockItemReactivated",
  "StockItemPackagingChanged",
  "ProductTrackingConfigured",
  "ProductTrackingChanged",
  "ProductMarkedUntracked",
  "RecipeDraftCreated",
  "RecipePublished",
  "RecipeReplaced",
  "PreparationBatchStarted",
  "PreparationBatchClosed",
  "IngredientSubstituted",
  "ConsumptionRequested",
  "ConsumptionCommitted",
  "ConsumptionIgnoredAsDuplicate",
  "ConsumptionCompensated",
  "StockMovementPosted",
  "StockBecameNegative",
  "StockThresholdReached",
  "StockRecovered",
  "CountStarted",
  "CountCompleted",
  "CountRecountRequested",
  "CountClosed",
  "CountCancelled",
  "LossDeclared",
  "LossValidated",
  "LossRejected",
  "InternalUseValidated",
  "ComplimentaryProductValidated",
  "SupplierCreated",
  "PurchaseNeedSuggested",
  "SupplierOrderCreated",
  "SupplierOrderConfirmed",
  "ReceptionStarted",
  "ReceptionReadyForValidation",
  "ReceptionValidated",
  "ReceptionRejected",
  "ReceptionReversed",
  "SupplierReturnPrepared",
  "SupplierReturnShipped",
  "SupplierReturnResolved",
  "SupplierInvoiceRegistered",
  "SupplierPaymentValidated",
  "TransferSent",
  "TransferReceived",
  "TransferDisputed",
  "TransferCancelled",
  "DataQualityIssueDetected",
  "DataQualityIssueResolved",
  "CostMissingDetected",
  "RecipeCoverageIncomplete",
  "CountOverdueDetected",
] as const

export type StockEventName = (typeof STOCK_EVENT_NAMES)[number]
export type StockEvent<TName extends StockEventName = StockEventName, TPayload = unknown> = BusinessEvent<TName, TPayload>

export interface EventPublisher {
  publish(events: readonly StockEvent[]): Promise<void>
}

export interface EventHandler<TEvent extends StockEvent> {
  handle(event: TEvent): Promise<void>
}
