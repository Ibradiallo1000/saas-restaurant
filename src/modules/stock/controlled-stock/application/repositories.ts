import type {
  ControlledStockBalance,
  OperationListQuery,
  OperationResult,
  OperationWrite,
  StockOperationPage,
} from "../domain/models"

export interface ControlledStockRepository {
  getBalance(
    restaurantId: string,
    articleId: string
  ): Promise<ControlledStockBalance | null>
  applyAtomic(write: OperationWrite): Promise<OperationResult>
  listOperations(query: OperationListQuery): Promise<StockOperationPage>
}
