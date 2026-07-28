import type { StockArticle } from "../../articles/domain/article"
import type { ControlledStockOperation } from "../../controlled-stock/domain/models"
import type {
  DailyStockArticle,
  DailyStockDashboard,
  DailyStockSearch,
  DailyStockSource,
  SimpleReportQuery,
  SimpleStockReport,
  StockAlert,
  StockHealth,
  TimelineEntry,
} from "../domain/models"

export interface DailyStockPolicy {
  readonly controlledCheckIntervalDays: number
  readonly automaticCheckIntervalDays: number
  readonly recentItemsLimit: number
}

const DEFAULT_POLICY: DailyStockPolicy = {
  controlledCheckIntervalDays: 7,
  automaticCheckIntervalDays: 30,
  recentItemsLimit: 5,
}

export class DailyStockService {
  private readonly policy: DailyStockPolicy

  constructor(policy: DailyStockPolicy = DEFAULT_POLICY) {
    this.policy = policy
  }

  buildArticles(source: DailyStockSource, now: string): readonly DailyStockArticle[] {
    return source.articles.map((article) => {
      const balance = source.balances[String(article.id)] ?? null
      const quantity = article.trackingMode === "NONE" ? null : balance?.quantity ?? 0
      return {
        article,
        categoryName: article.categoryId
          ? source.categories?.[String(article.categoryId)]
          : undefined,
        balance,
        quantity,
        health: stockHealth(article, quantity),
        controlOverdue: isControlOverdue(article, balance?.lastControlAt, now, this.policy),
      }
    })
  }

  buildDashboard(source: DailyStockSource, now: string): DailyStockDashboard {
    const articles = this.buildArticles(source, now)
    const operations = newestFirst(source.operations)
    return {
      generatedAt: now,
      totalTracked: articles.filter(
        (item) => item.article.status === "active" && item.article.trackingMode !== "NONE"
      ).length,
      outOfStock: articles.filter((item) => item.article.status === "active" && item.health === "OUT_OF_STOCK"),
      lowStock: articles.filter((item) => item.article.status === "active" && item.health === "LOW"),
      controlsDue: articles.filter((item) => item.article.status === "active" && item.controlOverdue),
      alerts: this.calculateAlerts(articles, now),
      recentSupplies: recentByType(operations, "APPROVISIONNEMENT", this.policy.recentItemsLimit),
      recentControls: recentByType(operations, "CONTROLE_PHYSIQUE", this.policy.recentItemsLimit),
      recentVariances: operations.filter(
        (item) => item.type === "CONTROLE_PHYSIQUE" && item.variation !== 0
      ).slice(0, this.policy.recentItemsLimit),
      recentLosses: recentByType(operations, "PERTE", this.policy.recentItemsLimit),
    }
  }

  calculateAlerts(articles: readonly DailyStockArticle[], now: string): readonly StockAlert[] {
    return articles.flatMap((item) => {
      if (item.article.status !== "active" || item.article.trackingMode === "NONE") return []
      const common = {
        articleId: String(item.article.id),
        articleName: item.article.name,
        occurredAt: item.balance?.lastOperationAt ?? now,
        status: "ACTIVE" as const,
      }
      if (item.health === "OUT_OF_STOCK") {
        return [{ ...common, id: `OUT_OF_STOCK:${item.article.id}`, type: "OUT_OF_STOCK" as const, priority: "CRITICAL" as const }]
      }
      const alerts: StockAlert[] = []
      if (item.health === "LOW") alerts.push({ ...common, id: `LOW_STOCK:${item.article.id}`, type: "LOW_STOCK", priority: "HIGH" })
      if (item.controlOverdue) alerts.push({ ...common, id: `CONTROL_OVERDUE:${item.article.id}`, type: "CONTROL_OVERDUE", priority: "MEDIUM" })
      return alerts
    }).sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority))
  }

  reconcileAlerts(
    previous: readonly StockAlert[],
    active: readonly StockAlert[],
    now: string
  ): readonly StockAlert[] {
    const activeIds = new Set(active.map((item) => item.id))
    const resolved = previous
      .filter((item) => item.status === "ACTIVE" && !activeIds.has(item.id))
      .map((item) => ({ ...item, status: "RESOLVED" as const, resolvedAt: now }))
    return [...active, ...resolved]
  }

  replenishment(source: DailyStockSource, now: string) {
    return this.buildArticles(source, now)
      .filter((item) => item.article.status === "active" && (item.health === "OUT_OF_STOCK" || item.health === "LOW"))
      .sort((left, right) => {
        const health = healthRank(left.health) - healthRank(right.health)
        return health || left.article.name.localeCompare(right.article.name, "fr")
      })
  }

  search(source: DailyStockSource, search: DailyStockSearch, now: string) {
    const query = normalize(search.query ?? "")
    return this.buildArticles(source, now).filter((item) => {
      if (query && !normalize([
        item.article.name,
        item.categoryName ?? "",
        item.article.trackingMode,
        trackingSearchLabel(item.article.trackingMode),
        item.health,
        healthSearchLabel(item.health),
      ].join(" ")).includes(query)) return false
      const filter = search.filter ?? "ALL"
      if (filter === "ALL") return item.article.status === "active"
      if (filter === "ARCHIVED") return item.article.status === "archived"
      if (filter === "CONTROLLED" || filter === "AUTOMATIC_SIMPLE" || filter === "NONE") {
        return item.article.status === "active" && item.article.trackingMode === filter
      }
      return item.article.status === "active" && item.health === filter
    })
  }

  timeline(source: DailyStockSource): readonly TimelineEntry[] {
    const names = new Map(source.articles.map((article) => [String(article.id), article.name]))
    return newestFirst(source.operations).map((operation) => ({
      id: operation.id,
      occurredAt: String(operation.occurredAt),
      type: operation.type,
      articleId: String(operation.articleId),
      articleName: names.get(String(operation.articleId)) ?? "Article",
      title: operationLabel(operation),
      detail: operationDetail(operation, names.get(String(operation.articleId)) ?? "Article"),
    }))
  }

  report(source: DailyStockSource, query: SimpleReportQuery, now: string): SimpleStockReport {
    const operations = newestFirst(source.operations).filter((operation) => {
      if (query.from && String(operation.occurredAt) < query.from) return false
      if (query.to && String(operation.occurredAt) > query.to) return false
      if (query.type === "SUPPLIES") return operation.type === "APPROVISIONNEMENT"
      if (query.type === "LOSSES") return operation.type === "PERTE"
      if (query.type === "CONTROLS") return operation.type === "CONTROLE_PHYSIQUE"
      if (query.type === "VARIANCES") return operation.type === "CONTROLE_PHYSIQUE" && operation.variation !== 0
      return false
    })
    return {
      type: query.type,
      from: query.from,
      to: query.to,
      articles: query.type === "CURRENT_STATE" ? this.buildArticles(source, now) : [],
      operations,
    }
  }
}

