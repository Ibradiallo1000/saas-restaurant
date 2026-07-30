import type { OrderItemSnapshot } from "../commands/types.ts"

export type AggregateStatus = "pending" | "preparing" | "ready" | "served" | "completed" | "cancelled"
export interface AggregateParent {
  orderStatus: string
  kitchenStatus: string
  paymentStatus: string
  aggregateVersion: number
  orderAggregate: Record<string, unknown> | null
  embeddedItems: Array<Record<string, unknown>> | null
  canonicalItemCount: number
}
export interface AggregateSummary {
  schemaVersion: 1
  activeItemCount: number
  pendingItemCount: number
  preparingItemCount: number
  readyItemCount: number
  servedItemCount: number
  cancelledItemCount: number
  allActiveItemsServed: boolean
  hasKitchenItems: boolean
  hasBarItems: boolean
  hasDirectItems: boolean
}
export interface ComputedAggregate {
  orderStatus: AggregateStatus
  kitchenStatus: AggregateStatus
  orderAggregate: AggregateSummary
  projectedItems: Array<Record<string, unknown>> | null
  projectionChanged: boolean
  legacyProjection: "ABSENT" | "UPDATED" | "IGNORED"
  warnings: string[]
}
export type AggregateItem = OrderItemSnapshot
