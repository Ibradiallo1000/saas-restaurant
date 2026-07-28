import type { StockArticle } from "../../articles/domain/article"
import type {
  ControlledStockBalance,
  ControlledStockOperation,
  StockOperationType,
} from "../../controlled-stock/domain/models"

export type StockHealth = "OUT_OF_STOCK" | "LOW" | "NORMAL" | "NOT_TRACKED"
export type DailyStockFilter =
  | "ALL"
  | "OUT_OF_STOCK"
  | "LOW"
  | "NORMAL"
  | "CONTROLLED"
  | "AUTOMATIC_SIMPLE"
  | "NONE"
  | "ARCHIVED"

export type StockAlertType = "OUT_OF_STOCK" | "LOW_STOCK" | "CONTROL_OVERDUE"
export type StockAlertPriority = "CRITICAL" | "HIGH" | "MEDIUM"
export type StockAlertStatus = "ACTIVE" | "RESOLVED"

export interface DailyStockArticle {
  readonly article: StockArticle
  readonly categoryName?: string
  readonly balance: ControlledStockBalance | null
  readonly quantity: number | null
  readonly health: StockHealth
  readonly controlOverdue: boolean
}

export interface StockAlert {
  readonly id: string
  readonly type: StockAlertType
  readonly priority: StockAlertPriority
  readonly status: StockAlertStatus
  readonly articleId: string
  readonly articleName: string
  readonly occurredAt: string
  readonly resolvedAt?: string
}

export interface DailyStockDashboard {
  readonly generatedAt: string
  readonly totalTracked: number
  readonly outOfStock: readonly DailyStockArticle[]
  readonly lowStock: readonly DailyStockArticle[]
  readonly controlsDue: readonly DailyStockArticle[]
  readonly alerts: readonly StockAlert[]
  readonly recentSupplies: readonly ControlledStockOperation[]
  readonly recentControls: readonly ControlledStockOperation[]
  readonly recentVariances: readonly ControlledStockOperation[]
  readonly recentLosses: readonly ControlledStockOperation[]
}

export interface SimpleStockReport {
  readonly type:
    | "CURRENT_STATE"
    | "SUPPLIES"
    | "LOSSES"
    | "CONTROLS"
    | "VARIANCES"
  readonly from?: string
  readonly to?: string
  readonly articles: readonly DailyStockArticle[]
  readonly operations: readonly ControlledStockOperation[]
}

export interface DailyStockSource {
  readonly articles: readonly StockArticle[]
  readonly balances: Readonly<Record<string, ControlledStockBalance | undefined>>
  readonly operations: readonly ControlledStockOperation[]
  readonly categories?: Readonly<Record<string, string>>
}

export interface DailyStockSearch {
  readonly query?: string
  readonly filter?: DailyStockFilter
}

export interface SimpleReportQuery {
  readonly type: SimpleStockReport["type"]
  readonly from?: string
  readonly to?: string
}

export interface TimelineEntry {
  readonly id: string
  readonly occurredAt: string
  readonly type: StockOperationType
  readonly articleId: string
  readonly articleName: string
  readonly title: string
  readonly detail: string
}
