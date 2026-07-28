import type { ActorId, RestaurantId, StockRole, StockZoneId } from "./value-objects"

export const STOCK_CAPABILITIES = [
  "stock.items.read",
  "stock.items.create",
  "stock.items.update",
  "stock.items.archive",
  "stock.quantities.read",
  "stock.history.read",
  "stock.receptions.read",
  "stock.receptions.create",
  "stock.receptions.validate",
  "stock.receptions.reverse",
  "stock.counts.read",
  "stock.counts.create",
  "stock.counts.enter",
  "stock.counts.validate",
  "stock.counts.close",
  "stock.losses.read",
  "stock.losses.declare",
  "stock.losses.validate",
  "stock.internalUse.declare",
  "stock.complimentary.declare",
  "stock.corrections.exceptional",
  "stock.transfers.read",
  "stock.transfers.create",
  "stock.transfers.receive",
  "stock.recipes.read",
  "stock.recipes.create",
  "stock.recipes.update",
  "stock.recipes.publish",
  "stock.productTracking.read",
  "stock.productTracking.manage",
  "stock.suppliers.read",
  "stock.suppliers.manage",
  "stock.purchases.read",
  "stock.purchases.manage",
  "stock.supplierFinance.read",
  "stock.supplierFinance.manage",
  "stock.costs.read",
  "stock.reports.operational.read",
  "stock.reports.financial.read",
  "stock.settings.manage",
  "stock.permissions.manage",
  "stock.validations.approve",
] as const

export type StockCapability = (typeof STOCK_CAPABILITIES)[number]

export interface AuthorizationScope {
  readonly restaurantId: RestaurantId
  readonly zoneIds?: readonly StockZoneId[]
}

export interface StockPrincipal {
  readonly actorId: ActorId
  readonly role: StockRole
  readonly capabilities: readonly StockCapability[]
  readonly scope: AuthorizationScope
}

export interface AuthorizationRequest {
  readonly principal: StockPrincipal
  readonly capability: StockCapability
  readonly resourceId?: string
  readonly zoneId?: StockZoneId
}

export type AuthorizationDecision =
  | {
      readonly allowed: true
      readonly capability: StockCapability
      readonly scope: AuthorizationScope
    }
  | {
      readonly allowed: false
      readonly capability: StockCapability
      readonly reason: AuthorizationDenialReason
    }

export const AUTHORIZATION_DENIAL_REASONS = [
  "unauthenticated",
  "missing_capability",
  "outside_restaurant_scope",
  "outside_zone_scope",
  "resource_state_forbidden",
  "cost_visibility_forbidden",
  "financial_visibility_forbidden",
] as const

export type AuthorizationDenialReason = (typeof AUTHORIZATION_DENIAL_REASONS)[number]

export interface AuthorizationEvaluator {
  evaluate(request: AuthorizationRequest): AuthorizationDecision | Promise<AuthorizationDecision>
}