function stockHealth(article: StockArticle, quantity: number | null): StockHealth {
  if (article.trackingMode === "NONE" || quantity === null) return "NOT_TRACKED"
  if (quantity <= article.outOfStockThreshold) return "OUT_OF_STOCK"
  if (quantity <= article.lowStockThreshold) return "LOW"
  return "NORMAL"
}

function isControlOverdue(
  article: StockArticle,
  lastControlAt: string | undefined,
  now: string,
  policy: DailyStockPolicy
) {
  if (article.trackingMode === "NONE") return false
  if (!lastControlAt) return true
  const interval = article.trackingMode === "CONTROLLED"
    ? policy.controlledCheckIntervalDays
    : policy.automaticCheckIntervalDays
  return Date.parse(now) - Date.parse(lastControlAt) >= interval * 86_400_000
}

function newestFirst(operations: readonly ControlledStockOperation[]) {
  return [...operations].sort((left, right) =>
    String(right.occurredAt).localeCompare(String(left.occurredAt))
  )
}

function recentByType(
  operations: readonly ControlledStockOperation[],
  type: ControlledStockOperation["type"],
  limit: number
) {
  return operations.filter((item) => item.type === type).slice(0, limit)
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").trim()
}

function healthRank(value: StockHealth) {
  return value === "OUT_OF_STOCK" ? 0 : value === "LOW" ? 1 : 2
}

function priorityRank(value: StockAlert["priority"]) {
  return value === "CRITICAL" ? 0 : value === "HIGH" ? 1 : 2
}

function trackingSearchLabel(mode: StockArticle["trackingMode"]) {
  if (mode === "CONTROLLED") return "controle stock controle"
  if (mode === "AUTOMATIC_SIMPLE") return "automatique simple"
  return "non suivi"
}

function healthSearchLabel(health: StockHealth) {
  if (health === "OUT_OF_STOCK") return "rupture"
  if (health === "LOW") return "seuil faible stock faible"
  if (health === "NORMAL") return "normal"
  return "non suivi"
}

function operationLabel(operation: ControlledStockOperation) {
  if (operation.type === "APPROVISIONNEMENT") return "Approvisionnement"
  if (operation.type === "CONTROLE_PHYSIQUE") return "Contrôle physique"
  if (operation.type === "PERTE") return "Perte"
  if (operation.type === "AUTOMATIC_DEDUCTION") return "Déduction automatique"
  if (operation.type === "AUTOMATIC_COMPENSATION") return "Compensation automatique"
  return operation.type === "CORRECTION_POSITIVE" ? "Correction positive" : "Correction négative"
}

function operationDetail(operation: ControlledStockOperation, articleName: string) {
  if (operation.type === "CONTROLE_PHYSIQUE") {
    const sign = operation.variation > 0 ? "+" : ""
    return `Écart ${sign}${operation.variation} ${operation.unit} — ${articleName}`
  }
  const sign = operation.variation > 0 ? "+" : ""
  return `${sign}${operation.variation} ${operation.unit} — ${articleName}`
}
