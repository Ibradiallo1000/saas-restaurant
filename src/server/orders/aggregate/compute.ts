import { OrderAggregateError } from "./errors.ts"
import type { AggregateItem, AggregateParent, AggregateStatus, ComputedAggregate } from "./types.ts"

export function computeOrderAggregate(input: { parent: AggregateParent; items: AggregateItem[] }): ComputedAggregate {
  if (!input.items.length) throw new OrderAggregateError("NO_CANONICAL_ORDER_ITEMS", "Aucune ligne canonique.")
  if (input.parent.canonicalItemCount !== input.items.length) throw new OrderAggregateError("LEGACY_ORDER_READ_ONLY", "Sous-collection canonique partielle.")
  const payment = normalizePayment(input.parent.paymentStatus)
  const rows = input.items.map(validate)
  const active = rows.filter((row) => !row.cancelled)
  let status: AggregateStatus
  if (!active.length) status = "cancelled"
  else if (active.every((row) => row.served)) status = payment === "paid" ? "completed" : "served"
  else if (active.every((row) => row.served || row.item.status === "ready")) status = "ready"
  else if (active.some((row) => row.item.status === "preparing")) status = "preparing"
  else status = "pending"
  const summary = {
    schemaVersion: 1 as const,
    activeItemCount: active.length,
    pendingItemCount: count(active, "pending"),
    preparingItemCount: count(active, "preparing"),
    readyItemCount: count(active, "ready"),
    servedItemCount: active.filter((row) => row.served).length,
    cancelledItemCount: rows.filter((row) => row.cancelled).length,
    allActiveItemsServed: active.length > 0 && active.every((row) => row.served),
    hasKitchenItems: active.some((row) => row.item.preparationMode === "kitchen"),
    hasBarItems: active.some((row) => row.item.preparationMode === "bar"),
    hasDirectItems: active.some((row) => row.item.preparationMode === "direct"),
  }
  const legacy = projectItems(input.parent.embeddedItems, input.items)
  const projectedItems = legacy.items
  return {
    orderStatus: status,
    kitchenStatus: status,
    orderAggregate: summary,
    projectedItems,
    projectionChanged:
      input.parent.orderStatus !== status ||
      input.parent.kitchenStatus !== status ||
      JSON.stringify(input.parent.orderAggregate) !== JSON.stringify(summary) ||
      (legacy.status === "UPDATED" && JSON.stringify(input.parent.embeddedItems) !== JSON.stringify(projectedItems)),
    legacyProjection: legacy.status,
    warnings: legacy.status === "IGNORED" ? ["LEGACY_ITEMS_PROJECTION_IGNORED"] : [],
  }
}

function validate(item: AggregateItem) {
  if (![item.quantity, item.cancelledQuantity, item.servedQuantity].every(Number.isInteger) ||
      item.quantity <= 0 || item.cancelledQuantity < 0 || item.servedQuantity < 0) {
    throw new OrderAggregateError("INCONSISTENT_QUANTITIES", "Quantité invalide.")
  }
  const active = item.quantity - item.cancelledQuantity
  if (active < 0 || item.servedQuantity > active) throw new OrderAggregateError("INCONSISTENT_QUANTITIES", "Quantités incompatibles.")
  const cancelled = active === 0
  const served = active > 0 && item.servedQuantity === active
  const partial = item.servedQuantity > 0 && !served
  if ((cancelled !== (item.status === "cancelled")) ||
      (served !== (item.status === "served")) ||
      (partial && item.status !== "ready")) {
    throw new OrderAggregateError("INVALID_ITEM_STATE", "État incompatible avec les quantités.")
  }
  return { item, cancelled, served }
}
function normalizePayment(value: string) {
  if (value === "paid") return value
  if (["unpaid", "pending", "pending_cash", "pending_mobile", "pending_verification", "failed"].includes(value)) return value
  throw new OrderAggregateError("PAYMENT_STATE_INCONSISTENT", "Paiement incohérent.")
}
function count(rows: ReturnType<typeof validate>[], status: AggregateItem["status"]) {
  return rows.filter((row) => row.item.status === status).length
}
function projectItems(embedded: AggregateParent["embeddedItems"], items: AggregateItem[]) {
  if (embedded === null) return { items: null, status: "ABSENT" as const }
  if (embedded.length !== items.length) return { items: null, status: "IGNORED" as const }
  const map = new Map(items.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const projected: Array<Record<string, unknown>> = []
  for (const entry of embedded) {
    const id = String(entry.id ?? entry.orderItemId ?? "")
    const item = map.get(id)
    if (!item || seen.has(id)) return { items: null, status: "IGNORED" as const }
    seen.add(id)
    projected.push({ ...entry, id, orderItemId: id, status: item.status, servedQuantity: item.servedQuantity, cancelledQuantity: item.cancelledQuantity, version: item.version })
  }
  return { items: projected, status: "UPDATED" as const }
}
