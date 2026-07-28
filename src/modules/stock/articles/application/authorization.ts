import type {
  StockCapability,
  StockPrincipal,
} from "../../core/permissions"
import type { StockRole } from "../../core/value-objects"
import { ArticleDomainError } from "../domain/errors.ts"

export const ARTICLE_ACTIONS = [
  "read",
  "create",
  "update",
  "archive",
  "read_cost",
  "update_cost",
  "manage_categories",
  "manage_packagings",
] as const

export type ArticleAction = (typeof ARTICLE_ACTIONS)[number]

const ACTION_REQUIREMENTS: Readonly<
  Record<ArticleAction, readonly StockCapability[]>
> = {
  read: ["stock.items.read"],
  create: ["stock.items.create"],
  update: ["stock.items.update"],
  archive: ["stock.items.archive"],
  read_cost: ["stock.costs.read"],
  update_cost: ["stock.items.update", "stock.costs.read"],
  manage_categories: ["stock.settings.manage"],
  manage_packagings: ["stock.items.update"],
}

export const ARTICLE_ROLE_CAPABILITIES: Readonly<
  Record<StockRole, readonly StockCapability[]>
> = {
  owner: [
    "stock.items.read",
    "stock.items.create",
    "stock.items.update",
    "stock.items.archive",
    "stock.costs.read",
    "stock.settings.manage",
  ],
  manager: [
    "stock.items.read",
    "stock.items.create",
    "stock.items.update",
    "stock.items.archive",
    "stock.costs.read",
    "stock.settings.manage",
  ],
  kitchen_chef: ["stock.items.read"],
  bar_manager: ["stock.items.read"],
  storekeeper: [
    "stock.items.read",
    "stock.items.create",
    "stock.items.update",
  ],
  purchasing_manager: [
    "stock.items.read",
    "stock.items.create",
    "stock.items.update",
    "stock.costs.read",
  ],
  employee: [],
}

export function canPerformArticleAction(
  principal: StockPrincipal,
  action: ArticleAction,
  restaurantId: string
) {
  if (String(principal.scope.restaurantId) !== restaurantId) return false
  const capabilities = new Set(principal.capabilities)
  return ACTION_REQUIREMENTS[action].every((capability) =>
    capabilities.has(capability)
  )
}

export function assertArticleAuthorization(
  principal: StockPrincipal,
  action: ArticleAction,
  restaurantId: string
) {
  if (!canPerformArticleAction(principal, action, restaurantId)) {
    throw new ArticleDomainError(
      String(principal.scope.restaurantId) === restaurantId
        ? "ARTICLE_FORBIDDEN"
        : "ARTICLE_RESTAURANT_MISMATCH",
      "Vous n’êtes pas autorisé à effectuer cette action."
    )
  }
}

export function capabilitiesForArticleRole(role: StockRole) {
  return ARTICLE_ROLE_CAPABILITIES[role]
}
