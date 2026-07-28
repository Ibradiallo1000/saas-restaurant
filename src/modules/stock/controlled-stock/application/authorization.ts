import type {
  StockCapability,
  StockPrincipal,
} from "../../core/permissions"
import type { StockRole } from "../../core/value-objects"
import { ControlledStockError } from "../domain/errors.ts"

export const CONTROLLED_STOCK_ACTIONS = [
  "read",
  "supply",
  "control",
  "loss",
  "correction",
  "history",
  "read_cost",
  "automatic_deduction",
  "automatic_compensation",
] as const
export type ControlledStockAction =
  (typeof CONTROLLED_STOCK_ACTIONS)[number]

const REQUIREMENTS: Record<
  ControlledStockAction,
  readonly StockCapability[]
> = {
  read: ["stock.quantities.read"],
  supply: ["stock.receptions.create", "stock.receptions.validate"],
  control: ["stock.counts.enter", "stock.counts.validate"],
  loss: ["stock.losses.declare", "stock.losses.validate"],
  correction: ["stock.corrections.exceptional"],
  history: ["stock.history.read"],
  read_cost: ["stock.costs.read"],
  automatic_deduction: ["stock.productTracking.manage"],
  automatic_compensation: ["stock.corrections.exceptional"],
}

export const CONTROLLED_STOCK_ROLE_CAPABILITIES: Record<
  StockRole,
  readonly StockCapability[]
> = {
  owner: [
    "stock.quantities.read",
    "stock.history.read",
    "stock.receptions.create",
    "stock.receptions.validate",
    "stock.counts.enter",
    "stock.counts.validate",
    "stock.losses.declare",
    "stock.losses.validate",
    "stock.corrections.exceptional",
    "stock.costs.read",
    "stock.productTracking.read",
    "stock.productTracking.manage",
    "stock.settings.manage",
  ],
  manager: [
    "stock.quantities.read",
    "stock.history.read",
    "stock.receptions.create",
    "stock.receptions.validate",
    "stock.counts.enter",
    "stock.counts.validate",
    "stock.losses.declare",
    "stock.losses.validate",
    "stock.corrections.exceptional",
    "stock.costs.read",
    "stock.productTracking.read",
    "stock.productTracking.manage",
    "stock.settings.manage",
  ],
  storekeeper: [
    "stock.quantities.read",
    "stock.history.read",
    "stock.receptions.create",
    "stock.receptions.validate",
    "stock.counts.enter",
    "stock.counts.validate",
    "stock.losses.declare",
    "stock.losses.validate",
    "stock.productTracking.read",
  ],
  purchasing_manager: [
    "stock.quantities.read",
    "stock.history.read",
    "stock.receptions.create",
    "stock.receptions.validate",
    "stock.costs.read",
    "stock.productTracking.read",
    "stock.productTracking.manage",
  ],
  kitchen_chef: [
    "stock.quantities.read",
    "stock.history.read",
    "stock.counts.enter",
    "stock.counts.validate",
    "stock.losses.declare",
    "stock.losses.validate",
  ],
  bar_manager: [
    "stock.quantities.read",
    "stock.history.read",
    "stock.counts.enter",
    "stock.counts.validate",
    "stock.losses.declare",
    "stock.losses.validate",
  ],
  employee: [],
}

export function canPerformControlledStockAction(
  principal: StockPrincipal,
  action: ControlledStockAction,
  restaurantId: string
) {
  return (
    String(principal.scope.restaurantId) === restaurantId &&
    REQUIREMENTS[action].every((item) =>
      principal.capabilities.includes(item)
    )
  )
}

export function assertControlledStockAuthorization(
  principal: StockPrincipal,
  action: ControlledStockAction,
  restaurantId: string
) {
  if (!canPerformControlledStockAction(principal, action, restaurantId)) {
    throw new ControlledStockError(
      String(principal.scope.restaurantId) === restaurantId
        ? "CONTROLLED_STOCK_FORBIDDEN"
        : "CONTROLLED_STOCK_RESTAURANT_MISMATCH",
      "Vous n’êtes pas autorisé à effectuer cette action."
    )
  }
}

export function capabilitiesForControlledStockRole(role: StockRole) {
  return CONTROLLED_STOCK_ROLE_CAPABILITIES[role]
}
