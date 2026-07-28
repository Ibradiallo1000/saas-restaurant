import type { StockCapability, StockPrincipal } from "../../core/permissions"
import { ControlledStockError } from "../../controlled-stock/domain/errors.ts"

export type AutomaticAssociationAction =
  | "read_associations"
  | "create_association"
  | "update_association"
  | "disable_association"
  | "read_deductions"
  | "compensate"

const requirements: Record<AutomaticAssociationAction, StockCapability> = {
  read_associations: "stock.productTracking.read",
  create_association: "stock.productTracking.manage",
  update_association: "stock.productTracking.manage",
  disable_association: "stock.productTracking.manage",
  read_deductions: "stock.history.read",
  compensate: "stock.corrections.exceptional",
}

export function canPerformAutomaticAction(
  principal: StockPrincipal,
  action: AutomaticAssociationAction,
  restaurantId: string
) {
  return String(principal.scope.restaurantId) === restaurantId
    && principal.capabilities.includes(requirements[action])
}

export function assertAutomaticAction(
  principal: StockPrincipal,
  action: AutomaticAssociationAction,
  restaurantId: string
) {
  if (!canPerformAutomaticAction(principal, action, restaurantId)) {
    throw new ControlledStockError(
      String(principal.scope.restaurantId) === restaurantId
        ? "CONTROLLED_STOCK_FORBIDDEN"
        : "CONTROLLED_STOCK_RESTAURANT_MISMATCH",
      "Vous n’êtes pas autorisé à gérer le suivi automatique."
    )
  }
}
