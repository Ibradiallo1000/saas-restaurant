import type { BusinessCommand } from "./base"

export const STOCK_COMMAND_NAMES = [
  "CreateStockItem",
  "UpdateStockItem",
  "ActivateStockItem",
  "ArchiveStockItem",
  "ReactivateStockItem",
  "ConfigureProductTracking",
  "CreateRecipeDraft",
  "PublishRecipe",
  "StartReception",
  "SubmitReceptionForValidation",
  "ValidateReception",
  "ReverseReception",
  "StartStockCount",
  "EnterCountLine",
  "CompleteStockCount",
  "RequestStockRecount",
  "CloseStockCount",
  "CancelStockCount",
  "DeclareLoss",
  "ValidateLoss",
  "RejectLoss",
  "DeclareInternalUse",
  "DeclareComplimentaryProduct",
  "CommitConsumption",
  "CompensateConsumption",
  "CreateStockTransfer",
  "SendStockTransfer",
  "ReceiveStockTransfer",
  "DisputeStockTransfer",
  "CreateSupplier",
  "UpdateSupplier",
  "CreateSupplierOrder",
  "SubmitSupplierOrder",
  "ConfirmSupplierOrder",
  "CancelSupplierOrderRemainder",
  "PrepareSupplierReturn",
  "ShipSupplierReturn",
  "ResolveSupplierReturn",
  "RegisterSupplierInvoice",
  "ValidateSupplierPayment",
  "StartPreparationBatch",
  "ClosePreparationBatch",
  "ReverseStockOperation",
] as const

export type StockCommandName = (typeof STOCK_COMMAND_NAMES)[number]
export type StockCommand<TName extends StockCommandName = StockCommandName, TPayload = unknown> = BusinessCommand<TName, TPayload>

export interface CommandHandler<TCommand extends StockCommand, TResult> {
  handle(command: TCommand): Promise<TResult>
}
